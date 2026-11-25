// 85.3.16 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report: "video quality upscaling and downscaling doesn't work fix that. if it's
// legal add the music video to regular SideCut and make the side tab thing better and cleaner
// allowing you to do the 3 dots too".
//
// Three faults, and the first two are the same fault seen from two sides - the picture was
// being covered by a canvas before anything had been drawn into it:
//
//   * THE UPSCALER COVERED THE STAGE WITH AN EMPTY CANVAS. `scVideoFxApply` added `sc-vfx` -
//     which is what hides the <video> - as soon as the switch was on. The canvas is only ever
//     painted from the FRAME LOOP, and that loop refuses a paused picture; so a film that was
//     paused (or had just been given a new size and was waiting to start) had the element
//     hidden behind a blank canvas. HD+ "did nothing" while the picture played and wiped the
//     picture out while it did not. And the canvas itself was built TWICE: the stage's markup
//     already had one and `scVideoFxCanvas` appended a second with the same id, so the node the
//     app drew into was not the node `getElementById` answered with.
//   * A HAND-PICKED SIZE WAS FILTERED THROUGH THE AUTOMATIC LADDER. `scVideoQualityChoose`
//     called `scVideoPick`, which starts from `scVideoLive` - the ladder with every height this
//     film already failed taken out. Tapping a height that had been marked dead therefore
//     played a DIFFERENT size and the footer blamed the source; and the height kept its marks
//     (`deadH`, `slowH`, the rate's walk, the reader's one-attempt bookkeeping), so the
//     machinery around it had already given up on it. Tapping the size the chip already said
//     was a no-op even when the stage was black.
//
// And the two asks: the music video is in the song's own three dots (it was only on the rail),
// and the rail carries the three dots itself.
//
// Nothing here is a copy of the shipped code: the functions are cut out of the page by name and
// braces and run against a fake stage. The painting MATHS (scVideoFxPaint's pixels) is stubbed -
// this gate is about WHEN the canvas may cover the picture and WHICH size a tap means.
//
//   node dev/check-85316.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function constLine(name) {
  const m = page.match(new RegExp('^\\s*var ' + name + ' = [^\\n]+$', 'm'));
  if (!m) throw new Error('missing constant ' + name);
  return m[0];
}
function grab(name) {
  const key = 'function ' + name + '(';
  let start = page.indexOf('async ' + key);
  if (start < 0) {
    start = page.indexOf(key);
    if (start < 0) throw new Error('missing function ' + name);
  }
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}

const UNIT = [
  'var scVideoFxCv = null, scVideoFxCtx = null;',
  constLine('SC_VFX_KEY'),
  grab('scVideoDead'), grab('scVideoLive'), grab('scVideoDefault'), grab('scVideoRungFor'),
  grab('scVideoChooseFresh'), grab('scVideoPick'), grab('scVideoQualityChoose'),
  grab('scVideoFxPref'), grab('scVideoFxCanvas'), grab('scVideoFxApply'),
  grab('scVideoFxPaintOnce'), grab('scVideoFxToggle'),
  grab('scVideoForTrack'), grab('scShelfDots')
].join('\n');

