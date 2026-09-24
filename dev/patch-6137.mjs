#!/usr/bin/env node
// v61.3.7 — the user's four fixes:
//   1. Add-drop sheet: no "e.g. ..." example in the release-name placeholder.
//   2. "the checking doesn't work": a stalled, offline or rate-limited catalog
//      reply can no longer park the check. Every artist is clocked at 8 s, the
//      tap has a 35 s ceiling, the tap always puts its own label back, and the
//      open panel repaints on the spot. (The previous pass left two
//      half-written edits behind — a Promise.race with no closing bracket and a
//      duplicated `const fresh` — which are the syntax error in the build; both
//      are rewritten here in full.)
//   3. Fetching pinned-artist releases no longer shows on Home: both pinned
//      background cards are gone, the check keeps running quietly, and new
//      drops still reach the bell and the New releases tab.
//   4. Upcoming drops carry a time of day: the manual sheet gains a Drop time
//      field (defaulted to now), an upcoming row reads "drops Oct 3 at 7:23 AM",
//      and a row whose catalog only knows the day reads "at time TBA" instead
//      of inventing an hour.
//   5. Version / changelog / test pins / manifests — the same lockstep as
//      61.3.6, because str_replace cannot reach inside the 2.2 MB index.html.
//
// Run: node dev/patch-6137.mjs              # index.html + tests + manifests
//      node dev/patch-6137.mjs --manifest   # re-seed root manifest.json only
//                                           # (run after dev/ota-bundle.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const VER = '61.3.7';
const MANIFEST_ONLY = process.argv.includes('--manifest');

const devDir = path.join(ROOT, 'dev');
let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
let pinned = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

// Replace `oldStr` with `newStr`. Idempotent: if the finished text is already
// in the file the edit is skipped, and any other count than `want` throws so a
// half-applied file is never written.
function sub(label, oldStr, newStr, want = 1) {
  if (newStr !== '' && src.indexOf(newStr) !== -1) return skip(label);
  if (newStr === '' && src.indexOf(oldStr) === -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== want) throw new Error(label + ': expected ' + want + ' match(es), found ' + got);
  src = src.split(oldStr).join(newStr);
  done(label);
}
const del = (label, oldStr) => sub(label, oldStr, '');

// Same, for a block that is easier to describe by shape (they hold emoji).
function subRe(label, re, newStr) {
  const m = src.match(re);
  if (!m) {
    // A missing pattern is the finished state for a deletion, and for an edit
    // it is only fine when its result is already in the file.
    if (newStr === '' || src.indexOf(newStr) !== -1) return skip(label);
    throw new Error(label + ': pattern not found');
  }
  if (src.indexOf(m[0]) !== src.lastIndexOf(m[0])) throw new Error(label + ': pattern is not unique');
  if (newStr !== '' && src.indexOf(newStr) !== -1) return skip(label);
  src = src.replace(m[0], newStr);
  done(label);
}

