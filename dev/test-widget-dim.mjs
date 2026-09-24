// Widget heartbeat guard: the 25s battery-saving dim must NEVER fire while a
// track is playing. Pushing a fake paused state ("Tap to show", no EQ bars, a
// play icon that lied) mid-song and then going silent is what made the home
// widget look frozen. It still dims a stationary player, and the first touch
// undims on the spot instead of waiting out the rest of the heartbeat beat.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');

const startAnchor = '  (function(){\n    // Widget timeout: after 25s of no user interaction';
const endAnchor = '  })();\n  // Switch the playing playlist';
const s = src.indexOf(startAnchor);
const e = src.indexOf(endAnchor, s);
if (s === -1 || e === -1) { console.error('FAIL: heartbeat IIFE not extractable'); process.exit(1); }
const code = src.slice(s, e + '  })();'.length);

let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };

// ---- stubs -------------------------------------------------------------
const listeners = {};
const sent = [];            // payloads pushed straight to the native plugin
const pushed = [];          // calls that went through pushWidgetState
let now = 1000000;
const realDateNow = Date.now;
Date.now = () => now;

const windowStub = {
  Capacitor: {
    Plugins: { SideCutWidget: { update: (body) => sent.push(JSON.parse(body.data)) } },
    nativePromise: () => Promise.resolve({}),
  },
};
windowStub.__scWidgetPulse = 0;
const documentStub = {
  addEventListener: (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); },
  hidden: false,
};
const track = { name: 'Song', artist: 'Artist' };

const factory = new Function(
  'window', 'document', 'pushWidgetState', 'getWidgetTheme', 'widgetTrackInit',
  'let widgetTrack = widgetTrackInit, widgetPlaying = false;\n' +
  code + '\n' +
  'return {\n' +
  '  hb: window.__scWidgetHeartbeat,\n' +
  '  setPlaying: function(p){ widgetPlaying = p; }\n' +
  '};'
);
const api = factory(windowStub, documentStub, (t, p) => pushed.push({ t, p }), () => ({}), track);

const touch = () => listeners.touchstart.forEach(fn => fn({}));

console.log('[1] dim guard while playing');
// A) idle 30s WHILE PLAYING -> real state must be pushed, never the dim payload
now += 30000;
api.setPlaying(true);
api.hb();
ok(pushed.length === 1 && pushed[0].p === true, 'playing + 30s idle: real state pushed (still playing)');
ok(sent.length === 0, 'playing + 30s idle: no fake paused "Tap to show" payload sent');

console.log('[2] stationary player still saves battery');
api.setPlaying(false);
now += 30000;
api.hb();
ok(sent.length === 1 && sent[0].playing === false && /Tap to show/.test(sent[0].artist),
   'paused + 30s idle: battery-saving dim still fires');
ok(pushed.length === 1, 'paused + 30s idle: heartbeat stops after the dim');

console.log('[3] first touch undims immediately');
touch();
ok(pushed.length === 2 && pushed[1].p === false, 'touch after a dim pushes real state right away');
ok(sent.length === 1, 'touch after a dim does not re-dim');

console.log('[4] beat resumes after the touch');
now += 30000;
touch();
api.setPlaying(true);
const before = pushed.length;
api.hb();
ok(pushed.length === before + 1 && pushed[pushed.length - 1].p === true,
   'playing after a touch: heartbeat keeps pushing the real state');

Date.now = realDateNow;
console.log(failures ? 'WIDGET HEARTBEAT: ' + failures + ' FAILURE(S)' : 'WIDGET HEARTBEAT: ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