// The shipped functions, a fake stage, a fake preference store and recorders for everything
// they would do to the screen. The paint itself is a stub that records `fxPainted`, because
// what is being proven is when the canvas is ALLOWED to take the picture over.
function harness(opts) {
  const o = opts || {};
  const calls = [];
  const dom = o.dom || {};
  const state = Object.assign({
    open: true, fxOn: false, fxPainted: 0, fxBlocked: false, fxManual: false,
    rungs: o.rungs || [], rung: o.rung || null, want: 0,
    deadH: {}, slowH: {}, rescueH: {}, rateSteps: 0, rateNow: 0, rateBest: 0,
    perfBad: 0, perf: null, pickSeq: 0, drops: 0, retries: 0
  }, o.state || {});
  const sandbox = {
    console, Number, Math, String, Array, Object, JSON, Promise, isFinite, Date, RegExp,
    scVideoState: state,
    scVideoEl: function (id) { return dom[id] || null; },
    document: {
      createElement: function (t) {
        calls.push('createElement:' + t);
        return { id: '', getContext: function () { return {}; } };
      }
    },
    localStorage: {
      getItem: function () { return o.pref === undefined ? null : o.pref; },
      setItem: function (k, v) { calls.push('pref:' + v); }
    },
    scVideoFxPaint: function () {
      calls.push('paint');
      if (o.paintFails) return false;
      state.fxPainted = 1;
      return true;
    },
    scVideoFxStart: function () { calls.push('fxstart'); },
    scVideoFxStop: function () { calls.push('fxstop'); },
    scVideoAiSchedule: function () { calls.push('ai'); },
    scVideoFoot: function (t) { calls.push('foot:' + t); },
    scVideoIdleWake: function () {},
    scVideoQualityToggle: function () {},
    scVideoQualityMark: function () { calls.push('mark'); },
    scVideoWantSet: function (h) { calls.push('want:' + h); },
    scVideoSizeLabel: function (h) { return 'h' + h; },
    scVideoApplyRung: function (r) { calls.push('apply:' + (r && r.h)); state.rung = r; },
    scVideoProbes: function (rows) {
      calls.push('probe:' + rows.length);
      return Promise.resolve(rows.map(function () { return null; }));
    },
    scVideoOpen: function () { calls.push('open'); },
    playTrackInPlaylistContext: function (id) { calls.push('play:' + id); },
    openSongActions: function (id) { calls.push('actions:' + id); },
    queue: o.queue || [], queueIndex: o.queueIndex === undefined ? 0 : o.queueIndex,
    allTracks: o.tracks || []
  };
  sandbox.window = sandbox;
  sandbox.window.toast = function (m) { calls.push('toast'); };
  vm.createContext(sandbox);
  vm.runInContext(UNIT + '\n;globalThis.__u = {' +
    'scVideoDead, scVideoLive, scVideoDefault, scVideoRungFor, scVideoChooseFresh, scVideoPick, ' +
    'scVideoQualityChoose, scVideoFxPref, scVideoFxCanvas, scVideoFxApply, scVideoFxPaintOnce, ' +
    'scVideoFxToggle, scVideoForTrack, scShelfDots};',
    sandbox, { filename: 'video-85316.js' });
  return { U: sandbox.__u, s: sandbox, calls: calls, state: state, dom: dom };
}

// A stage, a switch, a canvas and a video element - the four things scVideoFxApply touches.
function fxDom(pre) {
  const p = pre || {};
  const classes = {}, attrs = {}, appended = [];
  const dom = {
    scVideoStage: {
      classList: { toggle: function (c, on) { classes[c] = !!on; } },
      appendChild: function (cv) { appended.push(cv); }
    },
    scVideoBoost: {
      classList: { toggle: function (c, on) { classes['boost:' + c] = !!on; } },
      setAttribute: function (k, v) { attrs[k] = v; },
      textContent: ''
    },
    scVideoEl: {
      src: p.src === undefined ? 'https://example.invalid/film' : p.src,
      readyState: p.ready === undefined ? 4 : p.ready,
      videoWidth: p.vw === undefined ? 1920 : p.vw,
      videoHeight: 1080,
      paused: !!p.paused,
      ended: false,
      currentTime: 0
    }
  };
  if (p.canvas !== false) dom.scVideoFx = { id: 'scVideoFx', getContext: function () { return {}; } };
  return { dom: dom, classes: classes, attrs: attrs, appended: appended };
}

const RUNGS = [
  { h: 2160, label: '4K', url: 'u2160', mime: 'video/mp4', size: 400000000, muxed: false },
  { h: 1440, label: '2K', url: 'u1440', mime: 'video/mp4', size: 200000000, muxed: false },
  { h: 1080, label: 'FULL HD', url: 'u1080', mime: 'video/mp4', size: 60000000, muxed: false },
  { h: 720, label: 'HD', url: 'u720', mime: 'video/mp4', size: 20000000, muxed: false },
  { h: 360, label: '360p', url: 'u360', mime: 'video/mp4', size: 8000000, muxed: true }
];
function rungAt(h) { return RUNGS.filter(function (r) { return r.h === h; })[0]; }
// scVideoQualityChoose answers through a promise it does not return (the click it serves is
// synchronous), so a check has to let the microtasks run before it looks at what happened.
function settle() { return new Promise(function (r) { setTimeout(r, 0); }); }

