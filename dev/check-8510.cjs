// 85.1.0 harness - the video module's own arithmetic, on the bytes that ship.
// No jsdom here: the DOM is stubbed at the four elements the code touches, so
// what runs is dev/video-8510.js itself, not a copy of it.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'video-8510.js'), 'utf8');

function stub(id){
  return {
    id, style: {}, _html: '', _text: '',
    classList: { s: new Set(),
      add(c){ this.s.add(c); }, remove(c){ this.s.delete(c); },
      toggle(c, on){ if(on) this.s.add(c); else this.s.delete(c); },
      contains(c){ return this.s.has(c); } },
    addEventListener(){}, setAttribute(k, v){ this['attr_' + k] = v; },
    getAttribute(k){ return this['attr_' + k]; },
    get innerHTML(){ return this._html; }, set innerHTML(v){ this._html = v; },
    get textContent(){ return this._text; }, set textContent(v){ this._text = v; }
  };
}

function videoEl(){
  const v = stub('scVideoEl');
  v.muted = true; v.paused = true; v.currentTime = 0; v.duration = 0;
  v.readyState = 0; v.ended = false; v.error = null; v._src = '';
  v.refuse = null;         // null | 'NotAllowedError'
  v.loads = 0;
  Object.defineProperty(v, 'src', {
    get(){ return this._src; },
    set(x){ this._src = x; this.paused = true; }
  });
  v.removeAttribute = function(){ this._src = ''; this.paused = true; };
  v.load = function(){ this.loads++; this.readyState = 1; this.duration = 200; };
  v.play = function(){
    if(this.refuse){ const e = new Error('blocked'); e.name = this.refuse; this.paused = true; return Promise.reject(e); }
    this.paused = false; this.readyState = 3; return Promise.resolve();
  };
  v.pause = function(){ this.paused = true; };
  return v;
}

function audioEl(){
  const a = stub('audio');
  a.paused = true; a.currentTime = 0;
  a.plays = 0; a.pauses = 0;
  a.play = function(){ this.plays++; this.paused = false; return Promise.resolve(); };
  a.pause = function(){ this.pauses++; this.paused = true; };
  return a;
}

const els = {};
['scVideoPlay','scVideoClock','scVideoFill','scVideoBig','scVideoSay','scVideoSpin',
 'scVideoNext','scVideoFoot','scVideoChip','scVideoTitle','scVideoSub'].forEach(id => { els[id] = stub(id); });
const video = videoEl();
const audio = audioEl();
els.scVideoEl = video;

const listeners = {};
const sandbox = {
  console,
  document: {
    getElementById(id){ return els[id] || null; },
    createElement(tag){ const e = stub(tag); e.tagName = tag; return e; },
    head: { appendChild(){} }, body: stub('body'),
    addEventListener(){}
  },
  activeAudio(){ return audio; },
  scStreamState: {},
  scStreamAudio(){ return audio; },
  scStreamById(){ return null; },
  queue: [], allTracks: [], queueIndex: -1,
  Promise, setInterval, clearInterval, setTimeout, clearTimeout,
  isFinite, Number, Math, String, Object, Array, Error, JSON, URL,
  toast(){}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'video-8510.js' });

let pass = 0, fail = 0;
function ok(name, cond, extra){
  if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}

