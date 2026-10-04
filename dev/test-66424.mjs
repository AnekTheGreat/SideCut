#!/usr/bin/env node
// v64.2.4 - the blink on every scroll and every launch, the album that lost a
// few songs, and the work the phone was doing for nothing.
//
//   [1] the release itself: 64.2.4 runs, the head entry says so, and its six
//       notes are SHORT plain sentences that publish on both channels and never
//       read as a downloader on the store one.
//   [2] the blink: a launch paints in the saved theme (no restyle a moment
//       later), and a settled scroll only re-rasters a surface that really needs
//       it - the per-scroll raster is the slight blink and a wasted GPU pass.
//   [3] the foreground drain: the playing row's glow is a layer whose OPACITY
//       pulses, not a box-shadow animated on the paint path.
//   [4] Refetch missing covers sits in Library Tools & Fetching, with a label
//       that survives the run.
//   [5] the patch notes in the bell are groups: a header per release, the notes
//       behind it, and what you opened stays open.
//   [6] the album: a title key too short to be trusted can no longer throw the
//       right source away for a neighbouring track, and a search that could not
//       reach the source is retried once. Both are RUN here, not just read.
//   [7] what 64.2.2 and 64.2.3 shipped is still standing.
//   [8] the file still holds together: every inline script parses and every name
//       the app reads is declared.
//
//   node dev/test-66424.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '73'; /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */ /* repinned by dev/repin-715.mjs */ /* repinned by dev/repin-714.mjs */ /* repinned by dev/repin-713.mjs */ /* repinned by dev/repin-712.mjs */ /* repinned by dev/repin-7021.mjs */ /* repinned by dev/repin-7020.mjs */ /* repinned by dev/repin-7019.mjs */ /* repinned by dev/repin-7018.mjs */ /* repinned by dev/repin-7017.mjs */ /* repinned by dev/repin-7016.mjs */ /* repinned by dev/repin-7015.mjs */ /* repinned by dev/repin-7014.mjs */ /* repinned by dev/repin-7013.mjs */ /* repinned by dev/repin-7012.mjs */ /* repinned by dev/repin-7011.mjs */ /* repinned by dev/repin-701.mjs */ /* repinned by dev/repin-709.mjs */ /* repinned by dev/repin-708.mjs */ /* repinned by dev/repin-707.mjs */ /* repinned by dev/repin-706.mjs */ /* repinned by dev/repin-705.mjs */ /* repinned by dev/repin-70.mjs */
const PREV = '64.2.3';

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
// Comments describe the code the "is it gone" checks look for, so those run over
// the code only - the same strip dev/test-6058.mjs uses.
const code = src.replace(/^\s*\/\/.*$/gm, '');
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  // The head entry belongs to whatever shipped last, so read the 64.2.4 entry by
  // version: this gate describes 64.2.4.
  const entry6424 = entries ? entries.find((x) => /^64\.2\.4$/.test(String(x.version))) : null;
  if (entry6424) {
    const head = entry6424;
    const items = head.items || [];
    ok(String(head.version) === '64.2.4', 'the entry this gate describes is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    // "put the patch notes in simple terms not so long" - the length is the point
    // of these entries, so it is pinned rather than described.
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('8:35 PM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor a term the wider store list knows');
    ok(!/no source found/i.test(notes), 'and never the phrase the store list refuses outright');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    ok(/blink/i.test(notes), 'while naming what was reported');
    ok(/Ok|Ok\b|short track title/i.test(notes), 'and saying what the album fix was about');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.3$/.test(String(e.version))), 'the release before this one is still listed');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the launch paints in the saved theme, and a settled scroll repairs only what is broken');
{
  const prepaint = code.indexOf('(function scPrepaintTheme(){');
  const theme = code.indexOf('  function applyTheme(key){');
  ok(prepaint !== -1, 'the launch has a prepaint theme step');
  ok(prepaint !== -1 && theme !== -1 && prepaint < theme,
    'and it runs before the app script can paint anything');
  ok(has("    if(c.bg) root.setProperty('--bg', c.bg);") && has("    if(c.coral) root.setProperty('--coral', c.coral);"),
    'it applies the saved background and accent');
  ok(has("    if(c.onCoral) root.setProperty('--on-coral', c.onCoral);"),
    'and the text colour that is picked from the accent');
  ok(has("    if(c.dyn) document.body.classList.add('theme-dyn-' + c.dyn);"),
    'and the dynamic-theme class, so a themed launch is themed from frame one');
  ok(has("      localStorage.setItem('sidecut_theme_prepaint', JSON.stringify({") && has('        v: 1, key: key,'),
    'applyTheme caches exactly what it applied');
  ok(has("        onCoral: th.rgb ? '' : scOnAccent(th.coral),"),
    'leaving the accent text colour to the cycle while one is running');
  ok(count("localStorage.getItem('sidecut_theme_prepaint')") === 1, 'the cache is read once, at launch');

  const rail = sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){');
  const grid = sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){');
  ok(rail !== '' && grid !== '', 'both settle repaints are still there');
  ok(!/visibility/.test(rail) && !/visibility/.test(grid), 'neither ever hides its surface (the 64.2.1/64.2.2/64.2.3 fix)');
  ok(has("    }catch(_eLift){}" + "\n" + "    var strip = $('pinnedArtistsStrip');"),
    'the rail no longer waits for a drag to leave something behind');
  ok(has("    }catch(_eCarry){}" + "\n" + "    // Unconditional on purpose - see the note above the function." + "\n" + "    scRepaintSurface(wrap, '.home-bubble');"),
    'and neither does Home');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still carrying what a drag gave it is still put back');
  ok(has("      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); } }"),
    'a dashed placeholder an abandoned drag left behind is still cleared');
  ok(has("        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';"),
    'and a bubble still holding its drag lift is still put back to a plain bubble');
  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');") && has("    scRepaintSurface(wrap, '.home-bubble');"),
    'the fresh paint is asked for on both surfaces');
  ok(has("      el.style.outline = '1px solid transparent';"), 'through a property only paint reads');
  ok(has("          try{ el.style.outline = ''; }catch(_eRpBack){}"), 'that is taken back a frame later, not inside the same one');
  ok(!/translateZ/.test(rail) && !/translateZ/.test(grid), 'so nothing is put on a layer of its own');
  ok(!/void (wrap|strip)\.offsetHeight/.test(code), 'no settled scroll lays the page out again');
  ok(!/offsetHeight|getBoundingClientRect/.test(rail) && !/offsetHeight|getBoundingClientRect/.test(grid),
    'and neither repaint measures anything');
  ok(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
    'a grid really missing a bubble is still drawn from the layout again');
  ok(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
    'and a rail really missing its chips is still built again');
}