async function main() {
  // ===========================================================================
  console.log('1. The canvas is the one the stage has, and it is painted before it covers');
  {
    const d = fxDom({ src: 'u', ready: 4 });
    const h = harness({ dom: d.dom, state: { fxOn: true, fxPainted: 0 } });
    const cv = h.U.scVideoFxCanvas();
    ok('the canvas the stage already has is the one the app paints into', cv === d.dom.scVideoFx);
    ok('and no second canvas is made', h.calls.indexOf('createElement:canvas') === -1,
      h.calls.join(','));
    ok('nothing is appended to the stage', d.appended.length === 0);
  }
  {
    const d = fxDom({ src: 'u', ready: 4, canvas: false });
    const h = harness({ dom: d.dom });
    const cv = h.U.scVideoFxCanvas();
    ok('a stage with no canvas of its own gets exactly one', cv && d.appended.length === 1);
    ok('with the id the stylesheet already targets', d.appended[0].id === 'scVideoFx');
  }
  {
    const d = fxDom({ src: '', ready: 0 });
    const h = harness({ dom: d.dom, state: { fxOn: true, fxPainted: 0 } });
    h.U.scVideoFxApply();
    ok('the picture is not covered before there is a frame on the canvas',
      d.classes['sc-vfx'] !== true);
    ok('and the switch does not claim it is on', d.classes['boost:on'] !== true);
    ok('nothing was painted either, because the element has no data', h.calls.indexOf('paint') === -1);
  }
  {
    const d = fxDom({ src: 'u', ready: 4 });
    const h = harness({ dom: d.dom, state: { fxOn: true, fxPainted: 0 } });
    h.U.scVideoFxApply();
    ok('a frame the player already has is taken on the spot', h.calls.indexOf('paint') >= 0);
    ok('and only then does the canvas take the picture over', d.classes['sc-vfx'] === true);
    ok('the switch is on, because the sharpen is really showing', d.classes['boost:on'] === true);
  }
  {
    const d = fxDom({ src: 'u', ready: 1 });
    const h = harness({ dom: d.dom, state: { fxOn: true, fxPainted: 0 } });
    ok('one frame for a still is refused until the element has the data',
      h.U.scVideoFxPaintOnce() === false && h.state.fxPainted === 0);
  }
  {
    const d = fxDom({ src: 'u', ready: 4, paused: true });
    const h = harness({ dom: d.dom, state: { fxOn: false, fxPainted: 0 } });
    h.U.scVideoFxToggle();
    ok('turning HD+ on while the film is paused paints the frame it is on',
      h.state.fxPainted === 1 && d.classes['sc-vfx'] === true && h.state.fxOn === true);
    ok('and the choice is kept', h.calls.indexOf('pref:1') >= 0);
    ok('and the footer says what happened', h.calls.some(function (c) { return c.indexOf('foot:Upscaling on') === 0; }));
  }
  {
    const d = fxDom({ src: 'u', ready: 4 });
    const h = harness({ dom: d.dom, state: { fxOn: true, fxPainted: 0 } });
    h.U.scVideoFxToggle();     // off
    ok('turning it off gives the picture straight back', h.state.fxOn === false && d.classes['sc-vfx'] === false);
  }
  {
    const paint = grab('scVideoFxPaint');
    ok('a frame that landed is recorded on the state', /scVideoState\.fxPainted = 1/.test(paint));
    ok('a frame painted after a size change puts the canvas back',
      /first && scVideoState\.fxPainted/.test(grab('scVideoFxFrame')));
    const attach = grab('scVideoAttach');
    ok('a new source starts with no frame of its own', /scVideoState\.fxPainted = 0/.test(attach));
    ok('a paused film is painted once instead of being left on the old frame',
      /scVideoFxStop\(\);\n\s*scVideoFxPaintOnce\(\)/.test(page));
    ok('a seek and a loaded frame are painted too',
      (page.match(/scVideoFxPaintOnce\(\)/g) || []).length >= 4);
  }

  // ===========================================================================
  console.log('\n2. A size picked by hand is the size that is played');
  {
    const h = harness({ rungs: RUNGS, rung: rungAt(2160), state: { deadH: { 720: 1 } } });
    const skipped = await h.U.scVideoPick(RUNGS, 720);
    ok('the automatic ladder still skips a height this film failed (the fault)',
      skipped.rung && skipped.rung.h === 360, skipped.rung && skipped.rung.h);
    const exact = await h.U.scVideoPick(RUNGS, 720, true);
    ok('a hand pick reads the whole ladder and answers the exact size',
      exact.rung && exact.rung.h === 720, exact.rung && exact.rung.h);
    ok('and it is still the sharpest ask, never above it',
      exact.rung.h === 720 && exact.asked.h === 720);
  }
  {
    const h = harness({
      rungs: RUNGS, rung: rungAt(2160),
      state: { deadH: { 720: 1 }, slowH: { 720: 1 }, rescueH: { 720: 1 }, rateSteps: 3, rateNow: 2 }
    });
    h.U.scVideoQualityChoose(720);
    await settle();
    ok('the height stops being marked dead for this film', !h.state.deadH[720]);
    ok('nor given up for the rate', !h.state.slowH[720]);
    ok('nor remembered as unreadable', !h.state.rescueH[720]);
    ok('the rate walk starts again for the size that was picked',
      h.state.rateSteps === 0 && h.state.rateBest === 0 && h.state.perfBad === 0);
    ok('and the exact size is applied, not a smaller one that answered',
      h.calls.indexOf('apply:720') >= 0, h.calls.join(','));
    ok('the pick is remembered for the next film', h.calls.indexOf('want:720') >= 0);
  }
  {
    const d = fxDom({ src: '', ready: 0 });
    const h = harness({ rungs: RUNGS, rung: rungAt(720), dom: d.dom });
    h.U.scVideoQualityChoose(720);
    await settle();
    ok('tapping the size the chip already says puts a stage that is not up back up',
      h.calls.indexOf('apply:720') >= 0, h.calls.join(','));
  }
  {
    const d = fxDom({ src: 'u', ready: 4 });
    const h = harness({ rungs: RUNGS, rung: rungAt(720), dom: d.dom });
    h.U.scVideoQualityChoose(720);
    await settle();
    ok('a picture that is already up is not reloaded by its own chip',
      !h.calls.some(function (c) { return c.indexOf('apply:') === 0; }));
    ok('and the chip is marked instead', h.calls.indexOf('mark') >= 0);
  }
  {
    const choose = grab('scVideoQualityChoose');
    ok('a refused range ask no longer dims the size list',
      choose.indexOf('deadH[hh] = 1') === -1);
    ok('the pick asks for the exact size', /scVideoPick\(scVideoState\.rungs, h, true\)/.test(choose));
    ok('and the fresh start is one place, not scattered marks',
      /scVideoChooseFresh\(Number\(h\) \? r\.h : 0\)/.test(choose));
    const pick = grab('scVideoPick');
    ok('the exact flag is the only thing that lifts the ladder filter',
      /var pool = exact \? \[\] : scVideoLive\(rungs\)/.test(pick));
  }

  // ===========================================================================
  console.log('\n3. The music video is in the song menu');
  {
    const actions = grab('openSongActions');
    const guard = actions.indexOf('!SC_IS_PLAY');
    const button = actions.indexOf('Music video');
    ok('the song menu offers the music video', button >= 0 && /scVideoForTrack\(t\)/.test(actions));
    ok('and only where the video tab exists at all', guard >= 0 && guard < button);
    ok('it sits with the song actions, before Edit song info',
      button < actions.indexOf('Edit song info'));
    ok('the row closes the sheet before the film opens',
      /songActionsBackdrop'\)\.style\.display='none';\s*scVideoForTrack\(t\)/.test(actions));
  }
  {
    const h = harness({ queue: ['a', 'b'], queueIndex: 0, tracks: [{ id: 'a' }, { id: 'b' }] });
    ok('a video asked for from a row starts that row\'s song',
      h.U.scVideoForTrack({ id: 'b' }) === true && h.calls.indexOf('play:b') >= 0 && h.calls.indexOf('open') >= 0);
    const h2 = harness({ queue: ['a'], queueIndex: 0, tracks: [{ id: 'a' }] });
    ok('the song that is already playing is not restarted',
      h2.U.scVideoForTrack({ id: 'a' }) === true &&
      !h2.calls.some(function (c) { return c === 'play:a'; }) && h2.calls.indexOf('open') >= 0);
    const h3 = harness({});
    h3.s.SC_IS_PLAY = true;
    ok('the store build has no video path to walk',
      h3.U.scVideoForTrack({ id: 'a' }) === false && h3.calls.indexOf('open') === -1);
  }

  // ===========================================================================
  console.log('\n4. The rail has the three dots');
  {
    const h = harness({ queue: ['t1'], queueIndex: 0, tracks: [{ id: 't1' }] });
    ok('the dots open the actions of the song that is on',
      h.U.scShelfDots() === true && h.calls.indexOf('actions:t1') >= 0);
    const h2 = harness({ queue: ['scstream:9'], queueIndex: 0, tracks: [{ id: 't1' }] });
    ok('a song with no library row is told so, not given an empty sheet',
      h2.U.scShelfDots() === false && h2.calls.indexOf('toast') >= 0 && !h2.calls.some(function (c) { return c.indexOf('actions:') === 0; }));
    const h3 = harness({ queue: [], queueIndex: -1, tracks: [{ id: 't1' }] });
    ok('nothing playing is the same answer', h3.U.scShelfDots() === false && h3.calls.indexOf('toast') >= 0);
  }
  {
    const render = grab('scShelfRender');
    ok('the rail builds the three dots', /data-dots="1"/.test(render) && /scIcon\('dots'/.test(page));
    ok('a tap on it is the song actions', /data-dots'\) === '1'\)\{ scShelfDots\(\); return;/.test(render));
    ok('the glyph is not a page and keeps its own class',
      /data-dots'\) === '1'\) return;/.test(grab('scShelfMark')));
    ok('the rail is three groups, not four', (render.match(/scshelf-sep/g) || []).length === 2,
      (render.match(/scshelf-sep/g) || []).length);
    ok('every glyph is one size', /\.scshelf-tab\{pointer-events:auto;width:34px;height:34px/.test(page));
    ok('the rail is still the drag-reorderable one', /function scRailDrag/.test(page) && /sidecut_railOrder/.test(page));
  }

  releaseChecks();
}

// =============================================================================
function releaseChecks() {
  console.log('\n5. The release itself');
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) {
    scripts++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
  }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  // 85.3.17 - rewritten for this release's contract: this suite proves 85.3.16's
  // behaviour, which 85.3.17 kept (it only redrew the rail), so it asks for 85.3.16
  // or newer instead of pinning the page to it.
  ok('the page is on 85.3.16 or newer', /^85\.3\.(1[6-9]|[2-9]\d)$/.test(vPage || ''), vPage);
  ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
  ok('the notes carry the 85.3.16 entry', page.includes("version: '85.3.16'"));
  ok('the new entry is above 85.3.15', page.indexOf("version: '85.3.16'") < page.indexOf("version: '85.3.15'"));
  const entry = page.slice(page.indexOf("version: '85.3.16'"), page.indexOf("version: '85.3.15'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 140));
  ok('the new entry carries the three lines it describes', (entry.match(/: '/g) || []).length >= 3);
}

main().then(function () {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
}, function (e) {
  console.error(e && e.stack || e);
  process.exitCode = 1;
});
