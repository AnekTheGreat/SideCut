// v61.3.7 — "you don't need an example for release name and the checking
// doesn't work and fetching pinned artists releases doesn't need to show on the
// home page. Also add the time for Manuel and auto fetching upcoming releases."
//
// This pins the four fixes: the add-drop sheet asks for the title with no
// example, the release check can never park itself on "Checking…" (every artist
// is clocked, the tap has a ceiling, and the label always comes back), the
// pinned-artist check draws nothing on Home, and an upcoming drop carries a
// time of day — 12-hour on the rows, "time TBA" when only the day is known.
// It also pins the three syntax errors the previous pass shipped: a changelog
// entry spliced in at the top level, an unterminated Promise.race, and a
// duplicated `const fresh`. The whole file has to parse for any of this to run.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };
const count = (needle) => src.split(needle).length - 1;
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a + from.length);
  if (b === -1) return null;
  return src.slice(a, b);
}

console.log('[1] the file parses — every inline script block');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m; let blocks = 0; let bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('       ' + e.message); }
  }
  ok(blocks >= 2 && bad === 0, blocks + ' inline script block(s) parse');  ok(count("version: '61.5'") === 1, 'exactly one 61.5 changelog entry');
  ok(/const CHANGELOG = \[\n  \{ version: '63.0.9'/.test(src), 'the newest entry sits inside CHANGELOG');
}

console.log('[2] add-drop sheet: no example, no +7 days');
ok(src.includes('placeholder="Release title"'), 'the title placeholder is just "Release title"');
ok((function(){ var _s = slice('window.__scAddUpcomingDrop = function', '// iTunes publishes an announced release as a pre-order'); return !!_s && !/AUJLA|SZN|e\.g\.|Example/i.test(_s); })(), 'no example release name in the add-drop sheet (the notes may name a real one)');
ok(src.includes('id="scAddDropTitle" placeholder="Release title"'), 'the field itself carries it');
ok(!src.includes('tEl.setDate(tEl.getDate() + 7)'), 'the sheet opens on today, not next week');

console.log('[3] the release check can never stick on "Checking…"');
const tap = slice('window.__scUpcomingConnectTap = async function', 'window.__scAddUpcomingDrop = function');
ok(!!tap, 'tap handler slice extracted');
ok(tap && tap.includes('Promise.race(['), 'the rebuild runs inside a race');
ok(tap && tap.includes('setTimeout(res, 60000)'), '60 s last resort — the run clears itself first');
ok(tap && tap.split('window.__scRebuildReleaseLists(true)').length - 1 === 1, 'the rebuild is still the thing being raced');
ok(tap && tap.includes("btn.textContent = 'Check for drops'"), 'the label is always put back');
ok(tap && tap.includes('btn.disabled = false'), 'and the button is re-enabled');
const check = slice('async function checkPinnedArtistReleases()', 'function scUpcomingReleases');
ok(!!check, 'checkPinnedArtistReleases slice extracted');
ok(check && check.includes('new Promise(function(res){ setTimeout(function(){ res(null); }, 25000); })'),
  'every artist is clocked at 25 s');
ok(check && count('const fresh = await') === 1, 'one `fresh` per artist — no duplicate declaration');
ok(check && check.includes('totalNew += (fresh ? fresh.length : 0)'), 'a timed-out artist counts as zero, not a crash');
ok(check && check.split('Promise.race([').length - 1 === 1, 'one race per artist');
ok(check && check.includes('pinnedCheckState.active = false'), 'active is still cleared in the finally');
ok(src.includes('function scRepaintOpenReleasePanel(){'), 'the open panel is repainted, not left stale');
ok(src.includes('panel.style.animation = \'none\''), 'the repaint does not replay the slide-up');

console.log('[4] fetching pinned-artist releases draws nothing on Home');
ok(!src.includes('Checking pinned artists for new releases'), 'the pinned progress card is gone');
ok(!src.includes('data-dismiss="pinned"'), 'the finished "New releases found" card is gone');
ok(!src.includes('if(false){'), 'no dead branch left behind');
{
  const anyActive = (src.match(/const anyActive = [\s\S]*?;/) || [''])[0];
  ok(!!anyActive, 'anyActive extracted');
  ok(anyActive && !anyActive.includes('pinnedCheckState'), 'the check no longer keeps Home "busy"');
}

console.log('[5] a drop carries a time of day');
{
  const def = src.match(/window\.__scTime12 = function\(v\)\{[\s\S]*?\n\};/);
  let f = null;
  if (def) { try { f = new Function('return (' + def[0].replace('window.__scTime12 = ', '').replace(/;$/, '') + ')')(); } catch (e) {} }
  ok(typeof f === 'function', 'window.__scTime12 is defined once (as a function)');
  ok(f && f('07:23') === '7:23 AM', '07:23 → 7:23 AM');
  ok(f && f('19:05') === '7:05 PM', '19:05 → 7:05 PM');
  ok(f && f('00:00') === '12:00 AM' && f('12:00') === '12:00 PM', 'midnight and noon are not 0:00');
  ok(f && f('') === '' && f(null) === '' && f('noon') === '', 'no time → empty, so a day-only row can say TBA');
}
ok(src.includes('id="scAddDropTime" type="time"'), 'the manual sheet has a Drop time field');
ok(src.includes('tmEl.value = String(tEl.getHours())'), 'it opens on the current time');
ok(src.includes('date: date, time: time,'), 'the time is stored on the drop');
ok(count("window.__scTime12(") >= 5, 'the rows and the release page all read it');
ok(src.includes("' at time TBA'"), 'a day-only catalog row says "at time TBA"');
ok(src.includes('relAtUp + '), 'the upcoming labels use the drop time');
ok(src.includes("if(!x.time) x.time = '';"), 'the catalog merge keeps a reported time');
ok(src.includes('if(!pe.time && x.time) pe.time = x.time;'), 'and an undated drop picks one up when it is dated');

console.log('[6] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const sw = fs.readFileSync('sw.js', 'utf8');
ok(ver === '63.0.9', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v63.0.10';"), 'sw.js cache = sidecut-shell-v61.5');
ok(src.indexOf("version: '61.5'") < src.indexOf("version: '61.3.6'"), '61.5 heads the changelog');

console.log('');
console.log(failures + ' failure(s)');
process.exit(failures ? 1 : 0);