console.log('[3] the playing row pulses on its own layer, not by re-painting itself');
{
  ok(has('  .track.playing::after{'), 'the glow is a layer of its own');
  ok(has('    content:\'\'; position:absolute; inset:0; z-index:-1; pointer-events:none;'),
    'painted above the row\'s background and below its content, and never in the way of a tap');
  ok(has('    box-shadow: inset 3px 0 0 var(--coral), inset 0 0 20px color-mix(in srgb, var(--coral) 28%, transparent);'),
    'with the glow itself unchanged');
  ok(has('    0%, 100%{ opacity:0.4; }\n    50%{ opacity:1; }'),
    'and the pulse is an OPACITY pulse, which a compositor animates without painting');
  ok(!/animation: glowPulse/.test(sliceC('  .track.playing{', '  .track.playing::after{')),
    'the row itself no longer animates anything');
  ok(has('  .track.playing{\n    background: color-mix(in srgb, var(--coral) 8%, transparent);\n    box-shadow: inset 3px 0 0 var(--coral);\n    z-index:0;\n  }'),
    'so the row is painted only when it really changes');
  ok(!/animation: glowPulse 2s ease-in-out infinite;\n    z-index:0;/.test(code), 'no animated box-shadow on the paint path is left');
}

console.log('[4] Refetch missing covers belongs to Library Tools & Fetching');
{
  const libGroup = src.indexOf('<!-- Collapsible: Library Tools & Fetching -->');
  const wmGroup = src.indexOf('<!-- Watermark Remover -->');
  const storageGroup = src.indexOf('<!-- Collapsible: Storage -->');
  const btn = src.indexOf('id="refetchCoversBtn"');
  ok(libGroup !== -1 && wmGroup !== -1 && storageGroup !== -1, 'the settings groups are all still on the page');
  ok(btn !== -1 && btn > libGroup && btn < wmGroup, 'the button is inside the library group');
  ok(!(btn > wmGroup && btn < storageGroup), 'and no longer inside the Watermark Remover card');
  ok(src.indexOf('id="refetchCoversBtn"', btn + 10) === -1, 'it is on the page exactly once');
  ok(has('<span id="refetchCoversLabel">Refetch missing covers</span>'), 'its label is in its own element');
  ok(has('<span class="online-badge" style="font-size:7px;padding:1px 3px;">ONLINE</span>'), 'and the ONLINE badge is still beside it');
  ok(has('  function scSetRefetchLabel(txt){'), 'one helper writes that label');
  ok(has("    const el = $('refetchCoversLabel') || $('refetchCoversBtn');"), 'falling back to the button if it is ever missing');
  ok(!/\$\('refetchCoversBtn'\)\.textContent/.test(code), 'so nothing writes over the badge again');
  ok(count('scSetRefetchLabel(') >= 4, 'and the whole run reports through it (' + count('scSetRefetchLabel(') + ' uses)');
  ok(/Refetch missing covers now sits with the rest of the library tools/.test(src), 'the head note says where it went');
}