if (!MANIFEST_ONLY) {

// ---------------------------------------------------------------------------
// [1] + [2] the syntax error: two half-written Promise.race edits.
// ---------------------------------------------------------------------------

// The tap's 35 s ceiling never got its closing bracket.
sub('tap: close the 35 s Promise.race (syntax error)',
  `        new Promise(function(res){ setTimeout(res, 35000);  // button cannot be stuck
      ]);`,
  `        new Promise(function(res){ setTimeout(res, 35000); })   // cannot park the button
      ]);`);

// The per-artist clock was spliced in next to the old line, leaving two
// `const fresh` declarations in one block and an unterminated race.
sub('check: one clocked fetch per artist (syntax error)',
  `    for(const a of pinnedArtists){
      const fresh = await fetchArtistReleases(a.name);
      totalNew += fresh.length;
      const fresh = await Promise.race([
      fetchArtistReleases(a.name),
      new Promise(function(res){ setTimeout(function(){ res(null); }, 8000);  // a stalled reply must
    ]).catch(function(){ return null; });                            // not wedge the whole check
      totalNew += (fresh ? fresh.length : 0);`,
  `    for(const a of pinnedArtists){
      // Clock every artist: a stalled, offline or rate-limited catalog reply
      // moves the check on instead of parking it half-finished.
      const fresh = await Promise.race([
        fetchArtistReleases(a.name),
        new Promise(function(res){ setTimeout(function(){ res(null); }, 8000); })   // 8s per artist
      ]).catch(function(){ return null; });                                        // never wedges the run
      totalNew += (fresh ? fresh.length : 0);`);

// ---------------------------------------------------------------------------
// [3] Home no longer shows the pinned-artist release check.
// ---------------------------------------------------------------------------

// The progress card ("Checking pinned artists for new releases 7/7 artists").
subRe('Home: pinned-check progress card removed',
  /    if\(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState\.active\)\{[\s\S]*?transition:width \.3s;"><\/div><\/div>`\);\n    \}\n/,
  '');

// The finished "New releases found" card, left as a dead `if(false)` by the
// previous pass. Nothing about the check belongs on Home, so it goes.
subRe('Home: pinned-check "New releases found" card removed',
  /    if\(false\)\{[\s\S]*?<\/div>`\);\n    \}\n/,
  '');

// The same pass dropped the pinned term from anyActive but left its closing
// paren behind — the third syntax error in the build.
sub('Home: stray ")" left by the anyActive cleanup (syntax error)',
  `      || (bgImportState && bgImportState.running && bgImportState.completed < bgImportState.total));`,
  `      || (bgImportState && bgImportState.running && bgImportState.completed < bgImportState.total);`);

// ---------------------------------------------------------------------------
// [4] the check repaints what is on screen
// ---------------------------------------------------------------------------

sub('repaint helper for the open Home bubble',
  `  window.__scRebuildReleaseLists = async function(doFetch){`,
  `  // Repaint the release surface that is open right now, in place. The Home
  // bubble is only ever built at open time, so without this a finished check
  // leaves it showing the count, the rows and the empty state it had when you
  // tapped. Its slide-up is an animation on .open, so the panel is pinned to
  // animation:none for the rebuild — the repaint never plays the entrance a
  // second time.
  function scRepaintOpenReleasePanel(){
    try{
      var overlay = document.getElementById('homeBubbleOverlay');
      if(!overlay || !overlay.classList.contains('open')) return;   // popup path repaints itself
      var tEl = document.getElementById('hbPanelTitle');
      if(!tEl || String(tEl.textContent || '').indexOf('New releases') !== 0) return;
      var panel = document.getElementById('homeBubblePanel');
      if(panel) panel.style.animation = 'none';
      try{ if(typeof openHomeBubble === 'function') openHomeBubble('newreleases'); }
      finally{ if(panel) panel.style.animation = ''; }
    }catch(_eRp){}
  }
  window.__scRebuildReleaseLists = async function(doFetch){`);

// ---------------------------------------------------------------------------
// [5] time of day: one shared 12-hour formatter, then the sheet, the rows and
//     the release page.
// ---------------------------------------------------------------------------

sub('window.__scTime12 — a drop time of day, formatted once',
  `  var ms = Date.parse(d + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z');
  return isFinite(ms) && ms <= 400 * 86400000;
};`,
  `  var ms = Date.parse(d + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z');
  return isFinite(ms) && ms <= 400 * 86400000;
};
// A drop's time of day, when one is known. A manual drop carries the hour you
// picked; a catalog that ever reports one passes it straight through; a
// day-only source leaves the field empty, which the lists read as "time TBA"
// on an upcoming row instead of inventing an hour. On window like the day
// helpers above, so both script blocks can reach it.
window.__scTime12 = function(v){
  var m = String(v == null ? '' : v).match(/^(\\d{1,2}):(\\d{2})/);
  if(!m) return '';
  var h = parseInt(m[1], 10);
  var mi = parseInt(m[2], 10);
  if(!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59)) return '';
  var ap = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12; if(!h12) h12 = 12;
  return h12 + ':' + (mi < 10 ? '0' + mi : String(mi)) + ' ' + ap;
};`);

sub('manual sheet: copy mentions the day and the time',
  `For a release no store has listed yet. SideCut counts it down like any other drop.`,
  `For a release no store has listed yet \\u2014 set its day and time, and SideCut counts it down like any other drop.`);

sub('manual sheet: Drop time field',
  `        '<input id="scAddDropDate" type="date" style="' + field + '">',`,
  `        '<input id="scAddDropDate" type="date" style="' + field + '">',
        '<input id="scAddDropTime" type="time" placeholder="Drop time" style="' + field + '">',`);

sub('manual sheet: opens on today and on the current time',
  `        dEl.value = tEl.getFullYear() + '-' + mm + '-' + dd;
      }catch(_eDv){}`,
  `        dEl.value = tEl.getFullYear() + '-' + mm + '-' + dd;
        // A drop at 00:00 is not what anyone means: default to the hour they
        // are adding it at, so the countdown starts from a real moment.
        var tmEl = card.querySelector('#scAddDropTime');
        if(tmEl) tmEl.value = String(tEl.getHours()).padStart(2, '0') + ':' + String(tEl.getMinutes()).padStart(2, '0');
      }catch(_eDv){}`);

sub('manual sheet: read the time',
  `        var date = window.__scDay10(card.querySelector('#scAddDropDate').value || '');
        if(!artist || !title || !date){ toast('Artist, title and a real date are all needed.', 3000); return; }`,
  `        var date = window.__scDay10(card.querySelector('#scAddDropDate').value || '');
        var time = String(card.querySelector('#scAddDropTime').value || '').slice(0, 5);
        if(!artist || !title || !date){ toast('Artist, title and a real date are all needed.', 3000); return; }`);

sub('manual sheet: a repeat save updates its time instead of refusing',
  `          if(String(arr[i].title || '').toLowerCase().trim() === nt && (window.__scDay10(arr[i].date) || arr[i].date) === date){
            toast('That drop is already listed.', 2600); close(); return;
          }`,
  `          if(String(arr[i].title || '').toLowerCase().trim() === nt && (window.__scDay10(arr[i].date) || arr[i].date) === date){
            // Same drop, same day: the only thing a second save can change is
            // the time, so take it rather than refusing the edit.
            if(time && arr[i].time !== time){
              arr[i].time = time;
              try{ savePinnedArtists(); }catch(_eSv2){}
              close();
              try{ renderNewReleases(); }catch(_eRn2){}
              toast('Time updated \\u2014 ' + title + ' drops at '
                + (typeof window.__scTime12 === 'function' ? window.__scTime12(time) : time) + '.', 3200);
              try{ window.__scRebuildReleaseLists(false); }catch(_eRb3){}
              return;
            }
            toast('That drop is already listed.', 2600); close(); return;
          }`);

sub('manual sheet: the time is stored on the drop',
  `        arr.push({ title: title, date: date, art: null, url: null, previewUrl: null, kind: 'album', cid: null, seen: false, _manual: true });`,
  `        arr.push({ title: title, date: date, time: time, art: null, url: null, previewUrl: null, kind: 'album', cid: null, seen: false, _manual: true });`);

sub('manual sheet: the toast names the time',
  `? 'Added \\u2014 ' + title + ' drops on ' + date + '.'`,
  `? 'Added \\u2014 ' + title + ' drops on ' + date
              + (time ? ' at ' + (typeof window.__scTime12 === 'function' ? window.__scTime12(time) : time) : '') + '.'`);

// A catalog that reports a time keeps it, in both merge paths.
sub('catalogs: a reported time is carried onto the drop',
  `          if(!x || !x.title || !x.date) return;
          var nt = String(x.title).toLowerCase().trim();`,
  `          if(!x || !x.title || !x.date) return;
          if(!x.time) x.time = '';                    // day-only catalogs leave it blank
          var nt = String(x.title).toLowerCase().trim();`);

sub('catalogs: an undated drop dated in place picks up its time too',
  `            if(!pe.date){                                                            // dated in place, not "new"
              pe.date = x.date; pe.kind = 'album';`,
  `            if(!pe.date){                                                            // dated in place, not "new"
              pe.date = x.date; pe.kind = 'album';
              if(!pe.time && x.time) pe.time = x.time;`);

// ---- the rows -------------------------------------------------------------
// The Home bubble's New releases list.
sub('Home bubble rows: work out the drop time',
  `            const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date+'T00:00:00Z').getTime())/86400000) : null;`,
  `            const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date+'T00:00:00Z').getTime())/86400000) : null;
            const relAt = (typeof window.__scTime12 === 'function' && window.__scTime12(rel.time)) ? ' at ' + window.__scTime12(rel.time) : '';
            const relAtUp = relAt || ' at time TBA';   // upcoming + no catalog time`);

