#!/usr/bin/env node
// 80.6.4 - the transition wrapper, checked on the page that ships.
//
//   node dev/check-8064.cjs
//
// The bug this release fixes was an UNHANDLED REJECTION, so a source-grep check
// would prove nothing: the abort has to actually be raised and seen not to escape.
// The whole block that wraps navigate() is sliced out of index.html and run in a vm
// with a fake document, then driven through the five cases the fix names - hidden
// page, normal swap, abort on ready, abort before the update callback, and reduce
// motion - with a process-level unhandledRejection counter standing in for the boot
// banner.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pass = 0, fail = 0;

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' \u2014 ' + detail : '')); }
}

const unhandled = [];
process.on('unhandledRejection', (r) => { unhandled.push((r && (r.message || String(r))) || 'rejection'); });

const abortErr = () => {
  const e = new Error('Transition was aborted because of invalid state. Document hidden');
  e.name = 'InvalidStateError';
  return e;
};

// The wrapper block, exactly as the page has it.
const start = page.indexOf('    var _scNavInner = navigate;');
const endMark = 'window.navigate = scNavigateSmooth;';
const end = page.indexOf(endMark);
ok('the nav wrapper is in the page once', start > -1 && end > start);

function harness(opts) {
  const calls = [];
  const started = [];
  const ctx = {
    console,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    localStorage: { getItem: () => null, setItem: () => {} },
    __calls: calls,
    document: {
      visibilityState: opts.visibility || 'visible',
      body: { classList: { contains: (c) => !!(opts.reduceMotion && c === 'sandbox-reduce-motion') } },
      startViewTransition(cb) {
        started.push(cb);
        return opts.transition(cb);
      },
    },
  };
  ctx.window = ctx;
  ctx.matchMedia = () => ({ matches: false });
  vm.createContext(ctx);
  vm.runInContext('var navigate = function(v){ __calls.push(v); };', ctx);
  if (start > -1 && end > start) vm.runInContext(page.slice(start, end), ctx);
  return { ctx, calls, started };
}

const settled = () => new Promise(r => setTimeout(r, 40));

(async () => {
  ok('the page runs 80.6.4', page.includes("const APP_VERSION = '80.6.4';"));
  ok('the release marker is in the script', page.includes('80.6.4 - THE TRANSITION WAITS FOR A VISIBLE PAGE'));
  ok('the changelog records 80.6.4', page.includes("{ version: '80.6.4', date: '"));

  const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let parsed = 0, broken = 0;
  scripts.forEach((src, i) => {
    if (!src.trim() || /^\s*import /.test(src)) return;
    try { new Function(src); parsed++; }
    catch (e) { broken++; console.log('  FAIL script block ' + (i + 1) + ' does not parse \u2014 ' + e.message); }
  });
  ok('every inline script block parses', parsed > 0 && broken === 0, parsed + ' block(s)');
  fail += broken;

  // ---- 1. A hidden page does not start a transition at all -----------------
  {
    const h = harness({ visibility: 'hidden', transition: () => { throw new Error('started'); } });
    vm.runInContext('__scNavigateSmooth("library")', h.ctx);
    ok('a hidden page never starts a transition', h.started.length === 0, h.started.length + ' started');
    ok('and still navigates, exactly once', h.calls.length === 1 && h.calls[0] === 'library', JSON.stringify(h.calls));
  }

  // ---- 2. A normal swap is untouched ---------------------------------------
  {
    const h = harness({
      transition(cb) {
        const swap = Promise.resolve().then(() => cb());
        return { ready: Promise.resolve(), updateCallbackDone: swap, finished: swap };
      },
    });
    vm.runInContext('__scNavigateSmooth("discover")', h.ctx);
    await settled();
    ok('a visible page starts one transition', h.started.length === 1);
    ok('and the swap runs it once', h.calls.length === 1 && h.calls[0] === 'discover', JSON.stringify(h.calls));
  }

  // ---- 3. The abort on `ready` is the leak: it must not escape -------------
  {
    unhandled.length = 0;
    const h = harness({
      transition(cb) {
        const swap = Promise.resolve().then(() => cb());
        return { ready: Promise.reject(abortErr()), updateCallbackDone: swap, finished: Promise.reject(abortErr()) };
      },
    });
    vm.runInContext('__scNavigateSmooth("studio")', h.ctx);
    await settled();
    ok('an abort while the page goes hidden raises no unhandled rejection', unhandled.length === 0,
       unhandled.join(' | '));
    ok('and the swap that did happen is not repeated', h.calls.length === 1 && h.calls[0] === 'studio',
       JSON.stringify(h.calls));
  }

  // ---- 4. An abort BEFORE the update callback must not swallow the tap -----
  {
    unhandled.length = 0;
    const h = harness({
      transition() {
        return { ready: Promise.reject(abortErr()), updateCallbackDone: Promise.reject(abortErr()), finished: Promise.reject(abortErr()) };
      },
    });
    vm.runInContext('__scNavigateSmooth("settings")', h.ctx);
    await settled();
    ok('an abort before the swap still navigates', h.calls.length === 1 && h.calls[0] === 'settings',
       JSON.stringify(h.calls));
    ok('and does it once, not twice', h.calls.length === 1, h.calls.length + ' call(s)');
    ok('and that case leaks nothing either', unhandled.length === 0, unhandled.join(' | '));
  }

  // ---- 5. Reduce motion is still the plain path ----------------------------
  {
    const h = harness({ reduceMotion: true, transition: () => { throw new Error('started'); } });
    vm.runInContext('__scNavigateSmooth("library")', h.ctx);
    ok('reduce motion still skips the transition', h.started.length === 0);
    ok('and navigates once', h.calls.length === 1, JSON.stringify(h.calls));
  }

  // ---- 6. The shape of the fix, so a later edit cannot quietly undo it -----
  const nav = start > -1 && end > start ? page.slice(start, end) : '';
  ok('the visibility door is in the wrapper', nav.includes("if(document.visibilityState !== 'visible') return _scNavInner(view);"));
  ok('all three promises are owned', ['scVtQuiet(vt.ready);', 'scVtQuiet(vt.updateCallbackDone);', 'scVtQuiet(vt.finished);']
     .every(s => nav.includes(s)));
  ok('the lone finished catch is gone', !nav.includes('if(vt && vt.finished && typeof vt.finished.catch'));
  ok('the replay is guarded by the ran flag', nav.includes('if(ran) return;') && nav.includes('ran = true;'));
  ok('the shell cache is v80.6.4', fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'sidecut-shell-v80.6.4'"));

  // Nothing above may leave a rejection for the banner either.
  await settled();
  ok('the whole run left no unhandled rejection', unhandled.length === 0, unhandled.join(' | '));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  // The unhandledRejection listener above deliberately swallows rejections, so a
  // THROW inside this driver would otherwise be counted and exit 0 - a false pass.
  console.log('  FAIL the driver crashed \u2014 ' + ((e && e.stack) || e));
  process.exit(1);
});