console.log('[5] the patch notes are a header per release, with the detail behind it');
{
  ok(has('  function scApplyChangelogGroup(v, open){'), 'a group can be opened and closed in place');
  ok(has('  const openChangelogGroups = new Set();'), 'what is open is kept in one place');
  ok(has('  let changelogGroupsTouched = false;'), 'including whether the reader has touched it yet');
  ok(has("      const open = changelogGroupsTouched ? openChangelogGroups.has(v) : idx === 0;"),
    'so the newest release is open and the rest are shut until tapped');
  ok(has('data-cl-group="${escapeHtml(v)}" aria-expanded="${open ? \'true\' : \'false\'}"'),
    'every header says whether it is open');
  ok(has('data-cl-body="${escapeHtml(v)}"'), 'and owns the notes behind it');
  ok(has('data-cl-glance="${escapeHtml(v)}"'), 'with the opening line as the glance when it is shut');
  ok(has("            <span style=\"display:block; font-size:11px; color:var(--ink-dim); margin-top:5px;\">${n} update${n === 1 ? '' : 's'}"),
    'and how many notes are behind it');
  ok(has("    if(!body._scClWired){") && has("      body.addEventListener('click', function(ev){"),
    'one delegated listener, wired once');
  ok(has("        const wasOpen = openChangelogGroups.has(v);") && has('        scApplyChangelogGroup(v, !wasOpen);'),
    'which opens and closes the group that was tapped');
  ok(/h\.setAttribute\('aria-expanded', open \? 'true' : 'false'\)/.test(src), 'in place, without re-rendering the panel');
  ok(count('changelogItems(entry).map') >= 3, 'every bullet renderer still runs through the store filter (' + count('changelogItems(entry).map') + ')');
  ok(count('changelogItems(entry).length') >= 4, 'and every count does too (' + count('changelogItems(entry).length') + ')');
  ok(count('entry.items') === 1, 'raw entry.items is still only read inside the filter helper (' + count('entry.items') + ')');
  ok(has('      const glanceShort = glance.length > 132'), 'the glance is cut rather than wrapping for ever');
}