// The Fetch latest / New Releases popup rows.
sub('New releases popup rows: work out the drop time',
  `      const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date + 'T00:00:00Z').getTime())/86400000) : null;`,
  `      const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date + 'T00:00:00Z').getTime())/86400000) : null;
      const relAt = (typeof window.__scTime12 === 'function' && window.__scTime12(rel.time)) ? ' at ' + window.__scTime12(rel.time) : '';
      const relAtUp = relAt || ' at time TBA';   // upcoming + no catalog time`);

sub('upcoming rows read "drops Oct 3 at 7:23 AM" (both list surfaces)',
  `day: 'numeric' }) + (daysUntil && daysUntil <= 120`,
  `day: 'numeric' }) + relAtUp + (daysUntil && daysUntil <= 120`, 2);

// Discover's own release list.
sub('Discover release rows: work out the drop time',
  `          var upc = false;`,
  `          var upc = false;
          var _rAt = (typeof window.__scTime12 === 'function' && window.__scTime12(r.time)) ? ' at ' + window.__scTime12(r.time) : ' at time TBA';`);

sub('Discover release rows: show the time on an upcoming one',
  `'drops ' + new Date(_d0 + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + `,
  `'drops ' + new Date(_d0 + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + _rAt + `);

// The release page (cover / countdown) and its tracklist's collection meta.
sub('release page: work out the drop time',
  `    var typeLabel = rel.kind === 'album' ? 'Album' : 'Single';`,
  `    var typeLabel = rel.kind === 'album' ? 'Album' : 'Single';
    var relAt = (typeof window.__scTime12 === 'function' && window.__scTime12(rel.time)) ? ' at ' + window.__scTime12(rel.time) : (upcoming ? ' at time TBA' : '');`);

