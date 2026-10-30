#!/usr/bin/env node
// 80.6.18 - the web tag, the genre rail the owner owns, and the AI that reads it.
//
//   node dev/check-80618.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.18';"), 'the page runs 80.6.18');
ok(page.includes("version: '80.6.18'"), 'the changelog records 80.6.18');
ok(page.includes('80.6.18 - THE GENRES ARE YOURS'), 'the release comment is in the script');

function sliceFn(name) {
  const at = page.indexOf('\n  function ' + name + '(');
  if (at === -1) return '';
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  return end === -1 ? '' : page.slice(start, end + 4);
}

/* ── the web page names itself ──────────────────────────────────────────── */
ok(page.includes("document.title = 'SideCut FullDev';"), 'the tab says SideCut FullDev');
ok(page.includes("tag.textContent = 'FullDev';"), 'and the name carries the tag');
ok(page.includes("document.querySelector('header .brand h1')"), 'beside the SideCut wordmark');
const brand = page.slice(page.indexOf('function scBrandTag(){'), page.indexOf('})();', page.indexOf('function scBrandTag(){')));
ok(brand.includes('!SC_IS_WEB) return;'), 'only on the web');
ok(brand.includes('!SC_WEB_FULL) return;'), 'only where streaming lives');
ok(brand.includes("document.getElementById('scBuildTag')"), 'and never twice');
ok(brand.includes('}catch(_eBrand){}'), 'a missing header cannot break boot');

/* ── the rail is the owner's ────────────────────────────────────────────── */
const list = page.slice(page.indexOf('var SC_STREAM_GENRES = ['), page.indexOf('function scStreamGenreStrip('));
ok(!/gospel/i.test(list), 'the unwanted genre is not offered');
['Pop', 'Hip-Hop', 'Afrobeats', 'Punjabi', 'Latin', 'Rock', 'Jazz', 'Chill']
  .forEach((g) => ok(list.includes("n: '" + g + "'"), 'the regular genres are still there: ' + g));
ok(page.includes('genres: null'), 'the state has a place for the added genres');
ok(sliceFn('scStreamGenres').includes('SC_STREAM_GENRES.slice()'), 'the rail is the built-ins plus yours');
ok(sliceFn('scStreamGenres').includes('custom: true'), 'and an added one is marked as yours');
ok(sliceFn('scStreamGenreAdd').includes("prompt('Add a genre"), 'a + tile asks for a name');
ok(page.includes("dbPut('meta', { key: 'streamGenres'"), 'the added genres are remembered');
ok(page.includes("dbGet('meta', 'streamGenres')"), 'and come back with the shelf');
ok(sliceFn('scStreamGenreRemove').includes('confirm('), 'removing one asks first');
ok(sliceFn('scStreamGenreRemove').includes('came with the app'), 'and never removes ours');
ok(page.includes('scStreamGenres().forEach(function(g){'), 'the strip paints every genre');
ok(page.includes("(g.custom ? ' data-custom=\"1\"' : '')"), 'an added genre is marked in the markup');
ok(page.includes('id="scStreamGenreAdd"'), 'there is a tile to add one');
ok(page.includes("on('scStreamGenreAdd', 'click', scStreamGenreAdd);"), 'and it is wired');
const wire = page.slice(page.indexOf("querySelectorAll('.scs-genre')"), page.indexOf("on('scStreamNewPl'"));
ok(wire.includes('setTimeout(function()'), 'a long press is timed');
ok(wire.includes('scStreamGenreRemove('), 'and removes a genre of yours');
ok(wire.includes('held = true'), 'the tap after a long press is swallowed');
ok(sliceFn('scStreamGenre').includes('scStreamGenres();'), 'a genre is looked up among all of them');
ok(page.includes('window.__scStreamGenres = function()'), 'and the list can be asked for');

/* ── the AI reads them ──────────────────────────────────────────────────── */
const rec = page.slice(page.indexOf('function scShelfRecommend()'), page.indexOf('function scShelfRecommend()') + 900);
ok(rec.includes('if(scStreamAiRecommend()) return;'), 'Recommended asks the AI first');
const ai = page.slice(page.indexOf('function scStreamAiRecommend()'), page.indexOf('function scStreamGenreStrip('));
ok(ai.includes('_aiGeminiKey'), 'the AI call uses the key the app already holds');
ok(ai.includes('window.__scGeminiModel'), 'and the model the app already resolved');
ok(ai.includes('across these music tastes:'), 'it is asked about the genres, not one song');
ok(ai.includes('"song", "artist" and "genre"'), 'and answers with songs to search');
ok(ai.includes("scYtSearch(q, '', '')"), 'every song it names goes through the normal search');
ok(ai.includes('picks.slice(0, 4)'), 'and a few are offered, not a wall of them');
ok(ai.includes("scStreamSay('Chosen for your genres"), 'the results say where they came from');
ok(ai.includes('the genre tiles still search'), 'a failure is honest and leaves a way forward');
ok(rec.includes('Connect a Gemini key'), 'no key still recommends, and says how to get the AI');

/* ── driven: the rail it builds, and the names it accepts ───────────────── */
const ctx = {
  scStreamState: { genres: ['  Phonk ', 'pop', '', 'Lo-fi   beats', 'A very long genre name that should be cut'] },
  SC_STREAM_GENRES: [
    { n: 'Pop', q: 'pop hits', a: '#1', b: '#2' },
    { n: 'Hip-Hop', q: 'hip hop hits', a: '#3', b: '#4' }
  ],
  String, Array, Number, RegExp, JSON, Math
};
vm.createContext(ctx);
vm.runInContext(sliceFn('scStreamGenreName') + '\n' + sliceFn('scStreamGenres') + '\n' + sliceFn('scStreamGenresLine')
  + '\nthis.__name = scStreamGenreName; this.__all = scStreamGenres; this.__line = scStreamGenresLine;', ctx);
const names = vm.runInContext('this.__all().map(function(g){ return g.n; })', ctx);
ok(names[0] === 'Pop' && names[1] === 'Hip-Hop', 'driven: the built-ins come first');
ok(names.includes('Phonk'), 'driven: an added genre is offered');
ok(!names.some((n) => n.toLowerCase() === 'pop' && n !== 'Pop'), 'driven: a duplicate is not added twice');
ok(!names.includes(''), 'driven: an empty one is ignored');
ok(names.includes('Lo-fi beats'), 'driven: spaces are tidied');
ok(names.every((n) => n.length <= 24), 'driven: a name is capped');
ok(vm.runInContext('this.__name("  a   b  ")', ctx) === 'a b', 'driven: a name is one clean line');
ok(vm.runInContext('this.__all()[2].q', ctx) === 'Phonk hits', 'driven: an added genre searches itself');
ok(vm.runInContext('this.__line(2)', ctx).endsWith('and more'), 'driven: the line for the AI can be shortened');

if (bad.length) {
  console.log('check-80618: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80618: %d passed, 0 failed', pass);
