// 85.3.2 harness - the module that ships, against a stubbed DOM.
//
// The 85.2.5 set asks whether a viewer who never opened the size list opens at FULL
// HD, whether a video without 1080p opens at the size under it and says so, whether
// AUTO is still a kept choice, and whether the 85.2.1 sound lock is still exactly one
// audible element following the picture. 85.2.3/85.2.4 ask whether a busy signal and
// an error with nothing behind it keep the size. 85.2.6/85.2.7 ask whether a refused
// height is marked, a clip opens on the song's second, the tab follows the queue, a
// song with no video shows its cover, and a lookup for a song the queue left is
// dropped. 85.3.0 asks whether a tap on the picture only brings the mini bar back and
// whether HD+ draws one clarity pass. 85.3.1 asks whether the app resolver's rows
// reach the ladder when a client answers short.
//
// This release asks three more: is the size list the real ladder - 144p, 240p, 360p,
// 480p, 720p, 1080p, 1440p, 2K and 4K - with every size the video has on it, is the
// app resolver asked for EVERY video so its rows win their own height, does a
// refusal step down one rung at a time instead of jumping to the smallest, and is a
// refused height forgotten by the next video? And does a tap on a stopped picture
// open the bar instead of starting it?
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'video-8532.js'), 'utf8');

function stub(id){
  return {
    id, style: {}, _html: '', _text: '', _ev: {}, _rect: null,
    classList: { s: new Set(),
      add(c){ this.s.add(c); }, remove(c){ this.s.delete(c); },
      toggle(c, on){ if(on) this.s.add(c); else this.s.delete(c); },
      contains(c){ return this.s.has(c); } },
    addEventListener(t, fn){ (this._ev[t] = this._ev[t] || []).push(fn); },
    setAttribute(k, v){ this['attr_' + k] = v; },
    getAttribute(k){ return this['attr_' + k]; },
    removeAttribute(){},
    setPointerCapture(){}, releasePointerCapture(){},
    getBoundingClientRect(){ return this._rect || { left: 0, top: 0, width: 0, height: 0 }; },
    get innerHTML(){ return this._html; }, set innerHTML(v){ this._html = v; },
    get textContent(){ return this._text; }, set textContent(v){ this._text = v; }
  };
}
function fire(el, type, ev){
  const list = (el._ev[type] || []).slice();
  const e = Object.assign({ target: el, preventDefault(){}, stopPropagation(){} }, ev || {});
  list.forEach(fn => fn(e));
  return list.length;
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
  // A real load drops the frame, the clock and the duration, and the clock comes
  // back at zero - which is exactly what used to lose the second a size change
  // was on.
  v.load = function(){ this.loads++; this.currentTime = 0; this.readyState = 1; this.duration = 210; };
  v.play = function(){
    if(this.refuse){ const e = new Error('blocked'); e.name = this.refuse; this.paused = true; return Promise.reject(e); }
    this.paused = false; this.readyState = 3; return Promise.resolve();
  };
  v.pause = function(){ this.paused = true; };
  return v;
}

function mediaEl(id){
  const a = stub(id);
  a._src = ''; a.paused = true; a.currentTime = 0; a.duration = NaN;
  a.readyState = 1; a.volume = 1; a.muted = true;
  a.plays = 0; a.pauses = 0; a.loads = 0;
  Object.defineProperty(a, 'src', {
    get(){ return this._src; },
    set(x){ this._src = x; }
  });
  a.removeAttribute = function(){ this._src = ''; };
  a.load = function(){ this.loads++; this.currentTime = 0; this.duration = NaN; this.readyState = 0; };
  a.play = function(){ this.plays++; this.paused = false; return Promise.resolve(); };
  a.pause = function(){ this.pauses++; this.paused = true; };
  return a;
}

function audioEl(){
  const a = stub('songAudio');
  a._src = 'blob:song'; a.paused = false; a.currentTime = 0; a.duration = 210;
  a.readyState = 4; a.volume = 1; a.muted = false; a.plays = 0; a.pauses = 0;
  a.play = function(){ this.plays++; this.paused = false; return Promise.resolve(); };
  a.pause = function(){ this.pauses++; this.paused = true; };
  return a;
}

const els = {};
['scVideoPlay','scVideoClock','scVideoFill','scVideoThumb','scVideoProg','scVideoBig','scVideoBack',
 'scVideoSay','scVideoSpin','scVideoNext','scVideoFoot','scVideoChip','scVideoTitle',
 'scVideoSub','scVideoLand','scVideoQ','scVideoQList','scVideoQNote','scVideoQHead',
 'scVideoCover','scVideoCoverBg','scVideoCoverImg','scVideoCoverTxt'].forEach(id => { els[id] = stub(id); });
const video = videoEl(), aux = mediaEl('scVideoAuxEl'), audio = audioEl();
els.scVideoEl = video;
els.scVideoAuxEl = aux;