sub('release page: the meta line names the time',
  `: 'Released ') + dateStr : '')`,
  `: 'Released ') + dateStr + relAt : '')`, 2);

// ---------------------------------------------------------------------------
// [6] version + changelog head
// ---------------------------------------------------------------------------

sub('APP_VERSION -> ' + VER,
  `  const APP_VERSION = '61.3.6';`,
  `  const APP_VERSION = '${VER}';`);

// The previous pass spliced the new entry in at the TOP LEVEL, just above
// `const APP_VERSION` — a stray object literal followed by a comma, which is
// the syntax error the build is stuck on. The entry itself is correct, so it is
// lifted out verbatim and dropped in where it belongs: the head of CHANGELOG.
const TIME_NOTE = 'Every upcoming drop now carries a time of day: the manual sheet opens on today with a Drop time field you set, an upcoming row reads "drops Oct 3 at 7:23 AM" beside its countdown, and a drop whose catalog knows only the day reads "at time TBA" rather than leaving the hour a mystery.';
if (src.indexOf(`const CHANGELOG = [\n  { version: '${VER}'`) !== -1) {
  skip('changelog head entry is already inside CHANGELOG');
} else {
  const strayRe = /\n  \{ version: '61\.3\.7', date: '[\s\S]*?  \] \},\n  const APP_VERSION = /;
  const sm = src.match(strayRe);
  if (!sm) throw new Error('changelog head: no stray ' + VER + ' entry found to move');
  if (src.indexOf(sm[0]) !== src.lastIndexOf(sm[0])) throw new Error('changelog head: stray entry is not unique');
  let entry = sm[0].slice(1).replace(/\n  const APP_VERSION = $/, '\n');
  if (entry.indexOf(TIME_NOTE) === -1) {
    const itemAnchor = `items: [\n    'Upcoming releases now looks the date up itself:`;
    if (entry.indexOf(itemAnchor) === -1) throw new Error('changelog head: item anchor missing');
    entry = entry.replace(itemAnchor, `items: [\n    '${TIME_NOTE}',\n    'Upcoming releases now looks the date up itself:`);
  }
  src = src.replace(sm[0], '\n  const APP_VERSION = ');
  const arrAnchor = `  const CHANGELOG = [\n  { version: '61.3.6', date: `;
  if (src.indexOf(arrAnchor) === -1) throw new Error('CHANGELOG array anchor missing');
  src = src.replace(arrAnchor, `  const CHANGELOG = [\n` + entry + `  { version: '61.3.6', date: `);
  done('changelog head entry moved into CHANGELOG (' + VER + ')');
}

fs.writeFileSync(FILE, src);
console.log('• index.html written — ' + edits + ' edit(s)');

// --------------------------------------------------------------- test pins
for (const f of fs.readdirSync(devDir)) {
  if (!/^test-.*\.mjs$/.test(f)) continue;
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ver === '61.3.6'`).join(`ver === '61.3.7'`)
    .split(`sidecut-shell-v61.3.6`).join(`sidecut-shell-v61.3.7`)
    .split(`"version: '61.3.6'"`).join(`"version: '61.3.7'"`)
    .split(`CHANGELOG head entry is 61.3.6`).join(`CHANGELOG head entry is 61.3.7`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); pinned++; console.log('• repinned dev/' + f); }
}
// A re-run repins nothing (they are already at VER) — what must never happen is
// a test file left behind on the old pin.
const stale = fs.readdirSync(devDir)
  .filter((f) => /^test-.*\.mjs$/.test(f))
  .filter((f) => fs.readFileSync(path.join(devDir, f), 'utf8').includes(`ver === '61.3.6'`));
if (stale.length) throw new Error('test files still pinned to 61.3.6: ' + stale.join(', '));

} else {
  console.log('= manifest-only run — index.html untouched');
}

// ------------------------------------------------- changelog head (read back)
function changelogHead() {
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (!block) throw new Error('could not read the CHANGELOG block');
  const entries = eval('[' + block[1] + ']');
  const e = entries.find((x) => String(x.version) === VER);
  if (!e) throw new Error('no ' + VER + ' changelog entry found');
  return e;
}
const head = changelogHead();

{
  // test-6052 pins the head date by exact equality; keep it in step.
  const p = path.join(devDir, 'test-6052.mjs');
  const t = fs.readFileSync(p, 'utf8');
  const re = /ok\(entries\[0\]\.date === '[^']*', 'ship date correct \(' \+ entries\[0\]\.date \+ '\)'\);/;
  const m = t.match(re);
  if (!m) throw new Error('test-6052.mjs: date pin not found');
  if (m[0].indexOf(head.date) === -1) {
    fs.writeFileSync(p, t.replace(re, `ok(entries[0].date === '${head.date}', 'ship date correct (' + entries[0].date + ')');`));
    console.log('• dev/test-6052.mjs ship date → ' + head.date);
  } else {
    skip('dev/test-6052.mjs ship date is ' + head.date);
  }
}

// ------------------------------------------------------ root manifest.json
// The very first manifest location, kept current so no client left pointing at
// it is ever told about an older version. Size is read from the published
// bundle, so re-run with --manifest after `node dev/ota-bundle.mjs`.
{
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  const notes = (head.items || [])
    .map((it) => (typeof it === 'string' && it.indexOf('[FULL] ') === 0) ? it.slice(7) : it)
    .slice(0, 6);
  const man = { version: VER, url: 'update.zip', size: upd.size, notes, date: String(head.date || '') };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  console.log('• root manifest.json → ' + VER + ' · ' + upd.size + ' bytes · ' + notes.length + ' notes');
}

console.log('patch-6137: ' + edits + ' index.html edit(s), ' + pinned + ' test file(s) repinned');