// ── the resolver's pick ──────────────────────────────────────────────────────
function playerAnswer(formats, adaptive){
  return () => Promise.resolve({
    videoDetails: { title: 'Real Video' },
    streamingData: { formats, adaptiveFormats: adaptive }
  });
}
const MUX = (itag, h) => ({ itag, mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', url: 'u' + itag, contentLength: '9000000', height: h });
const ADA = (itag, h) => ({ itag, mimeType: 'video/mp4; codecs="avc1.4d401f"', url: 'a' + itag, contentLength: '6000000', height: h });

(async () => {
  console.log('resolver');
  sandbox.scHttpJson = playerAnswer([MUX(22, 720), MUX(18, 360), MUX(43, 360)], [ADA(136, 720), ADA(135, 480)]);
  let r = await sandbox.scVideoPlayer('vid1');
  ok('muxed 360p itag 18 wins over 720p 22 and 43', r && r.itag === 18, r && r.itag);
  ok('it is flagged muxed and labelled 360p', r && r.muxed === true && r.label === '360p', r && r.label);
  ok('the player title reaches the header', r && r.title === 'Real Video', r && r.title);
  ok('the alternates are kept, minus the picked url', r && r.alts.length === 4, r && r.alts.length);

  sandbox.scHttpJson = playerAnswer([], [ADA(136, 720), ADA(135, 480), ADA(134, 360)]);
  r = await sandbox.scVideoPlayer('vid2');
  ok('with no muxed row the lowest adaptive is picked (134)', r && r.itag === 134, r && r.itag);
  ok('an adaptive pick is flagged not muxed', r && r.muxed === false);

  sandbox.scHttpJson = () => Promise.resolve({ playabilityStatus: { status: 'ERROR' } });
  r = await sandbox.scVideoPlayer('vid3');
  ok('an answer with no streams resolves to null, not a throw', r === null);

  // ── the controls ───────────────────────────────────────────────────────────
  console.log('controls');
  audio.paused = false;        // the song is what is playing when the tab opens
  sandbox.scVideoAttach('https://x/video.mp4', 'direct');
  await new Promise(res => setTimeout(res, 20));
  ok('the frame is kept, no refusal', video.paused === false && sandbox.scVideoState.blocked === false);
  ok('the round button shows PAUSE while it runs', els.scVideoPlay._html.includes('M7.2 5h3.3'), 'icon not swapped');
  ok('its label says Pause', els.scVideoPlay['attr_aria-label'] === 'Pause', els.scVideoPlay['attr_aria-label']);

  // a tap while it runs pauses the song AND the picture
  audio.currentTime = 42;
  sandbox.scVideoTap();
  ok('PAUSE stops the song too', audio.paused === true);
  ok('PAUSE stops the picture', video.paused === true);
  ok('the button goes back to PLAY', els.scVideoPlay._html.includes('M8.5 5.2'));
  ok('a paused picture offers the big button', els.scVideoBig.classList.contains('on'));

  // a tap while it is stopped starts both, and it starts the song first
  const before = audio.plays;
  sandbox.scVideoTap();
  await new Promise(res => setTimeout(res, 20));
  ok('PLAY starts the song', audio.plays === before + 1);
  ok('PLAY starts the picture', video.paused === false);
  ok('the big button gets out of the way', !els.scVideoBig.classList.contains('on'));

  // ── the refusal a WebView gives ────────────────────────────────────────────
  console.log('refused autoplay');
  audio.pause();
  video.refuse = 'NotAllowedError';
  sandbox.scVideoAttach('https://x/video2.mp4', 'direct');
  await new Promise(res => setTimeout(res, 20));
  ok('the refusal is recorded, not dropped', sandbox.scVideoState.blocked === true);
  ok('the stage says which refusal it was', els.scVideoSay._text.includes('NotAllowedError'), els.scVideoSay._text);
  ok('the big play button is offered', els.scVideoBig.classList.contains('on'));
  ok('the transport still reads PLAY', els.scVideoPlay._html.includes('M8.5 5.2'));
  video.refuse = null;

  // ── the clock and the drift ────────────────────────────────────────────────
  console.log('clock and drift');
  video.readyState = 3; video.duration = 200; video.currentTime = 30;
  audio.currentTime = 1;
  sandbox.scVideoSync(false);
  ok('a 29 s drift is re-seated on the song', video.currentTime === 1, video.currentTime);
  video.currentTime = 30.5; audio.currentTime = 30;
  sandbox.scVideoSync(false);
  ok('half a second of drift is left alone', video.currentTime === 30.5, video.currentTime);
  video.duration = 200; video.currentTime = 50;
  sandbox.scVideoClock();
  ok('the clock reads 0:50 / 3:20', els.scVideoClock._text === '0:50 / 3:20', els.scVideoClock._text);
  ok('the progress line is a quarter full', els.scVideoFill.style.width === '25%', els.scVideoFill.style.width);

  // the song pauses, the picture follows it on the next tick
  audio.paused = true; video.paused = false;
  sandbox.scVideoSync(false);
  ok('the picture pauses when the song does', video.paused === true);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