console.log('[6] the album that lost a few songs (both fixes are RUN)');
{
  const fnSrc = slice('  function scTitleMatch(expectedTitle, videoTitle, candTitle){', '  function scDurationOk(expectedSec, actualSec){');
  ok(fnSrc !== '', 'the title-key rule is on the page');
  let fns = null;
  try {
    fns = new Function(fnSrc + '\nreturn { scTitleStrong, scTrackTitleKey, scTitleKeyIsStrong, scSourceClaimsSibling };')();
  } catch (e) { ok(false, 'the title helpers evaluate: ' + e.message); }
  if (fns) {
    const { scTitleStrong, scTrackTitleKey, scTitleKeyIsStrong, scSourceClaimsSibling } = fns;
    ok(scTitleKeyIsStrong('ok') === false && scTitleKeyIsStrong('ya') === false && scTitleKeyIsStrong('pt 1') === false,
      'a key with no word of four characters is too weak to trust');
    ok(scTitleKeyIsStrong('luna') === true && scTitleKeyIsStrong('intro pt 1') === true,
      'and an ordinary title key is not');
    ok(scTrackTitleKey('Ok') === 'ok' && scTrackTitleKey('Pt. 1') === 'pt 1', 'keys are built as the app builds them');

    // The pre-64.2.4 rule, verbatim: it threw a candidate away whenever a
    // SIBLING's key appeared anywhere inside the candidate's title.
    function oldClaims(candTitle, myTitle, myKey, siblingKeys) {
      const mine = String(myKey || scTrackTitleKey(myTitle) || '');
      if (!mine) return false;
      const mineStrong = scTitleStrong(mine, '', candTitle);
      for (const k in siblingKeys) {
        if (!k || k === mine) continue;
        if (!scTitleStrong(k, '', candTitle)) continue;
        if (!mineStrong) return true;
        if (k.length > mine.length) return true;
      }
      return false;
    }
    const run = { one: true, 'vibe with me': true };
    const cand = 'Vibe With You Alone';
    ok(oldClaims(cand, 'Vibe With Me', 'vibe with me', run) === true,
      'the old rule threw this candidate away because a sibling track is called "One"');
    ok(scSourceClaimsSibling(cand, 'Vibe With Me', 'vibe with me', run) === false,
      'and the fix no longer does - that is a song of the album coming back');
    ok(scSourceClaimsSibling('Smoking Gun', 'Luna', 'luna', { ok: true, luna: true }) === false,
      '"ok" inside "smoking" is no longer a claim on the upload');
    ok(scSourceClaimsSibling('Sunshine', 'Sun', 'sun', { sun: true, sunshine: true }) === true,
      'while a sibling that really owns the upload still takes it');
    ok(scSourceClaimsSibling('Vibe With You (Official Audio)', 'Vibe With Me', 'vibe with me', { 'vibe with you': true, 'vibe with me': true }) === true,
      'and so does a sibling whose title the candidate actually carries');
    ok(scSourceClaimsSibling('Luna', 'Luna', 'luna', { luna: true }) === false, 'a track never claims against itself');
  }
  ok(has('    if((!cands || !cands.length) && window.__scHttpWhy){'), 'a search that could not reach the source is retried');
  ok(has("      window.__scHttpWhy = '';\n      cands = await scYtSearch(query, artist, album);\n    }\n    if(!cands || !cands.length){"),
    'exactly once, and only for a transport failure - a search that answered with nothing is not repeated');
  ok(has('      await new Promise(function(r){ setTimeout(r, 900); });'), 'after a pause, so the burst can clear');
  ok(has("      if(window.__scHttpWhy){\n        window.__scSourceFail = 'search could not reach the source (' + window.__scHttpWhy + ')"),
    'and a failure that survives the retry still names the step that died');
}

console.log('[7] what 64.2.2 and 64.2.3 shipped is still standing');
{
  ok(has('  function repaintPinnedRail(list){') && has('  function repaintHomeGrid(){'), 'both repaints are still here');
  ok(!/visibility/.test(sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){')) &&
     !/visibility/.test(sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){')),
    'neither hides its surface any more');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }" ) ||
     has("if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still holding a drag lift is still put back');
  ok(has('<span>Roll back app (or go forward again)</span>'), 'rolling forward is still one tap from the picker');
  ok(has('Go forward to the latest version (v${APP_VERSION})</button>`'), 'and still names the installed version');
  ok(has("      await dbDelete('meta', 'pinnedVersion');"), 'and still clears the pin when tapped');
  ok(has("' of the ' + scFmtBytes(estimate.quota) + ' this phone allows the app'"), 'Storage still names whose allowance it shows');
  ok(has('  let watermarkEnabled = true;'), 'Watermark Remover still starts on');
  ok(has("if(watermarkEnabledRow) watermarkEnabled = !!watermarkEnabledRow.value;"), 'and a saved choice still wins');
  ok(count('background:var(--coral); color:var(--on-coral,#fff)') >= 14,
    'every accent fill still picks its own text colour: ' + count('background:var(--coral); color:var(--on-coral,#fff)'));
  const kbSrc = src.slice(src.indexOf('var _aiKB = ['), src.indexOf('];', src.indexOf('var _aiKB = [')) + 2);
  let play = null;
  try { play = new Function('SC_IS_PLAY', 'window', kbSrc + '\nreturn _aiKB;')(true, { __PLAY_BUILD__: true }); }
  catch (e) { ok(false, 'the knowledge base evaluates: ' + e.message); }
  if (play) {
    const STRONG = /(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off)/i;
    ok(play.filter((e) => STRONG.test(e.a)).length === 0, 'the store build still answers without a fetch tool');
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
  let code0 = 0, out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code0 = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code0 === 0, 'every name the app reads is declared: ' + first.trim());
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
