// 74.8 - LISTENING TIME, WHILE THE MUSIC IS OUT OF SIGHT.
//
// The owner: "the listening stats aren't working ... it doesn't go up in time when I'm
// listening outside of the app or with headphones like it should".
//
//   [1] the page carries a drivable clock, and the two things that stopped it are gone;
//   [2] a backgrounded app still counts the seconds the audio moves;
//   [3] a frozen page (no ticks for ten minutes) is recovered, not lost;
//   [4] pause is worth nothing, a seek forward is not listening, and no source is nothing;
//   [5] the number the stats screen reads is the number this clock keeps.
//
// The clock is driven with a fake Date.now and a stubbed media element, so the cases are
// exact and take a few hundred milliseconds: a real ten-minute background gap would
// otherwise have to be waited through.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|Could not parse CSS|Could not load/i.test(m)) errors.push(m); });

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () {
      return new Proxy({}, {
        get(t, p) {
          if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
          if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
          if (p === 'measureText') return () => ({ width: 10 });
          if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
          return undefined;
        },
        set() { return true; },
      });
    };
    win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    win.HTMLMediaElement.prototype.play = () => Promise.resolve();
    win.HTMLMediaElement.prototype.pause = () => {};
    win.HTMLMediaElement.prototype.load = () => {};
    win.URL.createObjectURL = () => 'blob:jsdom';
    win.URL.revokeObjectURL = () => {};
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

(async () => {
  const win = dom.window;
  await wait(7000);
  const doc = win.document;

  console.log('[1] the clock exists and the two blockages are gone');
  {
    ok(typeof win.__scListenTick === 'function', 'the listening clock is a function the page publishes');
    ok(typeof win.__scListenSeconds === 'function', 'and it reports its own total (whole seconds + the fraction)');
    ok(!/if\(document\.hidden\) return; \/\/ Don't count time/.test(html),
      'the "do not count while backgrounded" guard is gone');
    ok(/__scKeepAliveTimer\(scListenTimer\)/.test(html), 'its timer is marked keep-alive for the battery saver');
    ok(/if\(t\.alive && !t\.keep\)/.test(html), 'and the saver honours that mark');
  }
  if (typeof win.__scListenTick !== 'function') {
    ok(false, 'the rest of this gate needs the drivable clock, and this page has none');
    console.log('\nlisten-time-check: ' + pass + ' passed, ' + fail + ' failed');
    process.exit(1);
  }

  // A stubbed media element and a clock the gate moves by hand.
  const audio = doc.getElementById('audioEl');
  const state = { paused: false, ended: false, pos: 0, src: 'blob:jsdom' };
  Object.defineProperty(audio, 'paused', { get: () => state.paused, configurable: true });
  Object.defineProperty(audio, 'ended', { get: () => state.ended, configurable: true });
  Object.defineProperty(audio, 'currentTime', {
    get: () => state.pos,
    set: (v) => { state.pos = v; },
    configurable: true,
  });
  Object.defineProperty(audio, 'src', {
    get: () => state.src,
    set: (v) => { state.src = v; },
    configurable: true,
  });
  Object.defineProperty(audio, 'currentSrc', { get: () => state.src, configurable: true });

  let fakeNow = 1_800_000_000_000;
  win.Date.now = () => fakeNow;
  let hidden = false;
  Object.defineProperty(doc, 'hidden', { get: () => hidden, configurable: true });

  const total = () => Number(win.__scListenSeconds());
  // One realistic tick: the wall clock and the playhead move together. `gapMs` is real
  // time passed and `posDelta` is what the audio moved - equal when the sound is playing,
  // zero when it is not.
  const beat = async (posDelta, gapMs = 1000) => {
    fakeNow += gapMs;
    state.pos += posDelta;
    win.__scListenTick();
    await wait(4);
  };

  console.log('[2] a song heard with the app in the background still counts');
  {
    win.__scListenTick();               // takes the baseline
    await wait(4);
    const before = total();
    hidden = true;                       // screen off / another app in front
    for (let i = 0; i < 10; i++) await beat(1, 1000);   // ten audible seconds, a second apart
    const grew = total() - before;
    ok(grew >= 9.5 && grew <= 10.6, 'ten backgrounded seconds add ten seconds, not zero', grew);
  }

  console.log('[3] a span the page was frozen through is recovered by the next tick');
  {
    const before = total();
    fakeNow += 600_000;                  // ten minutes, no ticks happened
    state.pos += 600;
    win.__scListenTick();
    await wait(4);
    const grew = total() - before;
    ok(grew >= 599 && grew <= 601, 'a ten-minute gap adds ten minutes, not one second', grew);
  }

  console.log('[4] pause, seek and no-source are worth nothing dishonest');
  {
    const before = total();
    state.paused = true;
    await beat(60, 60_000);              // paused for a minute with the playhead moved
    ok(total() - before < 0.01, 'a paused player adds nothing', total() - before);
    state.paused = false;

    const beforeSeek = total();
    state.pos += 120;                    // a jump forward is a seek, not listening
    await beat(0, 1000);
    const seekGrew = total() - beforeSeek;
    ok(seekGrew <= 1.6, 'a two-minute seek forward is not two minutes of listening', seekGrew);

    const beforeNoSrc = total();
    state.src = '';
    await beat(30, 30_000);
    ok(total() - beforeNoSrc < 0.01, 'a player with no source adds nothing', total() - beforeNoSrc);
    state.src = 'blob:jsdom';
  }

  console.log('[5] the stats screen reads this clock');
  {
    const stats = win.__scStats();
    ok(Math.abs(Number(stats.listenSeconds) - Math.floor(total())) <= 1,
      'the reported listening seconds are the clock this gate drove', [stats.listenSeconds, total()]);
  }

  ok(errors.length === 0, 'no uncaught page errors while any of this ran', errors.slice(0, 3));

  console.log('\nlisten-time-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
