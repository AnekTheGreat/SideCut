// v60.5.7 verification — the three reported problems, checked as BEHAVIOUR
// where cheap (the album helper, the auto-check throttle and the upcoming
// filter actually run against stubs) and as structure everywhere else:
//   1. "Remove from an album" removes the song from ONE album only
//   2. pinned artists are checked automatically (premium + online + 6h gap)
//      and future-dated releases surface as "Dropping soon" in the bell with
//      "drops …" labels instead of "today"
//   3. Home reorder no longer flickers: glow phase survives re-renders and the
//      drag placeholder keeps a big bubble's footprint
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (hay, needle) => { let n = 0, i = hay.indexOf(needle); while (i !== -1) { n++; i = hay.indexOf(needle, i + needle.length); } return n; };

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.3.6', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].date.endsWith('EDT'), 'date ends in EDT (' + entries[0].date + ')');
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
  const shared = entries[0].items.filter((i) => !i.startsWith('[FULL] '));
  ok(shared.length >= 1, 'shared items for the other channel: ' + shared.length);
  const malformed = entries.flatMap((e) => e.items).filter((i) => i.includes('[FULL]') && !i.startsWith('[FULL] '));
  ok(malformed.length === 0, 'marker only ever appears as a clean [FULL] prefix (' + malformed.length + ' malformed)');
  const anyFull = entries.flatMap((e) => e.items).filter((i) => i.startsWith('[FULL] '));
  ok(anyFull.length >= 2, 'full-only items still marked across entries: ' + anyFull.length);
  ok(!/play build|play version|play install/i.test(entries[0].items.join('\n')), 'notes never name the play build');
}
ok(sw.includes('sidecut-shell-v' + ver), 'service worker cache follows the version');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version + ' (a new Play build number)');

console.log('[2] remove from album — ONE album only (behaviour)');
{
  const start = src.indexOf('function scRemoveFromAlbum(trackId, albumName){');
  const end = src.indexOf('\n  function openSongActions', start);
  ok(start !== -1 && end !== -1, 'helper extractable');
  if (start !== -1 && end !== -1) {
    const code = src.slice(start, end);
    try {
      const mk = new Function('userAlbums', code + '\nreturn scRemoveFromAlbum;');
      const ua = {
        'First album':  { trackIds: ['t1', 't2'] },
        'Second album': { trackIds: ['t1'] },
        'Other music':  { trackIds: ['t9'] },
      };
      const helper = mk(ua);
      // Context album wins: only THAT album loses the song.
      const r1 = helper('t1', 'Second album');
      ok(r1 === 'Second album', 'returns the album it removed from (' + r1 + ')');
      ok(ua['Second album'].trackIds.indexOf('t1') === -1, 'named album lost the song');
      ok(ua['First album'].trackIds.indexOf('t1') !== -1, 'other album STILL HAS the song');
      // Unknown context falls to the first album that holds it — still only one.
      const r2 = helper('t1', 'Not an album');
      ok(r2 === 'First album', 'bad context falls back to first holder (' + r2 + ')');
      ok(ua['First album'].trackIds.indexOf('t1') === -1, 'fallback album lost the song');
      ok(ua['Other music'].trackIds.join() === 't9', 'unrelated album untouched');
      // No holder → no-op, no throw.
      const before = JSON.stringify(ua);
      const r3 = helper('nope', '');
      ok(r3 === '', 'unknown track returns empty string');
      ok(JSON.stringify(ua) === before, 'nothing changed for an unheld track');
    } catch (e) { ok(false, 'helper ran: ' + e.message); }
  }
}
ok(!src.includes(`toast('Removed from all albums')`), 'remove-all toast is gone');
ok(!src.includes('ua.trackIds = ua.trackIds.filter(tid => tid !== id);'), 'remove-all loop is gone');
ok(src.includes('function openSongActions(id, _saAlbumCtx)'), 'song sheet takes an album context');
ok(count(src, 'openSongActions(tid, aName)') === 2, 'both album-card kebab sites pass the card name (' + count(src, 'openSongActions(tid, aName)') + ')');
ok(src.includes('openSongActions(_tid, _foundAlb)'), 'search-jump kebab passes its album');
ok(src.includes(`openSongActions(id, _kbc && _kbc.dataset ? _kbc.dataset.albumName : '')`), 'kebab fallback derives the card album');
ok(src.includes(`scRemoveFromAlbum(id, _saAlbumCtx || '')`), 'remove handler routes through the helper');

