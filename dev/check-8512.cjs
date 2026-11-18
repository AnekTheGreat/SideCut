// 85.1.2 harness - the module that ships, against a stubbed DOM.
// The questions this answers: does the answer build a ladder out of every size
// it really carries, does a higher size keep the video's own soundtrack, is the
// choice remembered, does a refused size fall back instead of going black, and
// does the landscape button turn the stage rather than the browser's player.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'video-8512.js'), 'utf8');

function stub(id){
  return {
    id, style: {}, _html: '', _text: '',
    classList: { s: new Set(),
      add(c){ this.s.add(c); }, remove(c){ this.s.delete(c); },
      toggle(c, on){ if(on) this.s.add(c); else this.s.delete(c); },
      contains(c){ return this.s.has(c); } },
    addEventListener(){}, setAttribute(k, v){ this['attr_' + k] = v; },
    getAttribute(k){ return this['attr_' + k]; },
    removeAttribute(){},
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

function mediaEl(id){
  const a = stub(id);
  a._src = ''; a.paused = true; a.currentTime = 0; a.readyState = 1; a.volume = 1; a.muted = false;
  Object.defineProperty(a, 'src', { get(){ return this._src; }, set(x){ this._src = x; } });
  a.load = function(){};
  a.play = function(){ this.paused = false; return Promise.resolve(); };
  a.pause = function(){ this.paused = true; };
  return a;
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
 'scVideoNext','scVideoFoot','scVideoChip','scVideoTitle','scVideoSub',
 'scVideoLand','scVideoQ','scVideoQList','scVideoQNote'].forEach(id => { els[id] = stub(id); });
const video = videoEl(), aux = mediaEl('scVideoAuxEl'), audio = audioEl();
els.scVideoEl = video;
els.scVideoAuxEl = aux;

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
vm.runInContext(src, sandbox, { filename: 'video-8512.js' });

let pass = 0, fail = 0;
function ok(name, cond, extra){
  if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
const wait = (ms) => new Promise(r => setTimeout(r, ms || 20));

const MUX = (itag, h) => ({ itag, mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', url: 'u' + itag, contentLength: '9000000', height: h, bitrate: 800000 });
const ADA = (itag, h, codec) => ({ itag, mimeType: 'video/mp4; codecs="' + (codec || 'avc1.640028') + '"', url: 'a' + itag, contentLength: '24000000', height: h, bitrate: 4000000 });
const AUD = { itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', url: 'snd', contentLength: '2500000', bitrate: 128000 };
function answer(formats, adaptive){
  return () => Promise.resolve({ videoDetails: { title: 'Matched Video', lengthSeconds: 209 },
    streamingData: { formats, adaptiveFormats: adaptive } });
}

(async () => {
  sandbox.scVideoBuild();
  const markup = (sandbox.__lastChild && sandbox.__lastChild._html) || '';
  console.log('the controls this release draws');
  ok('the waiting button is the drawn one', markup.includes('scVgrad'), markup.slice(0, 60));
  ok('it has a ripple of its own', /scVripple/.test(css.text));
  ok('the size in the header is a button', /class="sv-chip" id="scVideoChip"/.test(markup));
  ok('there is a quality card', /id="scVideoQList"/.test(markup) && /QUALITY/.test(markup));
  ok('the landscape button replaced FULL', /id="scVideoLand"/.test(markup) && !/id="scVideoFull"/.test(markup));
  ok('the paired soundtrack element exists', /id="scVideoAuxEl"/.test(markup));
  ok('landscape has a layout of its own', /sc-vwide #scVideoStage\{position:fixed/.test(css.text));
  els.scVideoBackdrop = stub('scVideoBackdrop');
  els.scVideoStage = stub('scVideoStage');

  console.log('the ladder is read out of the answer');
  sandbox.scHttpJson = answer(
    [MUX(18, 360), MUX(22, 720)],
    [ADA(133, 240), ADA(134, 360), ADA(135, 480), ADA(136, 720, 'vp09.00.51.08'),
     ADA(137, 1080), ADA(299, 1080, 'av01.0.08M.08'), ADA(308, 1440, 'vp09.00.51.08'),
     ADA(313, 2160, 'av01.0.13M.08'), AUD]
  );
  await sandbox.scVideoLoad({ videoId: 'v1', title: 'Song', owner: 'Artist' });
  await wait();
  const rungs = sandbox.scVideoState.rungs;
  const r720 = rungs.find(r => r.h === 720), r1080 = rungs.find(r => r.h === 1080);
  ok('every height the video has is a rung', rungs.map(r => r.h).join(',') === '2160,1440,1080,720,480,360,240', rungs.map(r => r.h).join(','));
  ok('a one-stream row wins its own height', !!r720 && r720.muxed === true);
  ok('a higher size takes the codec the phone can open', !!r1080 && r1080.codec === 'H.264', r1080 && r1080.codec);
  ok('a higher size carries the video own soundtrack', !!r1080 && r1080.audioUrl === 'snd', r1080 && r1080.audioUrl);
  ok('the runner-up codec is kept as an alternate', !!r1080 && r1080.alts.some(a => /av01/.test(a.mime)));
  ok('AUTO is the best stream with its own sound', sandbox.scVideoState.rung.h === 720, sandbox.scVideoState.rung.h);
  ok('the header says the size', els.scVideoChip._text === '720p', els.scVideoChip._text);
  ok('AUTO is unmuted and the song is parked', video.muted === false && audio.paused === true);

  sandbox.scVideoQualityToggle(true);
  const listHtml = els.scVideoQList._html || '';
  ok('the list offers AUTO and every size this video has', /AUTO/.test(listHtml) && /1080p/.test(listHtml) && /2160p/.test(listHtml));
  ok('a size the video does not have is not listed', !/4320p/.test(listHtml));
  ok('AUTO is the one marked', /sv-qr cur" data-h="0"/.test(listHtml), listHtml.slice(0, 80));
  sandbox.scVideoQualityToggle(false);

  console.log('a higher size keeps the video own soundtrack');
  const store = new Map();
  sandbox.localStorage = {
    getItem(k){ return store.has(k) ? store.get(k) : null; },
    setItem(k, v){ store.set(k, String(v)); },
    removeItem(k){ store.delete(k); }
  };
  video.currentTime = 33;
  sandbox.scVideoQualityChoose(1080);
  await wait();
  ok('choosing 1080p switches the picture', sandbox.scVideoState.rung.h === 1080);
  ok('the higher size plays its own soundtrack', sandbox.scVideoState.audioMode === 'aux');
  ok('the picture is muted while its track plays', video.muted === true);
  ok('the soundtrack row is attached', aux.src === 'snd', aux.src);
  ok('the second the picture was on is kept', sandbox.scVideoState.startAt === 33, sandbox.scVideoState.startAt);
  ok('the header follows the picture', els.scVideoChip._text === '1080p', els.scVideoChip._text);
  ok('the choice is remembered', store.get('scVideoQuality') === '1080', store.get('scVideoQuality'));

  await sandbox.scVideoLoad({ videoId: 'v1', title: 'Song', owner: 'Artist' });
  await wait();
  ok('the next video opens at the remembered size', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);

  sandbox.scVideoQualityChoose(4320);
  await wait();
  ok('a size the video lacks falls to the nearest smaller one', sandbox.scVideoState.rung.h === 2160, sandbox.scVideoState.rung.h);

  sandbox.scVideoQualityChoose(0);
  await wait();
  ok('AUTO returns to the one-stream size', sandbox.scVideoState.rung.h === 720 && sandbox.scVideoState.audioMode === 'video');

  console.log('a refused size falls back, and says so');
  sandbox.scVideoQualityChoose(2160);
  await wait();
  video.error = { code: 4 };
  sandbox.scVideoFailed();
  await wait();
  ok('it falls back to the best one-stream size', sandbox.scVideoState.rung.h === 720, sandbox.scVideoState.rung.h);
  ok('and says on the footer which size it went back to', /Now at 720p/.test(els.scVideoFoot._text), els.scVideoFoot._text);
  ok('the fallback gets the sound back with it', sandbox.scVideoState.audioMode === 'video' && video.muted === false);
  video.error = null;

  console.log('the landscape button turns the stage, not the browser');
  sandbox.scVideoLandscape();
  ok('the stage goes full-bleed', els.scVideoBackdrop.classList.contains('sc-vwide'));
  ok('the button marks itself', els.scVideoLand.classList.contains('on'));
  sandbox.scVideoLandscape();
  ok('tapping it again goes back to portrait', !els.scVideoBackdrop.classList.contains('sc-vwide'));

  console.log('closing hands the song back from a paired track too');
  sandbox.scHttpJson = answer([MUX(18, 360)], [ADA(137, 1080), AUD]);
  await sandbox.scVideoLoad({ videoId: 'v3', title: 'Song', owner: 'Artist' });
  await wait();
  sandbox.scVideoQualityChoose(1080);
  await wait();
  sandbox.scVideoState.songWasPlaying = true;
  video.currentTime = 95;
  audio.paused = true;
  const plays = audio.plays;
  sandbox.scVideoReleaseSong();
  ok('the song resumes where the picture was', audio.currentTime === 95, audio.currentTime);
  ok('the song is actually started', audio.plays === plays + 1 && audio.paused === false);

  console.log('a stream with no audio track at all');
  sandbox.scHttpJson = answer([], [ADA(134, 360)]);
  await sandbox.scVideoLoad({ videoId: 'v2', title: 'Song', owner: 'Artist' });
  await wait();
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

  console.log('the refusals still speak');
  audio.pause();
  video.refuse = 'NotAllowedError';
  sandbox.scVideoAttach('https://x/v.mp4', 'direct');
  await wait();
  ok('a blocked start shows the drawn button', els.scVideoBig.classList.contains('on'));
  ok('and names the refusal', /NotAllowedError/.test(els.scVideoSay._text), els.scVideoSay._text);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