const css = { text: '' };
// The upscaler draws into canvases, so a canvas here records what it was asked to do.
const canvases = [];
function canvas2d(cv){
  return { calls: [], globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', fillStyle: '',
    imageSmoothingEnabled: false, imageSmoothingQuality: '',
    fillRect(){ this.calls.push('fill'); },
    clearRect(){ this.calls.push('clear'); },
    drawImage(){ this.calls.push('draw:' + this.globalCompositeOperation); } };
}
const sandbox = {
  console,
  document: {
    getElementById(id){ return els[id] || null; },
    createElement(tag){ const e = stub(tag); if(tag === 'style'){ Object.defineProperty(e, 'textContent', { get(){ return css.text; }, set(v){ css.text = v; } }); }
      if(tag === 'canvas'){ e.width = 2; e.height = 2; e.ctx = canvas2d(e); e.getContext = function(){ return e.ctx; }; canvases.push(e); }
      return e; },
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
vm.runInContext(src, sandbox, { filename: 'video-8532.js' });

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
  // The stage and the HD+ button exist before the tab is built, because the tab wires
  // its tap and its upscaler to them once and the assertions below use those handlers.
  els.scVideoStage = stub('scVideoStage');
  els.scVideoStage.appendChild = function(){};
  els.scVideoBoost = stub('scVideoBoost');
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
  ok('the size chip keeps its own width and height', /sv-chip\{display:inline-flex[^}]*width:auto;height:auto/.test(css.text));
  ok('the chip chevron turns while the list is open', /sv-chip\.on::after\{transform:[^}]*rotate\(-135deg\)/.test(css.text));
  ok('the wide header keeps its controls on the right', /sc-vwide #scVideoHead\{[^}]*justify-content:flex-end/.test(css.text));
  ok('the soundtrack keeps a box in the page', /#scVideoAuxEl\{position:absolute[^}]*width:1px;height:1px/.test(css.text));
  ok('the progress line has a dot to drag', /id="scVideoThumb"/.test(markup) && /#scVideoThumb\{position:absolute/.test(css.text));
  ok('the progress line has a 26px touch area', /#scVideoProg::before\{content:"";position:absolute;left:-6px/.test(css.text));
  ok('the dragging line does not ease behind the finger', /#scVideoProg\.sc-vseek #scVideoFill\{transition:none\}/.test(css.text));
  ok('the transport can leave the glass in landscape', /sc-vwide\.sc-vidle #scVideoCtl\{opacity:0;pointer-events:none/.test(css.text));
  ok('the title row and the chip leave with it', /sc-vwide\.sc-vidle #scVideoHead\{opacity:0/.test(css.text));
  ok('the scrim fades with the transport', /sc-vwide\.sc-vidle #scVideoStage::after\{opacity:0\}/.test(css.text));
  ok('the transport has a scrim to sit on', /#scVideoStage::after\{content:""[^}]*linear-gradient\(0deg, rgba\(0,0,0,\.62\)/.test(css.text));
  els.scVideoBackdrop = stub('scVideoBackdrop');
  // the stage is the one made before the build, so the tap handler is on the element
  // the assertions click

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
  console.log('a viewer who has never chosen opens at FULL HD');
  ok('nothing stored means 1080p, not AUTO', sandbox.scVideoWant() === 1080, sandbox.scVideoWant());
  ok('the picture opens at 1080p', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  ok('the header says the size', els.scVideoChip._text === '1080p', els.scVideoChip._text);
  ok('a video without 1080p opens at the size under it', sandbox.scVideoRungFor(rungs.filter(r => r.h !== 1080), 1080).h === 720);
  ok('the step under 1080p is 720p', sandbox.scVideoRungBelow(rungs, 1080).h === 720, sandbox.scVideoRungBelow(rungs, 1080).h);
  ok('there is nothing under the smallest size', sandbox.scVideoRungBelow(rungs, 240) === null);
  ok('the sharp size is muted and its own track is the voice',
     video.muted === true && sandbox.scVideoState.audioMode === 'aux' && aux.src === 'snd',
     video.muted + '/' + sandbox.scVideoState.audioMode + '/' + aux.src);
  ok('the song is parked under it', audio.paused === true);

  sandbox.scVideoQualityToggle(true);
  const listHtml = els.scVideoQList._html || '';
  ok('the list offers AUTO and every size this video has',
     /AUTO/.test(listHtml) && /1080p/.test(listHtml) && /1440p/.test(listHtml) && /4K/.test(listHtml));
  ok('a size the video does not have is not listed', !/4320p/.test(listHtml));
  ok('1080p is the one marked', /sv-qr cur" data-h="1080"/.test(listHtml), listHtml.slice(0, 120));
  ok('and the row says it is the default', /default/.test(listHtml));
  ok('AUTO explains itself in plain words', /the best one-stream size for this phone/.test(listHtml));
  sandbox.scVideoQualityToggle(false);

  console.log('a higher size keeps the second, and the song with it');
  const store = new Map();
  sandbox.localStorage = {
    getItem(k){ return store.has(k) ? store.get(k) : null; },
    setItem(k, v){ store.set(k, String(v)); },
    removeItem(k){ store.delete(k); }
  };
  sandbox.scVideoQualityChoose(0);            // AUTO first, so the switch below is a real one
  await wait();
  ok('AUTO is the one-stream size, and is stored as a choice',
     sandbox.scVideoState.rung.h === 720 && store.get('scVideoQuality') === 'auto',
     sandbox.scVideoState.rung.h + '/' + store.get('scVideoQuality'));
  store.set('scVideoQuality', '720');
  ok('a stored size is the size the tab opens at', sandbox.scVideoWant() === 720, sandbox.scVideoWant());
  store.set('scVideoQuality', 'auto');
  ok('AUTO is not mistaken for a fresh install', sandbox.scVideoWant() === 0, sandbox.scVideoWant());
  store.delete('scVideoQuality');
  ok('and nothing stored is FULL HD again', sandbox.scVideoWant() === 1080, sandbox.scVideoWant());
  video.currentTime = 33;
  sandbox.scVideoQualityChoose(1080);
  await wait();
  ok('choosing 1080p switches the picture', sandbox.scVideoState.rung.h === 1080);
  ok('the higher size plays its own soundtrack', sandbox.scVideoState.audioMode === 'aux');
  ok('the picture is muted while its track plays', video.muted === true);
  ok('the soundtrack row is attached', aux.src === 'snd', aux.src);
  ok('the second the picture was on is kept', sandbox.scVideoState.startAt === 33, sandbox.scVideoState.startAt);
  ok('the picture is still on that second after the load', video.currentTime === 33, video.currentTime);
  ok('the header follows the picture', els.scVideoChip._text === '1080p', els.scVideoChip._text);
  ok('the choice is remembered', store.get('scVideoQuality') === '1080', store.get('scVideoQuality'));
  ok('the soundtrack waits silently for its own duration', aux.muted === true && sandbox.scVideoState.posing === true);

  console.log('the soundtrack is posed onto the picture, not the picture onto it');
  aux.readyState = 1; aux.duration = 209;
  fire(aux, 'loadedmetadata');
  ok('the soundtrack starts on the picture second', aux.currentTime === 33, aux.currentTime);
  const auxPlays = aux.plays;
  fire(aux, 'canplay');
  ok('and is heard once it is there', aux.muted === false && aux.plays === auxPlays + 1, aux.muted + '/' + aux.plays);
  video.currentTime = 40; aux.currentTime = 0;
  sandbox.scVideoSync(false);
  ok('a drifted soundtrack is pulled onto the picture', aux.currentTime === 40, aux.currentTime);
  ok('the picture is not moved by it', video.currentTime === 40, video.currentTime);

  await sandbox.scVideoLoad({ videoId: 'v1', title: 'Song', owner: 'Artist' });
  await wait();
  ok('the next video opens at the remembered size', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);

  sandbox.scVideoQualityChoose(4320);
  await wait();
  ok('a size the video lacks falls to the nearest smaller one', sandbox.scVideoState.rung.h === 2160, sandbox.scVideoState.rung.h);

  sandbox.scVideoQualityChoose(0);
  await wait();
  ok('AUTO returns to the one-stream size', sandbox.scVideoState.rung.h === 720 && sandbox.scVideoState.audioMode === 'video');

  console.log('a size change is not a play button');
  video.paused = true;
  video.currentTime = 61;
  sandbox.scVideoQualityChoose(1080);
  await wait();
  ok('a paused picture stays paused', video.paused === true);
  ok('and shows the drawn button instead of playing', els.scVideoBig.classList.contains('on'));
  ok('while still holding its second', video.currentTime === 61, video.currentTime);
  video.paused = false;

  console.log('a refused size steps down one, and keeps the choice');
  sandbox.scVideoQualityChoose(2160);
  await wait();
  video.error = { code: 4 };
  sandbox.scVideoFailed();
  await wait();
  ok('a refused 4K becomes the size under it, not the smallest', sandbox.scVideoState.rung.h === 1440, sandbox.scVideoState.rung.h);
  ok('and says on the footer which size it went to', /Now at 1440p/.test(els.scVideoFoot._text), els.scVideoFoot._text);
  ok('the size that was chosen is not forgotten', sandbox.scVideoState.want === 2160, sandbox.scVideoState.want);
  sandbox.scVideoFailed();
  await wait();
  ok('a second refusal takes the next rung down, not the one-stream row',
     sandbox.scVideoState.rung.h === 1080 && sandbox.scVideoState.audioMode === 'aux',
     sandbox.scVideoState.rung.h + '/' + sandbox.scVideoState.audioMode);
  ok('and the picture keeps its own track as the sound', video.muted === true);
  video.error = null;
  sandbox.scVideoQualityChoose(1080);
  await wait();
  ok('picking a size by hand starts the road again', sandbox.scVideoState.drops === 0, sandbox.scVideoState.drops);

  console.log('a dropped connection is not a wrong size');
  sandbox.scVideoQualityChoose(1080);
  await wait();
  video.currentTime = 84;
  video.error = { code: 2 };                 // MEDIA_ERR_NETWORK
  const sameSrc = video.src;
  sandbox.scVideoFailed();
  await wait();
  ok('a network drop does not change the size', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  ok('it restarts the same source', video.src === sameSrc && sandbox.scVideoState.retries === 1, video.src);
  ok('on the second the picture was on', sandbox.scVideoState.startAt === 84, sandbox.scVideoState.startAt);
  ok('and names the connection, not the size', /connection dropped/.test(els.scVideoFoot._text), els.scVideoFoot._text);
  sandbox.scVideoState.alts = [];            // a size with no other codec to try
  sandbox.scVideoState.alt = 0;
  sandbox.scVideoFailed();
  await wait();
  ok('a second drop walks one step down, not to the floor', sandbox.scVideoState.rung.h === 720, sandbox.scVideoState.rung.h);
  video.error = null;

  console.log('a slow start is not a dead source');
  ok('a 24 MB picture gets sixteen seconds, not nine', sandbox.scVideoWatchMs(24 * 1048576) === 16200, sandbox.scVideoWatchMs(24 * 1048576));
  ok('and nothing waits longer than twenty-one', sandbox.scVideoWatchMs(400 * 1048576) === 21000, sandbox.scVideoWatchMs(400 * 1048576));
  sandbox.SC_VQ_WATCH_MS = 25; sandbox.SC_VQ_WATCH_PER_MB = 0;
  sandbox.scHttpJson = answer([MUX(18, 360)], [ADA(134, 360), ADA(136, 720), ADA(137, 1080), AUD]);
  await sandbox.scVideoLoad({ videoId: 'v13', title: 'Song', owner: 'Artist' });
  await wait();
  ok('the picture is 1080p again', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  video.paused = false; video.readyState = 1; video.currentTime = 0;
  video.buffered = { length: 1, end(){ return 0.6; } };
  video.networkState = 2;                    // NETWORK_LOADING
  sandbox.scVideoWatch();
  await wait(70);
  ok('a picture that is buffering keeps its size', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  video.buffered = { length: 0, end(){ return 0; } };
  video.networkState = 3;                    // NETWORK_NO_SOURCE
  sandbox.scVideoWatch();
  await wait(70);
  ok('a picture that has stopped with nothing buffered steps down one', sandbox.scVideoState.rung.h === 720, sandbox.scVideoState.rung.h);

  console.log('an error for a source that is already gone is not a refusal');
  sandbox.scVideoQualityChoose(1080);
  await wait();
  ok('the picture is 1080p to start with', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  video.error = null;                        // the element cleared it with the new source
  sandbox.scVideoFailed();                   // what a queued abort looks like
  await wait();
  ok('an error with no MediaError changes nothing', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  ok('and says nothing on the footer', els.scVideoFoot._text === '' || !/did not play here/.test(els.scVideoFoot._text), els.scVideoFoot._text);
  const wasOn = video.src;
  video.error = { code: 4 };
  video._src = 'https://example.invalid/replaced.mp4';   // the element is on another source
  sandbox.scVideoFailed();
  await wait();
  ok('an error for a replaced source changes nothing either', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  video._src = wasOn;
  sandbox.scVideoFailed();
  await wait();
  ok('a real refusal still steps down', sandbox.scVideoState.rung.h === 720, sandbox.scVideoState.rung.h);
  ok('and names the size and codec that refused it', /1080p H\.264/.test(els.scVideoFoot._text), els.scVideoFoot._text);
  video.error = null;

  console.log('the landscape transport steps aside');
  sandbox.SC_VQ_IDLE_MS = 25;
  video.paused = false;
  sandbox.scVideoLandscape();
  ok('the stage goes full-bleed', els.scVideoBackdrop.classList.contains('sc-vwide'));
  ok('the button marks itself', els.scVideoLand.classList.contains('on'));
  sandbox.scVideoIdleArm();
  await wait(70);
  ok('two seconds of quiet leave the transport away', els.scVideoBackdrop.classList.contains('sc-vidle'));
  ok('a tap reports that it was asleep', sandbox.scVideoIdleWake() === true);
  ok('and brings the transport back', !els.scVideoBackdrop.classList.contains('sc-vidle'));
  video.paused = true;
  sandbox.scVideoIdleArm();
  await wait(70);
  ok('a paused picture keeps its controls', !els.scVideoBackdrop.classList.contains('sc-vidle'));
  video.paused = false;
  sandbox.scVideoLandscape();
  ok('tapping the button again goes back to portrait', !els.scVideoBackdrop.classList.contains('sc-vwide'));

  console.log('the progress line is a handle');
  els.scVideoProg._rect = { left: 0, top: 0, width: 200, height: 4 };
  video.currentTime = 0;
  fire(els.scVideoProg, 'pointerdown', { clientX: 100 });
  ok('a press halfway seeks halfway', Math.abs(video.currentTime - 105) < 1.5, video.currentTime);
  ok('and the line follows the finger at once', els.scVideoFill.style.width === '50%', els.scVideoFill.style.width);
  fire(els.scVideoProg, 'pointermove', { clientX: 50 });
  ok('a drag keeps seeking', Math.abs(video.currentTime - 52.5) < 1.5, video.currentTime);
  fire(els.scVideoProg, 'pointerup', { clientX: 50 });
  ok('and the drag ends with the picture on that second', !sandbox.scVideoState.scrubbing && Math.abs(video.currentTime - 52.5) < 1.5, video.currentTime);

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
  sandbox.scVideoQualityToggle(true);
  ok('the size list says why it is not 1080p', /no 1080p - it tops out at 360p/.test(els.scVideoQNote._text), els.scVideoQNote._text);
  sandbox.scVideoQualityToggle(false);

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

  console.log('the voice waits for the frame');
  sandbox.scHttpJson = answer([MUX(18, 360)], [ADA(137, 1080), AUD]);
  await sandbox.scVideoLoad({ videoId: 'v9', title: 'Song', owner: 'Artist' });
  await wait();
  sandbox.scVideoQualityChoose(0);            // AUTO, the one-stream size
  await wait();
  video.currentTime = 12;                      // the frame the size change happens on
  sandbox.scVideoQualityChoose(1080);
  await wait();
  ok('the size change happened on 1080p', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  video.paused = false; video.readyState = 3;
  aux.readyState = 1; aux.duration = 209; aux.currentTime = 0;
  fire(aux, 'loadedmetadata');
  ok('the voice is posed on the frame second', aux.currentTime === 12, aux.currentTime);
  ok('and stays silent until the frame is running', aux.muted === true);
  const p0 = aux.plays;
  video.paused = true;
  fire(aux, 'canplay');
  ok('a still frame does not start the voice', aux.plays === p0 && aux.muted === true, aux.plays + '/' + aux.muted);
  video.paused = false;
  fire(aux, 'canplay');
  ok('a running frame starts it', aux.plays === p0 + 1, aux.plays);
  ok('on the frame second', aux.currentTime === 12, aux.currentTime);
  ok('and it is the only audible element', aux.muted === false && video.muted === true, aux.muted + '/' + video.muted);
  ok('the tab tells the app it owns the sound', sandbox.__scVideoSoundOwn === true, sandbox.__scVideoSoundOwn);

  console.log('a small drift is trimmed, a real gap is jumped');
  aux.currentTime = 12.2; aux.playbackRate = 1;
  sandbox.scVideoSync(false);
  ok('a fifth of a second is not a jump', Math.abs(aux.currentTime - 12.2) < 1e-6, aux.currentTime);
  ok('it is trimmed by rate instead', aux.playbackRate < 1 && aux.playbackRate >= 0.92, aux.playbackRate);
  aux.currentTime = 12; sandbox.scVideoSync(false);
  ok('and the rate returns to normal on the frame', aux.playbackRate === 1, aux.playbackRate);
  aux.currentTime = 3; sandbox.scVideoSync(false);
  ok('a real gap is jumped to the frame', aux.currentTime === 12, aux.currentTime);

  console.log('a pause, a buffer and a seek all move the voice');
  aux.currentTime = 12; aux.paused = false;
  video.paused = true;
  fire(video, 'pause');
  ok('a paused picture silences the soundtrack', aux.paused === true);
  video.paused = false; aux.paused = false;
  fire(video, 'waiting');
  // This harness runs the 85.3.x snapshot in dev/video-8532.js, not the shipped page: the
  // buffer-dip rule 85.6 changed is driven by dev/check-856.cjs and by the live gates.
  ok('a picture waiting for bytes silences it too', aux.paused === true);
  aux.paused = false;
  video.currentTime = 44; aux.currentTime = 12;
  fire(video, 'seeked');
  ok('a seek puts the voice on the new second', aux.currentTime === 44, aux.currentTime);

  console.log('one sound, and closing gives it back');
  sandbox.scVideoQualityChoose(0);
  await wait();
  ok('the one-stream size unmutes the picture', video.muted === false && sandbox.__scVideoSoundOwn === true);
  ok('the paired voice is muted again', aux.muted === true);
  sandbox.scHttpJson = answer([], [ADA(134, 360)]);
  await sandbox.scVideoLoad({ videoId: 'v10', title: 'Song', owner: 'Artist' });
  await wait();
  ok('a size with no audio gives the sound to the song', sandbox.__scVideoSoundOwn === false, sandbox.__scVideoSoundOwn);
  ok('and the song is the only thing unmuted', video.muted === true);

  sandbox.scHttpJson = answer([MUX(18, 360)], [ADA(137, 1080), AUD]);
  await sandbox.scVideoLoad({ videoId: 'v11', title: 'Song', owner: 'Artist' });
  await wait();
  sandbox.scVideoQualityChoose(1080);
  await wait();
  ok('a high size claims the sound', sandbox.__scVideoSoundOwn === true);
  video.currentTime = 70; sandbox.scVideoState.songWasPlaying = true; audio.paused = true;
  sandbox.scVideoClose();
  ok('closing gives the sound back before the song resumes',
     sandbox.__scVideoSoundOwn === false && audio.paused === false, sandbox.__scVideoSoundOwn + '/' + audio.paused);

  console.log('half a file is not a source');
  sandbox.scVideoState.deadH = {};        // this block is about the URL, not the default
  ok('a range on a URL is removed', sandbox.scVideoNoRange('https://h/v?itag=137&range=0-1023&mime=video%2Fmp4') === 'https://h/v?itag=137&mime=video%2Fmp4', sandbox.scVideoNoRange('https://h/v?itag=137&range=0-1023&mime=video%2Fmp4'));
  ok('a trailing range is removed too', sandbox.scVideoNoRange('https://h/v?itag=137&range=0-1023') === 'https://h/v?itag=137', sandbox.scVideoNoRange('https://h/v?itag=137&range=0-1023'));
  ok('a URL with no range is not touched', sandbox.scVideoNoRange('https://h/v?itag=18') === 'https://h/v?itag=18');
  const RANGED = { itag: 137, mimeType: 'video/mp4; codecs="avc1.640028"', url: 'https://h/v?itag=137&range=0-1023&mime=video%2Fmp4', contentLength: '24000000', height: 1080, bitrate: 4000000 };
  sandbox.scHttpJson = answer([MUX(18, 360)], [RANGED, AUD]);
  await sandbox.scVideoLoad({ videoId: 'v20', title: 'Song', owner: 'Artist' });
  await wait();
  ok('the element is given a source without a range', !/[?&]range=/.test(sandbox.scVideoState.rung.url), sandbox.scVideoState.rung.url);
  ok('and the rest of the URL survives', /itag=137/.test(sandbox.scVideoState.rung.url) && /mime=/.test(sandbox.scVideoState.rung.url), sandbox.scVideoState.rung.url);
  ok('the paired track is cleaned the same way', !/[?&]range=/.test(sandbox.scVideoState.rung.audioUrl), sandbox.scVideoState.rung.audioUrl);

  console.log('the list says which build it is');
  sandbox.APP_VERSION = '85.2.5';
  sandbox.scVideoQualityToggle(true);
  ok('the quality card carries the version', /85\.2\.5/.test(els.scVideoQHead._text), els.scVideoQHead._text);
  sandbox.scVideoQualityToggle(false);

  console.log('the clip has to be this song');
  let searched = 0;
  sandbox.scYtSearch = function(){ searched++; return Promise.resolve([
    { videoId: 'right', title: 'Song (Official Video)', owner: 'Artist', duration: 209 },
    { videoId: 'right2', title: 'Song (Official Audio)', owner: 'Artist', duration: 210 },
    { videoId: 'live', title: 'Song (Live at the Roundhouse)', owner: 'Artist', duration: 262 }
  ]); };
  const byLen = (url, body) => Promise.resolve({
    videoDetails: { title: body && body.videoId === 'wrong' ? 'Some Other Clip' : 'Song (Official Video)', lengthSeconds: body && body.videoId === 'wrong' ? 262 : 209 },
    streamingData: { formats: [MUX(18, 360)], adaptiveFormats: [ADA(137, 1080), AUD] }
  });
  sandbox.scHttpJson = byLen;
  audio.duration = 210;
  sandbox.scVideoState.deadH = {};        // a fresh session: nothing refused yet
  await sandbox.scVideoStart({ videoId: 'wrong', title: 'Song', artist: 'Artist', duration: 210 });
  await wait();
  ok('a clip that is a minute too long is not trusted', searched === 1, searched);
  ok('the search result is what plays', sandbox.scVideoState.cands[0].videoId === 'right', sandbox.scVideoState.cands[0].videoId);
  ok('and its title is on the header', els.scVideoTitle._text === 'Song (Official Video)', els.scVideoTitle._text);
  ok('NEXT is available for it', els.scVideoNext.style.display === '' || els.scVideoNext.style.display === undefined, String(els.scVideoNext.style.display));
  searched = 0;
  await sandbox.scVideoStart({ videoId: 'right', title: 'Song', artist: 'Artist', duration: 210 });
  await wait();
  ok('a clip that matches is played as handed over', searched === 0, searched);
  ok('and it is on the picture', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);

  console.log('the refusals still speak');
  audio.pause();
  video.refuse = 'NotAllowedError';
  sandbox.scVideoAttach('https://x/v.mp4', 'direct');
  await wait();
  ok('a blocked start shows the drawn button', els.scVideoBig.classList.contains('on'));
  ok('and names the refusal', /NotAllowedError/.test(els.scVideoSay._text), els.scVideoSay._text);

  console.log('the size list only offers what plays');
  video.refuse = null;
  sandbox.scVideoState.deadH = {};
  sandbox.scHttpJson = answer([MUX(18, 360)],
    [ADA(137, 1080), ADA(136, 720), ADA(135, 480), ADA(134, 360), ADA(133, 240), AUD]);
  audio.currentTime = 0;
  await sandbox.scVideoLoad({ videoId: 'v30', title: 'Song', owner: 'Artist' });
  await wait();
  ok('a fresh video still opens at FULL HD', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  sandbox.scVideoState.alts = [];
  sandbox.scVideoState.alt = 0;
  video.error = { code: 4 };                 // every codec at this height is out
  sandbox.scVideoFailed();
  await wait();
  ok('a refused height is remembered', sandbox.scVideoState.deadH[1080] === 1, JSON.stringify(sandbox.scVideoState.deadH));
  ok('and the picture steps down one', sandbox.scVideoState.rung.h === 720, sandbox.scVideoState.rung.h);
  sandbox.scVideoQualityToggle(true);
  const l2 = els.scVideoQList._html || '';
  ok('the refused height is marked in the list', /class="sv-qr off" data-h="1080"/.test(l2), l2.slice(0, 160));
  ok('and says it did not play here', /did not play here/.test(l2.replace(/<[^>]+>/g, ' ')), l2.replace(/<[^>]+>/g, ' ').slice(0, 200));
  ok('the small sizes are offered too', /240p/.test(l2), l2.replace(/<[^>]+>/g, ' '));
  ok('the sizes that do play are still offered', /720p/.test(l2) && /480p/.test(l2) && /360p/.test(l2));
  sandbox.scVideoQualityToggle(false);
  video.error = null;
  await sandbox.scVideoLoad({ videoId: 'v31', title: 'Song', owner: 'Artist' });
  await wait();
  ok('a new video tries the refused height again', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  ok('and the refusal does not follow it into that video',
     Object.keys(sandbox.scVideoState.deadH).length === 0, JSON.stringify(sandbox.scVideoState.deadH));

  console.log('the picture opens where the song is');
  sandbox.scHttpJson = answer([MUX(18, 360)], [ADA(137, 1080), AUD]);
  audio.currentTime = 92;
  await sandbox.scVideoLoad({ videoId: 'v40', title: 'Song', owner: 'Artist' });
  await wait();
  ok('the clip starts on the second the song is on', video.currentTime === 92, video.currentTime);
  ok('and the footer says which second that was', /Started at 1:32, where the song is\./.test(els.scVideoFoot._text), els.scVideoFoot._text);
  audio.currentTime = 0;

  console.log('a song with no video shows its cover');
  sandbox.scYtSearch = function(){ return Promise.resolve([]); };
  const songPlays = audio.plays;
  await sandbox.scVideoStart({ title: 'No Clip', artist: 'Nobody', art: 'https://art/cover.jpg', key: 'q:t9' });
  await wait();
  ok('the cover art is the picture', sandbox.scVideoState.coverOn === true && els.scVideoCoverImg.src === 'https://art/cover.jpg', els.scVideoCoverImg.src);
  ok('the blur behind it is the same art', /cover\.jpg/.test(String(els.scVideoCoverBg.style.backgroundImage)), els.scVideoCoverBg.style.backgroundImage);
  ok('the stage hides the empty video element', els.scVideoStage.classList.contains('sc-vcover'));
  ok('it says there is nothing to show', /No music video for this song\./.test(els.scVideoCoverTxt._text), els.scVideoCoverTxt._text);
  ok('the song plays on as the sound', audio.plays === songPlays + 1 && sandbox.__scVideoSoundOwn === false, audio.plays + '/' + sandbox.__scVideoSoundOwn);
  ok('and the tab knows which song it is on', sandbox.scVideoState.songKey === 'q:t9', sandbox.scVideoState.songKey);

  console.log('the tab follows the queue');
  sandbox.queue = ['t1', 't2'];
  sandbox.allTracks = [{ id: 't1', title: 'One', artist: 'A' }, { id: 't2', title: 'Two', artist: 'B', videoId: 'v2' }];
  sandbox.queueIndex = 0;
  sandbox.scVideoState.open = true;
  sandbox.scVideoState.songKey = 'q:t1';
  let followLoads = 0;
  sandbox.scHttpJson = function(){ followLoads++; return answer([MUX(18, 360)], [ADA(137, 1080), AUD])(); };
  ok('the same song does not move the picture', sandbox.scVideoFollow() === false);
  sandbox.queueIndex = 1;
  ok('a new song moves it', sandbox.scVideoFollow() === true);
  await wait();
  ok('the tab is on the new song', sandbox.scVideoState.songKey === 'q:t2', sandbox.scVideoState.songKey);
  ok('and asked the player for that song video', followLoads === 2, followLoads);
  ok('the song it is looking for is the new one', sandbox.scVideoState.last && sandbox.scVideoState.last.title === 'Two', sandbox.scVideoState.last && sandbox.scVideoState.last.title);
  sandbox.scVideoState.open = false;

  console.log('the tab has a way back');
  ok('the header carries a back button', /id="scVideoBack"/.test(markup), markup.slice(0, 120));
  ok('the back arrow leads the row', /#scVideoHead #scVideoBack\{margin-right:auto/.test(css.text));
  ok('and it is wired', (els.scVideoBack._ev['click'] || []).length === 1, (els.scVideoBack._ev['click'] || []).length);

  console.log('the film is for the song that is on');
  sandbox.scVideoState.open = true;
  sandbox.scVideoState.coverOn = false;
  sandbox.queue = ['t1', 't2'];
  sandbox.allTracks = [{ id: 't1', title: 'One', artist: 'A' }, { id: 't2', title: 'Two', artist: 'B', videoId: 'v2' }];
  sandbox.queueIndex = 0;
  let pendingLookup = null, staleLoads = 0;
  sandbox.scYtSearch = function(){ return new Promise(r => { pendingLookup = r; }); };
  sandbox.scHttpJson = function(){ staleLoads++; return answer([MUX(18, 360)], [ADA(137, 1080), AUD])(); };
  const slowStart = sandbox.scVideoStart({ title: 'One', artist: 'A', key: 'q:t1' });
  sandbox.queueIndex = 1;                       // the queue moves while the lookup is out
  pendingLookup([{ videoId: 'oneLive', title: 'One (Live)', owner: 'A', duration: 209 }]);
  await slowStart; await wait();
  ok('a lookup that answers for the song the queue left is dropped', staleLoads === 0, staleLoads);
  ok('so no other song film is put on the screen', sandbox.scVideoState.videoId !== 'oneLive', sandbox.scVideoState.videoId);
  ok('the tick then follows to the song that is on', sandbox.scVideoFollow() === true);
  await wait();
  ok('and the tab is on that song',
     sandbox.scVideoState.songKey === 'q:t2' && sandbox.scVideoState.last.title === 'Two',
     sandbox.scVideoState.songKey + '/' + (sandbox.scVideoState.last && sandbox.scVideoState.last.title));

  let pendingEmpty = null;
  sandbox.queueIndex = 0;
  sandbox.scYtSearch = function(){ return new Promise(r => { pendingEmpty = r; }); };
  video.pause();
  const slowEmpty = sandbox.scVideoStart({ title: 'One', artist: 'A', key: 'q:t1' });
  sandbox.queueIndex = 1;
  pendingEmpty([]);
  await slowEmpty; await wait();
  ok('a cover for a song the queue left is not put up either', sandbox.scVideoState.coverOn === false, sandbox.scVideoState.coverOn);

  console.log('closing the tab stops what was still looking');
  sandbox.queueIndex = 0;
  let pendingClosed = null;
  sandbox.scYtSearch = function(){ return new Promise(r => { pendingClosed = r; }); };
  sandbox.scVideoState.open = true;
  const beforeClose = sandbox.scVideoState.videoId;
  const slowClose = sandbox.scVideoStart({ title: 'One', artist: 'A', key: 'q:t1' });
  sandbox.scVideoClose();
  pendingClosed([{ videoId: 'oneLate', title: 'One', owner: 'A', duration: 209 }]);
  await slowClose; await wait();
  ok('a lookup that lands after closing changes nothing', sandbox.scVideoState.videoId === beforeClose, sandbox.scVideoState.videoId);
  ok('and the tab is not left locked as loading', sandbox.scVideoState.busy === false);

  // The player asks two clients, so every promise it was handed has to be answered:
  // one left pending is a chain that never settles.
  const pendingPlayer = [];
  sandbox.scHttpJson = function(){ return new Promise(r => { pendingPlayer.push(r); }); };
  sandbox.scVideoState.open = true;
  const loadP = sandbox.scVideoLoad({ videoId: 'v9', title: 'Nine', owner: 'A' });
  sandbox.scVideoClose();
  await wait();
  pendingPlayer.forEach(r => r({ videoDetails: { title: 'Nine', lengthSeconds: 209 },
    streamingData: { formats: [MUX(18, 360)], adaptiveFormats: [ADA(137, 1080), AUD] } }));
  await loadP; await wait();
  ok('a player answer that lands after closing is not attached',
     sandbox.scVideoState.rung === null && !video.src, String(sandbox.scVideoState.rung) + '/' + video.src);

  console.log('the back arrow is a way out');
  els.scVideoBackdrop.classList.add('on');
  sandbox.scVideoState.open = true;
  audio.paused = false;
  fire(els.scVideoBack, 'click');
  ok('one tap leaves the tab', sandbox.scVideoState.open === false && !els.scVideoBackdrop.classList.contains('on'));
  ok('and hands the sound back to the song', sandbox.__scVideoSoundOwn === false, sandbox.__scVideoSoundOwn);

  console.log('a tap on the picture opens the mini bar, it does not stop the film');
  sandbox.scVideoState.open = true;
  sandbox.scVideoState.wide = false;
  sandbox.scVideoState.blocked = false;
  video.src = 'https://example.invalid/final.mp4';
  video.paused = false;
  fire(els.scVideoStage, 'click', {});
  ok('a tap on a playing picture does not pause it', video.paused === false, video.paused);
  sandbox.scVideoIdleMark(true);
  ok('the mini bar was away', els.scVideoBackdrop.classList.contains('sc-vidle'));
  fire(els.scVideoStage, 'click', {});
  ok('a tap on the picture brings it back', !els.scVideoBackdrop.classList.contains('sc-vidle'));
  ok('and still does not stop the film', video.paused === false, video.paused);
  video.paused = true;
  fire(els.scVideoStage, 'click', {});
  await wait();
  ok('a tap on a stopped picture opens the bar instead of starting it', video.paused === true, video.paused);
  sandbox.scVideoTap();
  ok('the round button is what starts it', video.paused === false, video.paused);
  sandbox.scVideoTap();
  ok('and what pauses it again', video.paused === true, video.paused);

  console.log('the mini bar steps aside in portrait as well');
  sandbox.SC_VQ_IDLE_MS_PORTRAIT = 25;
  sandbox.scVideoState.wide = false;
  video.src = 'https://example.invalid/final.mp4';   // the stub's source setter stops it
  video.paused = false; video.readyState = 3;
  audio.paused = false;                       // the song is running, so the tick does not pause the picture
  sandbox.scVideoIdleArm();
  await wait(70);
  ok('a running picture leaves the mini bar away', els.scVideoBackdrop.classList.contains('sc-vidle'));
  ok('a tap reports it and brings it back',
     sandbox.scVideoIdleWake() === true && !els.scVideoBackdrop.classList.contains('sc-vidle'));

  console.log('FULL HD reaches the list through the app resolver');
  sandbox.scVideoState.deadH = {};
  let appCalls = 0;
  sandbox.scYtPlayer = function(){
    appCalls++;
    return Promise.resolve({
      url: 'https://h/audio', mime: 'audio/mp4', itag: 140, size: 2500000, muxed: false,
      alts: [], videoTitle: 'Song', author: 'Artist',
      videos: [
        { url: 'https://h/308', mimeType: 'video/webm; codecs="vp9"', itag: 308, contentLength: 30000000, height: 1440 },
        { url: 'https://h/137', mimeType: 'video/mp4; codecs="avc1.640028"', itag: 137, contentLength: 24000000, height: 1080 },
        { url: 'https://h/248', mimeType: 'video/webm; codecs="vp9"', itag: 248, contentLength: 20000000, height: 1080 }
      ],
      snd: { url: 'https://h/audio-only', mime: 'audio/mp4', size: 2500000 }
    });
  };
  sandbox.scHttpJson = answer([MUX(18, 360)], []);
  await sandbox.scVideoLoad({ videoId: 'v50', title: 'Song', owner: 'Artist' });
  await wait();
  ok('a client that answers with only the muxed row asks the app resolver', appCalls === 1, appCalls);
  ok('and its picture rows reach the ladder',
     sandbox.scVideoState.rungs.map(r => r.h).join(',') === '1440,1080,360',
     sandbox.scVideoState.rungs.map(r => r.h).join(','));
  ok('the picture opens on FULL HD', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  ok('from the resolver row the phone can open', /137/.test(sandbox.scVideoState.rung.url), sandbox.scVideoState.rung.url);
  ok('with the resolver soundtrack as its voice',
     sandbox.scVideoState.audioMode === 'aux' && aux.src === 'https://h/audio-only',
     sandbox.scVideoState.audioMode + '/' + aux.src);
  ok('and the header says the size', els.scVideoChip._text === '1080p', els.scVideoChip._text);
  appCalls = 0;
  sandbox.scHttpJson = answer([MUX(18, 360)], [ADA(137, 1080), AUD]);
  await sandbox.scVideoLoad({ videoId: 'v51', title: 'Song', owner: 'Artist' });
  await wait();
  ok('an answer that already carries FULL HD still asks the resolver', appCalls === 1, appCalls);
  ok('and opens on FULL HD', sandbox.scVideoState.rung.h === 1080, sandbox.scVideoState.rung.h);
  ok('on the resolver row, not the client one', /h\/137/.test(sandbox.scVideoState.rung.url), sandbox.scVideoState.rung.url);
  // The tab's own WebM row has to be proved on its own, so the resolver - which is
  // asked for every video now and prefers its own address - stands aside for it.
  delete sandbox.scYtPlayer;
  sandbox.scHttpJson = answer([], [{ itag: 248, mimeType: 'video/webm; codecs="vp9"',
    url: 'https://h/webm1080', contentLength: '20000000', height: 1080, bitrate: 3000000 }, AUD]);
  await sandbox.scVideoLoad({ videoId: 'v52', title: 'Song', owner: 'Artist' });
  await wait();
  const webm = sandbox.scVideoState.rungs.find(r => r.h === 1080);
  ok('a WebM size from its own call is seated too', !!webm && webm.codec === 'VP9', webm && webm.codec);

  console.log('the picture is upscaled');
  ok('HD+ is on to begin with', sandbox.scVideoFxOn() === true, sandbox.scVideoFxOn());
  ok('the stage has a canvas for it', /id="scVideoFx"/.test(markup), markup.slice(0, 200));
  ok('the transport has its button', /id="scVideoBoost"/.test(markup) && (els.scVideoBoost._ev['click'] || []).length === 1,
     (els.scVideoBoost._ev['click'] || []).length);
  ok('the canvas sits over the picture',
     /#scVideoStage\.sc-vfx #scVideoFx\{display:block\}/.test(css.text) && /sc-vfx #scVideoEl\{opacity:0\}/.test(css.text));
  ok('and is hidden while a cover is up', /sc-vcover #scVideoFx\{display:none\}/.test(css.text));
  sandbox.scVideoState.open = true;
  sandbox.scVideoFxApply();
  ok('an open tab paints through the canvas', els.scVideoStage.classList.contains('sc-vfx'));
  fire(els.scVideoBoost, 'click');
  ok('HD+ turns it off', sandbox.scVideoState.fxOn === false && !els.scVideoStage.classList.contains('sc-vfx'),
     sandbox.scVideoState.fxOn + '/' + els.scVideoStage.classList.contains('sc-vfx'));
  ok('and the choice is remembered', store.get('scVideoUpscale') === '0', store.get('scVideoUpscale'));
  fire(els.scVideoBoost, 'click');
  ok('and back on', sandbox.scVideoState.fxOn === true && els.scVideoStage.classList.contains('sc-vfx'));
  let fxThrew = false;
  try{ sandbox.scVideoFxPaint(); }catch(_eFxCheck){ fxThrew = true; }
  ok('a frame with no picture yet does not throw', !fxThrew);
  const fxCanvas = canvases.filter(c => c.id === 'scVideoFx')[0];
  ok('the canvas is one the tab can paint on', !!fxCanvas && !!fxCanvas.ctx);
  els.scVideoStage._rect = { left: 0, top: 0, width: 400, height: 300 };
  video.videoWidth = 1920; video.videoHeight = 1080;
  fxCanvas.ctx.calls.length = 0;
  sandbox.scVideoFxPaint();
  ok('a frame is drawn at the stage pixel grid', fxCanvas.width === 400 && fxCanvas.height === 300,
     fxCanvas.width + 'x' + fxCanvas.height);
  ok('the frame is the base draw', fxCanvas.ctx.calls.filter(c => c === 'draw:source-over').length === 1,
     fxCanvas.ctx.calls.join(','));
  ok('one clarity pass is laid over it', fxCanvas.ctx.calls.indexOf('draw:overlay') !== -1, fxCanvas.ctx.calls.join(','));
  ok('and that is the whole frame', fxCanvas.ctx.calls.length === 3, fxCanvas.ctx.calls.join(','));
  ok('no second canvas is kept for it', canvases.length === 1, canvases.length);
  ok('and the canvas is left ready for the next frame',
     fxCanvas.ctx.globalAlpha === 1 && fxCanvas.ctx.globalCompositeOperation === 'source-over' && fxCanvas.ctx.filter === 'none',
     fxCanvas.ctx.globalAlpha + '/' + fxCanvas.ctx.globalCompositeOperation + '/' + fxCanvas.ctx.filter);
  video.videoWidth = 0; video.videoHeight = 0;

  console.log('the size list is the ladder, not whatever a row reported');
  const ladder = sandbox.scVideoLadder(
    [{ h: 396, url: 'https://h/m396', mime: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', size: 9000000, bitrate: 800000 }],
    [{ h: 270, url: 'https://h/a270', mime: 'video/mp4; codecs="avc1.640028"', size: 1000000, bitrate: 400000 },
     { h: 180, url: 'https://h/a180', mime: 'video/mp4; codecs="avc1.640028"', size: 700000, bitrate: 300000 },
     { h: 2048, url: 'https://h/a2048', mime: 'video/mp4; codecs="avc1.640028"', size: 60000000, bitrate: 9000000 }],
    { url: 'https://h/snd', mime: 'audio/mp4', size: 2500000 }
  );
  ok('an in-between height is read as the nearest size that is one',
     ladder.map(r => r.h).join(',') === '2048,360,240,144', ladder.map(r => r.h).join(','));
  ok('and the ladder carries the names a viewer knows',
     ladder.map(r => r.label).join(',') === '2K,360p,240p,144p', ladder.map(r => r.label).join(','));
  ok('4K says 4K and 1440p says 1440p',
     sandbox.scVideoSizeLabel(2160) === '4K' && sandbox.scVideoSizeLabel(1440) === '1440p'
       && sandbox.scVideoSizeLabel(2048) === '2K',
     sandbox.scVideoSizeLabel(2160) + '/' + sandbox.scVideoSizeLabel(1440) + '/' + sandbox.scVideoSizeLabel(2048));
  ok('every standard size is a step', [144, 240, 360, 480, 720, 1080, 1440, 2048, 2160]
     .every(h => sandbox.scVideoStd(h) === h));
  sandbox.scVideoState.rungs = ladder;
  sandbox.scVideoState.rung = ladder[0];
  sandbox.scVideoState.want = 1080;
  sandbox.scVideoQualityToggle(true);
  const small = els.scVideoQList._html || '';
  ok('144p and 240p are on the list', /data-h="144"/.test(small) && /data-h="240"/.test(small), small.slice(0, 300));
  ok('2K is on the list by its name', /<b>2K<\/b>/.test(small), small.slice(0, 300));
  sandbox.scVideoQualityToggle(false);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
