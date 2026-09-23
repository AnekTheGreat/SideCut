// v61 fix: an album whose date was already today (stored as a full ISO
// timestamp like '2026-09-23T07:00:00Z') or stored as junk text ('not dated',
// unpadded '2026-9-5', etc.) passed the raw string compare `> today` in every
// Upcoming-releases surface and showed up as an upcoming drop.
//
// This patch adds two window-level helpers (Block 2 can't see Block 1's IIFE):
//   window.__scDay10(v)        -> 'YYYY-MM-DD' or '' (rejects junk/impossible)
//   window.__scUpcomingDay(v)  -> true only for a real day strictly after today
// and routes every upcoming filter / countdown label through them.
//
// Atomic: all replacements are matched in memory first; any missing or
// non-unique anchor throws BEFORE a single byte is written.
import fs from 'node:fs';

const FILE = 'index.html';
let src = fs.readFileSync(FILE, 'utf8');
const applied = [];

function replaceOnce(oldStr, newStr, label) {
  const first = src.indexOf(oldStr);
  if (first === -1) throw new Error('NOT FOUND: ' + label);
  if (src.indexOf(oldStr, first + 1) !== -1) throw new Error('NOT UNIQUE: ' + label);
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  applied.push(label);
}

// 1. Shared helpers at the very top of Block 1 (executes before any use;
//    Block 2 reads them off window at call time).
replaceOnce(
  "<script>\n// ---- Build switch: Play Store build vs sideload/OTA build --------------------",
  [
    "<script>",
    "// ---- Upcoming-release day gate (shared by BOTH script blocks) --------------",
    "// Only a real YYYY-MM-DD that is strictly after today counts as upcoming.",
    "// The old raw string compares let junk beat today's date: a full ISO stamp",
    "// ('2026-09-23T07:00:00Z' sorts above '2026-09-23' - i.e. an album dated",
    "// TODAY leaked in), letters ('not dated' sorts above '2'), and unpadded",
    "// days ('2026-9-5' sorts above '2026-09-23'). That is how an already-dated",
    "// album kept landing in Upcoming releases. Block 2's tabs/badges can't see",
    "// Block 1's IIFE scope, so both helpers hang off window.",
    "window.__scDay10 = function(v){",
    "  var m = String(v == null ? '' : v).match(/^(\\d{4}-\\d{2}-\\d{2})/);",
    "  if(!m || isNaN(Date.parse(m[1] + 'T00:00:00Z'))) return '';",
    "  return m[1];",
    "};",
    "window.__scUpcomingDay = function(v){",
    "  var d = window.__scDay10(v);",
    "  return !!d && d > new Date().toISOString().slice(0, 10);",
    "};",
    "// ---- Build switch: Play Store build vs sideload/OTA build --------------------",
  ].join("\n"),
  'helper insert'
);

// 2. Bell / Dropping-soon list (scUpcomingReleases) - gate + normalize.
replaceOnce(
  "          if(r && r.date && r.date > _today) _out.push({ artist: artist, title: r.title || '', date: r.date, art: r.art || null, rel: r });",
  "          if(r && r.date && window.__scUpcomingDay(r.date)) _out.push({ artist: artist, title: r.title || '', date: window.__scDay10(r.date), art: r.art || null, rel: r });",
  'scUpcomingReleases gate'
);

// 3. Home bubble tab badge count.
replaceOnce(
  "            var _hbUpN = all.filter(function(r){ return String(r.date || '').slice(0,10) > _hbToday; }).length;",
  "            var _hbUpN = all.filter(function(r){ return window.__scUpcomingDay(r.date); }).length;",
  'home bubble badge count'
);

// 4. Fetch latest popup + Home bubble shared tab filter (__scDiscRelTab).
replaceOnce(
  "  var up = rows.filter(function(r){ return (r.getAttribute('data-date') || '') > today; });",
  "  var up = rows.filter(function(r){ return window.__scUpcomingDay(r.getAttribute('data-date')); });",
  '__scDiscRelTab row filter'
);

// 5. Fetch latest popup tab badge count.
replaceOnce(
  "      var _upN = _allRows.filter(function(r){ return (r.getAttribute('data-date') || '') > _today; }).length;",
  "      var _upN = _allRows.filter(function(r){ return window.__scUpcomingDay(r.getAttribute('data-date')); }).length;",
  'popup badge count'
);

// 6. Release page countdown - same day normalization.
replaceOnce(
  "    var dMs = rel.date ? new Date(rel.date + 'T00:00:00Z').getTime() : NaN;",
  "    var _rd = window.__scDay10(rel.date);\n    var dMs = _rd ? new Date(_rd + 'T00:00:00Z').getTime() : NaN;",
  'openReleasePage dMs'
);

// 7. Home bubble rows: normalize rel ONCE at the top of the map so the
//    daysAgo/daysUntil/'drops Sep 23' label and data-date all read a clean day.
replaceOnce(
  "all.map(rel => {\n            const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date+'T00:00:00Z').getTime())/86400000) : null;",
  "all.map(rel => {\n            rel = Object.assign({}, rel, { date: window.__scDay10(rel.date) });\n            const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date+'T00:00:00Z').getTime())/86400000) : null;",
  'home bubble rel shadow'
);

// 8. Discover New-releases list: same one-point normalization.
replaceOnce(
  "recent.map(rel => {\n      const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date + 'T00:00:00Z').getTime())/86400000) : null;",
  "recent.map(rel => {\n      rel = Object.assign({}, rel, { date: window.__scDay10(rel.date) });\n      const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date + 'T00:00:00Z').getTime())/86400000) : null;",
  'new releases rel shadow'
);

// 9. Fetch latest popup 'drops X in Nd' label day.
replaceOnce(
  "            var _d0 = r.date.slice(0,10);",
  "            var _d0 = window.__scDay10(r.date);",
  'popup _d0 day'
);

// 10. Fetch latest popup row data-date attribute.
replaceOnce(
  "escapeHtml((r.date||'').slice(0,10))",
  "escapeHtml(window.__scDay10(r.date))",
  'popup data-date attr'
);

fs.writeFileSync(FILE, src);
console.log('patch-upcoming: ' + applied.length + ' replacements applied');
for (const l of applied) console.log('  - ' + l);
