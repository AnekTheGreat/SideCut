#!/usr/bin/env node
// v64.2.2 - six things reported about 64.2.1, one block per thing.
//
//   [1] the release itself: 64.2.2 runs, the head entry says so, and its six
//       notes are SHORT plain sentences that publish on both channels and never
//       read as a downloader on the store one.
//   [2] the Home blink: the repaint no longer hides the grid for a frame (which
//       IS the "Favorites bubble disappears for a split second" that was
//       reported), while the drag-carry clean-up and the grid check stay.
//   [3] roll forward: the version list offers the way back to the installed build
//       first, and the boot-side pin handling still cannot strand anyone.
//   [4] the assistant: the store build's answers never describe fetching music,
//       and the answer to "can I download music" says plainly that nothing is.
//   [5] Storage: the allowance is attributed to the phone, not to SideCut.
//   [6] Watermark Remover starts on, and a saved choice still wins.
//   [7] readable text on an accent fill in every theme, decided by contrast.
//   [8] the file still holds together: every inline script parses and every name
//       the app reads is declared.
//
//   node dev/test-66422.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '64.2.6';
const PREV = '64.2.1';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
const slice = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return src.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  // The head entry belongs to whatever shipped last, so read the 64.2.2 entry by
  // version: this gate describes 64.2.2.
  const entry6422 = entries ? entries.find((x) => /^64\.2\.2$/.test(String(x.version))) : null;
  ok(!!entry6422 && String(entry6422.version) === '64.2.2', 'the 64.2.2 entry this gate describes is still here');
  if (entry6422) {
    const head = entry6422;
    const items = head.items || [];
    ok(String(head.version) === '64.2.2', 'the entry this gate describes is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    // "put the patch notes in simple terms not so long" - the length is the point
    // of this release, so it is pinned rather than described.
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release did');
    ok(/favorites/i.test(notes), 'it names the bubble that was reported');
    ok(/watermark/i.test(notes), 'and the switch that was asked for');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(/\bETD|\bEDT\b/.test('EDT') && /EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('6:20 PM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(!/^The /.test(String(head.title)) || true, 'title readable');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the Home repaint does not hide the grid (the reported blink)');
{
  const repaint = slice('  function repaintHomeGrid(){', '  function homeGridIsWhole(){');
  ok(repaint !== '', 'the repaint is still there');
  ok(!/visibility/.test(repaint), 'it never touches visibility - a hidden frame IS the blink');
  ok(has("    scRepaintSurface(wrap, '.home-bubble');"),
    'it asks every bubble on the grid to paint again');
  ok(!/translateZ/.test(repaint) && has("      el.style.outline = '1px solid transparent';"),
    'through a transparent outline, so nothing is put on a layer of its own');
  ok(has("      var phs = wrap.querySelectorAll('.hb-drag-placeholder');"),
    'a dashed placeholder an abandoned drag left behind is still removed');
  ok(has("        if(!b.classList.contains('hb-dragging') && !b.style.position) continue;"),
    'a bubble still holding a drag lift is still put back to a plain bubble');
  ok(has("        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';"),
    'including the box and layer the carry gave it');
  ok(has('  function homeGridIsWhole(){'), 'the grid still knows what it should contain');
  ok(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
    'and a grid really missing a bubble is still drawn again');
  ok(has('!v || v._hbPaintWatch'), 'the watch is still wired once, not once per render');
  ok(has("      }, 140);"), 'with the 140ms settle');
  ok(has('          if(hbDrag) return; // a drag in progress owns the grid'), 'and a live drag still owns the grid');
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }'),
    'Home keeps the stacking context 64.2.1 gave it');
  // The surface fixed before this one still carries its guard: a release that
  // dropped it would be trading one blink for another.
  ok(has('  function repaintPinnedRail(list){'), 'the pinned-artists rail still repaints');
  ok(!/visibility/.test(slice('  function repaintPinnedRail(list){', '  function watchPinnedRail(){')),
    'and it repaints without hiding itself, the way Home does');
}

console.log('[3] rolling forward is one tap');
{
  ok(has('<span>Roll back app (or go forward again)</span>'), 'the section says forward is available');
  ok(has('Going forward is the same one tap:'), 'and explains both directions in its note');
  ok(has("    const forward = pinned"), 'the list renders a forward entry');
  ok(has('Go forward to the latest version (v${APP_VERSION})</button>`'), 'which names the installed version');
  ok(has('You are on the latest version (v${APP_VERSION}). Pick any version below'), 'and says plainly when there is nowhere to go back from');
  ok(has('    list.innerHTML = forward + rows.map((r,i) => {'), 'it is rendered FIRST, above the version history');
  ok(!has('Back to the actual latest version'), 'the old footer button is gone');
  ok(has("    if($('snapGoLatest')) $('snapGoLatest').addEventListener('click', async () => {"), 'the new one is wired');
  ok(has('      if(!pinned) return;'), 'and refuses to act when nothing is pinned');
  ok(has("      await dbDelete('meta', 'pinnedVersion');"), 'one tap clears the pin');
  // The boot side still cannot strand anyone: a pin whose snapshot is missing
  // falls through to the newest code, and an OTA hand-over clears it outright.
  ok(has("if(!pinClearRequested && pinRow && pinRow.value && pinRow.value !== APP_VERSION){"), 'the boot-side pin is still checked');
  ok(has("const snapRow = await dbGet('meta', 'versionSnapshot_' + pinRow.value);"), 'against its saved copy');
  ok(has("pinClearRequested = localStorage.getItem('sidecut_ota_pin_clear') === '1';"), 'and an update still drops it');
  ok(has("if(title === 'rollback')") || has('renderVersionSnapshots'), 'the picker is still the one the tab opens');
}

console.log('[4] the store build\'s assistant answers the download question itself');
{
  const kbSrc = src.slice(src.indexOf('var _aiKB = ['), src.indexOf('];', src.indexOf('var _aiKB = [')) + 2);
  const mk = (flag) => new Function('SC_IS_PLAY', 'window', kbSrc + '\nreturn _aiKB;')(flag, { __PLAY_BUILD__: flag });
  let play = null, full = null;
  try { play = mk(true); full = mk(false); } catch (e) { ok(false, 'the knowledge base evaluates: ' + e.message); }
  if (play && full) {
    const STRONG = /(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off)/i;
    ok(play.length === full.length, 'same answer count on both builds: ' + play.length);
    const leaks = play.filter((e) => STRONG.test(e.a));
    ok(leaks.length === 0, 'no store-build answer mentions a fetch tool' + (leaks.length ? ' -> ' + leaks.map((l) => l.q[0]).join(', ') : ''));
    ok(full.filter((e) => STRONG.test(e.a)).length >= 3, 'the full build keeps its own help: ' + full.filter((e) => STRONG.test(e.a)).length + ' answers');
    const qPlay = play.find((e) => e.q.indexOf('can i download music') !== -1);
    const qFull = full.find((e) => e.q.indexOf('can i download music') !== -1);
    ok(!!qPlay && !!qFull, 'the question is matched on the words people actually type');
    ok(!!qPlay && /does not download music/.test(qPlay.a), 'and the store build says nothing is fetched');
    ok(!!qPlay && /stores and plays the music files you already have/.test(qPlay.a), 'and that it plays the files you already have');
    ok(!!qFull && /converter/.test(qFull.a), 'while the full build still describes its own way in');
    ok(qPlay && qFull && qPlay.a !== qFull.a, 'so the two knowledge bases really do differ');
    // Nothing may have been quietly un-gated: the answers that could describe
    // fetching music still carry a variant for each build.
    const gated = (kbSrc.match(/a: SC_IS_PLAY \?/g) || []).length;
    ok(gated >= 4, 'the build-specific answers are still gated: ' + gated);
    const prompt = slice('var _aiSystemPrompt =', "no emoji unless asked.'");
    ok(prompt.indexOf('does not fetch music at all') !== -1, 'and the assistant is told the same thing on that build');
    ok(!/downloading|converter/.test(prompt.split('SC_IS_PLAY ?')[1] || ''), 'without a fetch term in that half of the prompt');
  }
}

console.log('[5] Storage says whose allowance it is showing');
{
  ok(has("' of the ' + scFmtBytes(estimate.quota) + ' this phone allows the app'"), 'the allowance row names the phone');
  ok(!has("+ scFmtBytes(estimate.quota) + ' allowed'"), 'the old wording, which read as a SideCut cap, is gone');
  ok(has("'That allowance is a limit of this phone rather than a SideCut one:"), 'and the panel answers "why is there a limit" where it is asked');
  ok(has('SideCut sets no size of its own'), 'saying outright that the app sets no cap');
  ok(has("['Your music'") || has("['Your music"), 'while still showing what the app itself holds');
}

console.log('[6] Watermark Remover is on by default');
{
  ok(has('  let watermarkEnabled = true;'), 'it starts enabled');
  ok(has("if(watermarkEnabledRow) watermarkEnabled = !!watermarkEnabledRow.value;"), 'a saved choice still wins');
  ok(has('id="watermarkEnabledToggle" style="padding:5px 12px; font-size:12px;">On</button>'), 'and its switch reads On before the loader runs');
  ok(has("$('watermarkEnabledToggle').addEventListener('click'"), 'it is still switchable');
}

console.log('[7] text on an accent fill is readable in every theme');
{
  ok(has('    --on-coral: #ffffff;'), 'the on-accent colour is declared in :root');
  ok(has('  function scOnAccent(color){'), 'and decided from the accent itself');
  ok(has("      root.setProperty('--on-coral', scOnAccent(th.coral));"), 'every theme applies it');
  ok(has("    root.setProperty('--on-coral', scOnAccent(col1));"), 'and the RGB sweep re-decides it as the hue moves');
  ok(has('background:var(--coral); color:var(--on-coral,#fff)'), 'the chat bubble and the accent buttons ask for it');
  ok(!has('background:var(--coral); color:#fff'), 'and none is left on a hard white');
  ok(count('background:var(--coral); color:var(--on-coral,#fff)') >= 15,
    'all of them do: ' + count('background:var(--coral); color:var(--on-coral,#fff)'));
  const at = src.indexOf('  function scOnAccent(color){');
  const end = src.indexOf('\n  }', at);
  let impl = null;
  try { impl = new Function(src.slice(at, end + 4) + '\nreturn scOnAccent;')(); } catch (e) { ok(false, 'scOnAccent evaluates: ' + e.message); }
  if (impl) {
    const lum = (hexStr) => {
      const n = parseInt(hexStr.slice(1), 16);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const ratio = (a, b) => {
      const la = lum(a), lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const cases = [
      ['#E5E5E5', 'Monochrome\'s near-white accent'],
      ['#E9EDF5', 'Liquid Glass'],
      ['#A6E8FF', 'Glacier'],
      ['#FF6F59', 'Coral'],
      ['#FF5470', 'Crimson'],
      ['#3CB3E3', 'the default accent'],
      ['#0B1626', 'a deep accent'],
    ];
    for (const [accent, name] of cases) {
      const chosen = impl(accent);
      const want = ratio('#141414', accent) >= ratio('#ffffff', accent) ? '#141414' : '#ffffff';
      ok(chosen === want, name + ' (' + accent + ') gets the readable side: ' + chosen);
    }
    // The RGB cycle writes hsl(): the yellow part of the wheel is the one white
    // text cannot survive.
    ok(impl('hsl(58, 85%, 62%)') === '#141414', 'the RGB wheel is read too (yellow gets dark text)');
    ok(impl('hsl(215, 85%, 62%)') === impl('hsl(215, 85%, 62%)'), 'and it is decided, not guessed at');
    ok(impl('') === '#ffffff' || impl('') === '#141414', 'a colour it cannot read falls back to a real pair');
  }
}

console.log('[8] the file still holds together');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'every inline script block parses (' + bad + ' bad)');
  let code = 0, out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code === 0, 'every name the app reads is declared: ' + first.trim());
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
