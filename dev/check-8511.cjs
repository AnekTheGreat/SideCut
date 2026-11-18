// 85.1.1 harness - the module that ships, against a stubbed DOM.
// The question this answers: does the video carry its own sound, is the video
// picked for the song it belongs to, and is the waiting button the drawn one.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'video-8511.js'), 'utf8');

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
  v.refuse = null; v.loads = 0;
  Object.defineProperty(v, 'src', {
    get(){ return this._src; },
    set(x){ this._src = x; this.paused = true; }
  });
  v.removeAttribute = function(){ this._src = ''; this.paused = true; };
  v.load = function(){ this.loads++; this.readyState = 1; this.duration = 210; };
  v.play = function(){
    if(this.refuse){ const e = new Error('blocked'); e.name = this.refuse; this.paused = true; return Promise.reject(e); }
    this.paused = false; this.readyState = 3; return Promise.resolve();
  };
  v.pause = function(){ this.paused = true; };
  return v;
}

function audioEl(){
  const a = stub('audio');
  a.paused = false; a.currentTime = 0; a.duration = 210;
  a.plays = 0; a.pauses = 0;
  a.play = function(){ this.plays++; this.paused = false; return Promise.resolve(); };
  a.pause = function(){ this.pauses++; this.paused = true; };
  return a;
}

const els = {};
['scVideoPlay','scVideoClock','scVideoFill','scVideoBig','scVideoSay','scVideoSpin',
 'scVideoNext','scVideoFoot','scVideoChip','scVideoTitle','scVideoSub'].forEach(id => { els[id] = stub(id); });
const video = videoEl(), audio = audioEl();
els.scVideoEl = video;

const css = { text: '' };
const sandbox = {
  console,
  document: {
    getElementById(id){ return els[id] || null; },
    createElement(tag){ const e = stub(tag); if(tag === 'style'){ Object.defineProperty(e, 'textContent', { get(){ return css.text; }, set(v){ css.text = v; } }); } return e; },
    head: { appendChild(){} }, body: Object.assign(stub('body'), { appendChild(el){ sandbox.__lastChild = el; } }),
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
vm.runInContext(src, sandbox, { filename: 'video-8511.js' });

let pass = 0, fail = 0;
function ok(name, cond, extra){
  if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

const MUX = (itag, h) => ({ itag, mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', url: 'u' + itag, contentLength: '9000000', height: h });
const ADA = (itag, h) => ({ itag, mimeType: 'video/mp4; codecs="avc1.4d401f"', url: 'a' + itag, contentLength: '6000000', height: h });
function answer(formats, adaptive){
  return () => Promise.resolve({ videoDetails: { title: 'Matched Video', lengthSeconds: 209 },
    streamingData: { formats, adaptiveFormats: adaptive } });
}

(async () => {
  // the button that is drawn, not borrowed
  sandbox.scVideoBuild();
  const markup = (sandbox.__lastChild && sandbox.__lastChild._html) || '';
  ok('the waiting button is the drawn one', markup.includes('scVgrad'), markup.slice(0, 60));
  ok('it has a ripple of its own', /scVripple/.test(css.text));
  ok('the transport play triangle is drawn too', /scVideoPlay/.test(css.text) && !/border-left/.test(css.text));

  console.log('the video carries its own sound');
  sandbox.scHttpJson = answer([MUX(18, 360)], [ADA(136, 720)]);
  audio.currentTime = 64;
  await sandbox.scVideoLoad({ videoId: 'v1', title: 'Song', owner: 'Artist' });
  await new Promise(r => setTimeout(r, 20));
  ok('a muxed stream picks video sound', sandbox.scVideoState.audioMode === 'video', sandbox.scVideoState.audioMode);
  ok('the element is unmuted', video.muted === false);
  ok('the song is paused underneath', audio.paused === true);
  ok('the song position is remembered', sandbox.scVideoState.songWasPlaying === true);
  ok('the picture starts where the song was', sandbox.scVideoState.startAt === 64, sandbox.scVideoState.startAt);
  ok('it is playing', video.paused === false);
  ok('the round button reads PAUSE', els.scVideoPlay['attr_aria-label'] === 'Pause', els.scVideoPlay['attr_aria-label']);

  // pause stops the picture (and with it the only sound), the song stays parked
  sandbox.scVideoTap();
  ok('PAUSE stops the picture', video.paused === true);
  ok('PAUSE does not start the song behind it', audio.paused === true);
  ok('the waiting button comes back', els.scVideoBig.classList.contains('on'));
  sandbox.scVideoTap();
  await new Promise(r => setTimeout(r, 20));
  ok('PLAY starts the picture again', video.paused === false);

  // closing hands the song back at the second the video stopped on
  video.currentTime = 95;
  audio.paused = true;
  const plays = audio.plays;
  sandbox.scVideoReleaseSong();
  ok('the song resumes where the video was', audio.currentTime === 95, audio.currentTime);
  ok('the song is actually started', audio.plays === plays + 1 && audio.paused === false);

  console.log('a stream with no audio track');
  sandbox.scHttpJson = answer([], [ADA(134, 360)]);
  audio.currentTime = 12;
  await sandbox.scVideoLoad({ videoId: 'v2', title: 'Song', owner: 'Artist' });
  await new Promise(r => setTimeout(r, 20));
  ok('it falls back to the song as the soundtrack', sandbox.scVideoState.audioMode === 'song');
  ok('the element stays muted', video.muted === true);
  ok('the footer says so', /song plays under the picture/.test(els.scVideoFoot._text), els.scVideoFoot._text);

  console.log('the video is matched to the song');
  audio.duration = 210;
  const ranked = sandbox.scVideoRank([
    { videoId: 'live', title: 'Song (Live at the Roundhouse)', owner: 'Artist', duration: 262 },
    { videoId: 'cover', title: 'Song - cover', owner: 'Somebody Else', duration: 208 },
    { videoId: 'right', title: 'Song (Official Video)', owner: 'Artist', duration: 209 },
    { videoId: 'far', title: 'Song', owner: 'Artist', duration: 400 }
  ], { title: 'Song', artist: 'Artist' });
  ok('the length-matched official video comes first', ranked[0].videoId === 'right', ranked.map(r => r.videoId).join(','));
  ok('a four-minute-away take is dropped', !ranked.some(r => r.videoId === 'far'), ranked.map(r => r.videoId).join(','));

  const unknown = sandbox.scVideoRank([{ videoId: 'x', title: 'Song', owner: 'Artist' }], { title: 'Song', artist: 'Artist' });
  ok('a candidate with no length is still usable', unknown.length === 1 && unknown[0].videoId === 'x');

  console.log('the refusals still speak');
  audio.pause();
  video.refuse = 'NotAllowedError';
  sandbox.scVideoAttach('https://x/v.mp4', 'direct');
  await new Promise(r => setTimeout(r, 20));
  ok('a blocked start shows the drawn button', els.scVideoBig.classList.contains('on'));
  ok('and names the refusal', /NotAllowedError/.test(els.scVideoSay._text), els.scVideoSay._text);
  video.refuse = null;

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