console.log('[3] automatic pinned-artist checks (behaviour)');
{
  const start = src.indexOf('async function scPinnedAutoCheck(){');
  const end = src.indexOf('\n  document.addEventListener(', start);
  ok(start !== -1 && end !== -1, 'auto check extractable');
  if (start !== -1 && end !== -1) {
    const code = src.slice(start, end);
    const mk = new Function(
      'isPremiumActive', 'pinnedArtists', 'pinnedCheckState', 'localStorage', 'navigator',
      'checkPinnedArtistReleases',
      code + '\nreturn scPinnedAutoCheck;'
    );
    const mkStore = () => {
      const m = {};
      return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m };
    };
    const run = async (opts) => {
      const calls = { n: 0 };
      const store = mkStore();
      if (opts.at) store.setItem('sidecut_pinnedAutoAt', String(opts.at));
      const fn = mk(
        () => !!opts.premium,
        opts.pins || [],
        { active: !!opts.checking },
        store,
        { onLine: opts.offline ? false : true },
        async () => { calls.n++; }
      );
      await fn();
      return { calls: calls.n, at: store._m.sidecut_pinnedAutoAt };
    };
    try {
      // eslint-disable-next-line no-empty
      { const r = await run({ premium: false, pins: ['A'] }); ok(r.calls === 0, 'no premium → no check (' + r.calls + ')'); }
      { const r = await run({ premium: true, pins: [] }); ok(r.calls === 0, 'no pinned artists → no check (' + r.calls + ')'); }
      { const r = await run({ premium: true, pins: ['A'], offline: true }); ok(r.calls === 0, 'offline → no check (' + r.calls + ')'); }
      { const r = await run({ premium: true, pins: ['A'], checking: true }); ok(r.calls === 0, 'check already running → no check (' + r.calls + ')'); }
      { const r = await run({ premium: true, pins: ['A'] }); ok(r.calls === 1, 'first eligible run checks (' + r.calls + ')'); ok(!!r.at, 'timestamp written'); }
      { const r = await run({ premium: true, pins: ['A'], at: Date.now() }); ok(r.calls === 0, 'checked 0h ago → throttled (' + r.calls + ')'); }
      { const r = await run({ premium: true, pins: ['A'], at: Date.now() - 6 * 60 * 60 * 1000 }); ok(r.calls === 1, 'checked 6h ago → runs again (' + r.calls + ')'); }
    } catch (e) { ok(false, 'auto check ran: ' + e.message); }
  }
}
ok(count(src, 'scPinnedAutoCheck') >= 3, 'triggers reference the auto check (' + count(src, 'scPinnedAutoCheck') + ')');
ok(src.includes(`document.addEventListener('visibilitychange', function(){ if(!document.hidden) scPinnedAutoCheck(); });`), 'resume trigger registered');
ok(src.includes('setTimeout(function(){ scPinnedAutoCheck(); }, 75000);'), 'boot trigger registered');
ok(src.includes('6 * 60 * 60 * 1000'), '6-hour throttle constant present');
ok(src.includes('function scPinnedAutoCheck()'), 'defined');
ok(src.includes(`typeof isPremiumActive === 'function' && !isPremiumActive()`), 'gated on Discover unlock');

