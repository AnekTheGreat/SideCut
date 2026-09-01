// Execute SideCut's main script block in jsdom with a native-Capacitor stub.
// Goal: surface the exact top-level throw (with line number) that kills wiring
// on the bundled Android app but not in mocks.
const fs = require('fs');
const { JSDOM } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync('/home/daytona/codebase/index.html', 'utf8');
const htmlLines = html.split('\n');

// Extract inline script blocks with their true line offsets
const blocks = [];
const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
  const before = html.slice(0, m.index);
  const startLine = before.split('\n').length; // 1-based line of block content start
  blocks.push({ code: m[1], startLine });
}
console.log('inline blocks:', blocks.map(b => b.startLine).join(', '));

const dom = new JSDOM(html, {
  url: 'https://localhost/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

// --- Native Capacitor stub (what the WebView injects) ---
window.Capacitor = {
  isNativePlatform: () => true,
  getPlatform: () => 'android',
  Plugins: {
    // Mimic the user's broken device: the plugin answers but returns a
    // NON-thenable (undefined), which crashed 5.0.11 with
    // "capMediaSession.setActionHandler(...).catch is not a function".
    MediaSession: new Proxy({}, {
      get: (t, p) => () => undefined,
    }),
  },
};

// --- Minimal IndexedDB stub: resolves stores so awaits never hang forever ---
const idbStub = {
  open: () => ({
    addEventListener: (ev, fn) => { if (ev === 'success') setTimeout(fn, 0); },
    set onupgradeneeded(fn) { setTimeout(() => {
      // call upgrade with a fake db
      try { fn({ target: { result: {
        createObjectStore: () => ({ createIndex: () => {} }),
        objectStoreNames: { contains: () => false },
      } } }); } catch (e) {}
    }, 0); },
  }),
};
// The app's own dbGet/dbPut wrap indexedDB.open; make them resolve empty.
window.indexedDB = {
  open: function () {
    const req = {
      addEventListener: function (ev, fn) { if (ev === 'success') setTimeout(() => fn({ target: { result: null } }), 0); },
      set onsuccess(fn) { setTimeout(() => fn({ target: { result: null } }), 0); },
      set onerror(fn) {},
      set onupgradeneeded(fn) {},
    };
    return req;
  },
};

// --- Error capture with real line mapping ---
window.addEventListener('error', (ev) => {
  console.log('WINDOW ERROR:', ev.message);
  if (ev.error && ev.error.stack) console.log(ev.error.stack.split('\n').slice(0, 4).join('\n'));
});

// Run each block; report the first throw with mapped line numbers
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  console.log('--- running block', i, '(', b.code.length, 'chars, starts at html line', b.startLine, ')');
  try {
    window.eval(b.code);
    console.log('block', i, 'completed without throwing');
  } catch (e) {
    console.log('BLOCK', i, 'THREW:', e.constructor.name + ':', e.message);
    const st = (e.stack || '').split('\n').slice(0, 5).join('\n');
    console.log(st);
    // Map eval line back to html line: eval stacks say "<anonymous>:LINE:COL"
    const lm = (e.stack || '').match(/<anonymous>:(\d+):(\d+)/);
    if (lm) {
      const rel = parseInt(lm[1], 10);
      const htmlLine = b.startLine + rel - 2; // eval starts at line 2 of the wrapper
      console.log('approx html line:', htmlLine, '->', (htmlLines[htmlLine - 1] || '').trim().slice(0, 120));
    }
    break;
  }
}
// Give async boot a moment, then report any late errors
setTimeout(() => { console.log('DONE (async window elapsed)'); process.exit(0); }, 2500);
