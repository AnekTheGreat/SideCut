#!/usr/bin/env node
// 80.6.24 - the patch notes carry their day and their Eastern time again.
//
//   node dev/check-80624.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

/* -- read the changelog the way the app does ----------------------- */
function entries() {
  const re = /\{ version: '([^']+)', date: '([^']*)'/g;
  const out = [];
  let m;
  while ((m = re.exec(page))) out.push({ version: m[1], date: m[2].replace(/\\u00b7/g, '\u00b7') });
  return out;
}
const LIST = entries();
const byVer = {};
for (const e of LIST) byVer[e.version] = e.date;

const CLOCK = /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} (AM|PM) E[DS]T$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
function ms(date) {
  const m = /^([A-Z][a-z]+) (\d{1,2}), (\d{4}) \u00b7 (\d{1,2}):(\d{2}) (AM|PM) E[DS]T$/.exec(date);
  if (!m) return NaN;
  const h = (Number(m[4]) % 12) + (m[6] === 'PM' ? 12 : 0);
  return Date.UTC(Number(m[3]), MONTHS.indexOf(m[1]), Number(m[2]), h, Number(m[5]));
}

ok(page.includes("const APP_VERSION = '80.6.24';"), 'the page runs 80.6.24');
ok(page.includes("version: '80.6.24'"), 'the changelog records 80.6.24');
ok(LIST.length === 416, 'the changelog has 416 dated entries (got ' + LIST.length + ')');

/* -- the twelve bare days ------------------------------------------ */
const ISO = LIST.filter((e) => /^\d{4}-\d\d-\d\d$/.test(e.date));
ok(ISO.length === 0, 'no entry is left with a bare ISO day (' + ISO.map((e) => e.version).join(', ') + ')');

const STAMPS = {
  '80.6.12': 'October 29, 2026 \u00b7 8:04 PM EDT',
  '80.6.13': 'October 29, 2026 \u00b7 9:14 PM EDT',
  '80.6.14': 'October 29, 2026 \u00b7 9:37 PM EDT',
  '80.6.15': 'October 29, 2026 \u00b7 9:46 PM EDT',
  '80.6.16': 'October 29, 2026 \u00b7 10:24 PM EDT',
  '80.6.17': 'October 29, 2026 \u00b7 10:37 PM EDT',
  '80.6.18': 'October 29, 2026 \u00b7 10:46 PM EDT',
  '80.6.19': 'October 29, 2026 \u00b7 10:54 PM EDT',
  '80.6.20': 'October 29, 2026 \u00b7 11:10 PM EDT',
  '80.6.21': 'October 30, 2026 \u00b7 7:26 AM EDT',
  '80.6.22': 'October 30, 2026 \u00b7 5:20 PM EDT',
  '80.6.23': 'October 30, 2026 \u00b7 6:25 PM EDT'
};
for (const [v, want] of Object.entries(STAMPS)) {
  ok(byVer[v] === want, 'the ' + v + ' entry is dated the time it landed (' + byVer[v] + ')');
}

/* -- and every other entry keeps the shape ------------------------- */
// The 5x.0 and 4x releases before 57 wrote their own shapes ('September 2, 2026 at
// 1:22 am EDT', 'July 28th, 2026 at 6:15 pm EDT'), and one has no clock at all. Those
// are older than the convention this release restores and are left exactly as they are:
// rewriting forty history entries is not what was asked for. From 80.0 on, one shape.
const modern = LIST.filter((e) => Number(String(e.version).split('.')[0]) >= 80);
const offShape = modern.filter((e) => !CLOCK.test(e.date));
ok(offShape.length === 0,
  'every 80.x entry carries a day and an Eastern clock (' + offShape.length + ' of ' + modern.length + ' do not)');
const legacy = LIST.filter((e) => Number(String(e.version).split('.')[0]) < 80);
ok(legacy.length === 361, 'the 361 older entries with their own shapes are untouched (' + legacy.length + ')');
ok(CLOCK.test(byVer['80.6.24'] || ''), 'the 80.6.24 entry carries a day and an Eastern clock (' + byVer['80.6.24'] + ')');

/* -- order, and no release stamped twice --------------------------- */
const versions = LIST.map((e) => e.version);
ok(new Set(versions).size === versions.length, 'no release is listed twice');
ok(LIST[0].version === '80.6.24', '80.6.24 is the newest entry, at the top');
const recent = ['80.6.12', '80.6.13', '80.6.14', '80.6.15', '80.6.16', '80.6.17', '80.6.18',
  '80.6.19', '80.6.20', '80.6.21', '80.6.22', '80.6.23', '80.6.24'];
let rising = true, previous = -1;
for (const v of recent) {
  const t = ms(byVer[v] || '');
  if (!(t > previous)) rising = false;
  previous = t;
}
ok(rising, 'the twelve repaired stamps and the new one run forward in time');
const sameDay = Object.keys(STAMPS).filter((v) => (byVer[v] || '').startsWith('October 29'));
ok(sameDay.length === 9, 'nine of them landed on October 29, not the 30th');

/* -- the entry itself ---------------------------------------------- */
const entry = page.slice(page.indexOf("version: '80.6.24'"), page.indexOf("version: '80.6.23'"));
ok(entry.includes('The patch notes carry their day and their time'), 'the 80.6.24 entry says what it repairs');
const items = entry.match(/'\[FULL\][^']*'/g) || [];
ok(items.length === 3, 'three notes, every one tagged [FULL] (' + items.length + ' tagged)');
ok(!/80\.6\.24/.test(items.join(' ')), 'and none of them names a build number');

/* -- the page still parses ----------------------------------------- */
{
  const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1]));
  let failing = 0;
  for (const s of scripts) {
    try { new vm.Script(s[2]); } catch (_e) { failing++; }
  }
  ok(scripts.length === 7, 'seven inline scripts (' + scripts.length + ')');
  ok(failing === 0, 'all seven inline scripts compile (' + failing + ' fail)');
}

if (bad.length) {
  console.log('check-80624: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80624: %d passed, 0 failed', pass);