console.log('[4] upcoming releases — Dropping soon (behaviour)');
{
  const start = src.indexOf('function scUpcomingReleases(){');
  const end = src.indexOf('\n  async function scPinnedAutoCheck', start);
  ok(start !== -1 && end !== -1, 'upcoming helpers extractable');
  if (start !== -1 && end !== -1) {
    const code = src.slice(start, end);
    // The helpers live at the top of block 1 on window — the extracted slice
    // runs in a sandbox, so hand it a window carrying them.
    const hStart = src.indexOf('window.__scDay10 = function');
    const hEnd = src.indexOf('// ---- Build switch', hStart);
    ok(hStart !== -1 && hEnd !== -1, 'upcoming day-gate helpers extractable');
    const win = {};
    new Function('window', src.slice(hStart, hEnd))(win);
    const mk = new Function('pinnedReleases', 'window', code + '\nreturn { scUpcomingReleases: scUpcomingReleases, scUpcomingUnseen: scUpcomingUnseen };');
    try {
      const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
      const today = iso(0);
      const pinnedReleases = {
        'Artist A': [
          { title: 'Drops next week', date: iso(7), seen: false },
          { title: 'Already out', date: iso(-30), seen: true },
          { title: 'Out today', date: today, seen: false },
          // The reported bug: an already-dated album stored as junk / an ISO
          // timestamp must never read as upcoming.
          { title: 'Junk dated', date: 'not dated', seen: false },
          { title: 'Timestamp dated', date: today + 'T07:00:00Z', seen: false },
        ],
        'Artist B': [
          { title: 'Drops tomorrow', date: iso(1), seen: false, upSeen: true },
        ],
      };
      const api = mk(pinnedReleases, win);
      const up = api.scUpcomingReleases();
      ok(up.length === 2, 'only future-dated releases are upcoming (' + up.length + ')');
      ok(up[0].title === 'Drops tomorrow' && up[1].title === 'Drops next week', 'sorted soonest first (' + up.map(u => u.title).join(' → ') + ')');
      ok(up[0].artist === 'Artist B', 'artist attribution kept (' + up[0].artist + ')');
      const unseen = api.scUpcomingUnseen();
      ok(unseen.length === 1 && unseen[0].title === 'Drops next week', 'upSeen ones leave the badge set (' + unseen.length + ')');
      const emptyApi = mk(undefined, win);
      ok(emptyApi.scUpcomingReleases().length === 0, 'safe when pinnedReleases is unreadable');
    } catch (e) { ok(false, 'upcoming helpers ran: ' + e.message); }
  }
}
ok(src.includes('notifUpcomingEntry'), 'bell entry rendered');
ok(src.includes('Dropping soon'), 'bell entry titled Dropping soon');
ok(src.includes('hasUpcomingAlert'), 'badge covers unseen upcoming');
ok(src.includes('x.rel.upSeen = true'), 'opening the bell marks upcoming seen');
ok(src.includes(`openHomeBubble('newreleases')`), 'bell tap opens the New releases panel');
ok(src.includes(`'drops '`), 'release lists can say "drops …"');
ok(!src.includes(`const when = daysAgo == null ? '' : daysAgo <= 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo + 'd ago';`), 'home bubble panel no longer calls a future date today');
ok(!src.includes(`var when = daysAgo + 'd ago';`), 'Fetch latest popup labels future dates too');
ok(src.includes(`daysAgo < 0 ? 'drops '`), 'future branch comes before the today branch');

console.log('[5] reorder without flicker');
ok(count(src, 'animation: sd-glow-pulse 6s ease-in-out infinite') === 4, 'all glow rules share the 6s cycle (' + count(src, 'animation: sd-glow-pulse 6s ease-in-out infinite') + ')');
ok(src.includes('animation-delay: var(--hb-phase, 0s)'), 'phase CSS rule present');
{
  const lastShorthand = src.lastIndexOf('animation: sd-glow-pulse 6s ease-in-out infinite');
  const phaseRule = src.indexOf('animation-delay: var(--hb-phase, 0s)');
  ok(phaseRule > lastShorthand, 'phase rule sits after every shorthand (it wins the cascade)');
}
ok(src.includes(`bubbles.style.setProperty('--hb-phase', '-' + ((Date.now() % 6000) / 1000).toFixed(2) + 's');`), 'renderHome stamps the wall-clock phase (6s cycle)');
ok(src.includes(`if(bubbles.classList.contains('reorder-mode')) return;`), 'grid still refuses re-renders during reorder');
ok(src.includes(`HB_SIZE_CLASSES.forEach(function(c){ if(el.classList.contains(c)) ph.classList.add(c); });`), 'placeholder copies size classes');
ok(src.includes(`if(el.classList.contains('wide')) ph.classList.add('wide');`), 'placeholder keeps full-width span');
ok(src.includes(`if(el.classList.contains('tall')) ph.classList.add('tall');`), 'placeholder keeps tall footprint');
ok(src.includes('ph.style.gridColumn'), 'placeholder honours exact-width gridColumn');
{
  const copyAt = src.indexOf(`HB_SIZE_CLASSES.forEach(function(c){ if(el.classList.contains(c)) ph.classList.add(c); });`);
  const insertAt = src.indexOf('wrap.insertBefore(ph, el);', copyAt);
  ok(copyAt !== -1 && insertAt > copyAt, 'footprint is copied before the placeholder is placed');
}

console.log('[6] inline script syntax');
let syntaxBad = 0, blocks = 0;
{
  let i = 0;
  while (true) {
    const open = src.indexOf('<script', i);
    if (open === -1) break;
    const gt = src.indexOf('>', open);
    if (/src\s*=/.test(src.slice(open, gt))) { i = gt + 1; continue; }
    const end = src.indexOf('</script>', gt);
    blocks++;
    try { new Function(src.slice(gt + 1, end)); } catch (e) { syntaxBad++; console.log('  syntax bad block ' + blocks + ': ' + e.message); }
    i = end + 1;
  }
}
ok(syntaxBad === 0, blocks + ' inline blocks compile');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
