#!/usr/bin/env node
// 80.6.2 - plain notes and a free settings strip, checked on the page that ships.
//
//   node dev/check-8062.cjs
//
// The note check is the important one: it pulls the page's OWN scNoteText() and
// scClBrief() out of index.html and runs every note in the CHANGELOG through
// them, so "no note can show a tag" is proved against the real history rather
// than against a sample somebody typed here.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pass = 0, fail = 0;

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

ok('the page runs 80.6.2', page.includes("const APP_VERSION = '80.6.2';"));
ok('the release marker is in the script', page.includes('80.6.2 - PLAIN NOTES AND A FREE STRIP'));
ok('the changelog records 80.6.2', page.includes("{ version: '80.6.2', date: '"));

const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let parsed = 0;
scripts.forEach((src, i) => {
  if (!src.trim() || /^\s*import /.test(src)) return;
  try { new Function(src); parsed++; }
  catch (e) { fail++; console.log('  FAIL script block ' + (i + 1) + ' does not parse — ' + e.message); }
});
ok('every inline script block parses', parsed > 0 && fail === 0, parsed + ' block(s)');

// ---- 1. the cleaner, on real notes -------------------------------------
const briefStart = page.indexOf('function scNoteText(');
const briefEnd = page.indexOf('function changelogRich(');
ok('the note cleaner is in the page', briefStart > -1 && briefEnd > briefStart);
if (briefStart > -1 && briefEnd > briefStart) {
  const fn = page.slice(briefStart, briefEnd);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  const clean = ctx.scClBrief;

  ok('a tagged note comes back as its sentence',
     clean('The <b>Frost dial</b> still runs 0 to 100.') === 'The Frost dial still runs 0 to 100.',
     clean('The <b>Frost dial</b> still runs 0 to 100.'));
  ok('entities become the characters they name',
     clean('the wall &mdash; and the &rarr; arrow') === 'the wall \u2014 and the \u2192 arrow',
     clean('the wall &mdash; and the &rarr; arrow'));
  ok('a doubled ampersand is not turned into a tag',
     clean('&amp;lt;b&amp;gt;') === '&lt;b&gt;', clean('&amp;lt;b&amp;gt;'));
  ok('quotes and apostrophes survive',
     clean("the &quot;dial&#39;s&quot; memory") === 'the "dial\'s" memory',
     clean("the &quot;dial&#39;s&quot; memory"));

  // Every note in the shipped changelog, briefs and details alike.
  const chStart = page.indexOf('  const CHANGELOG = [');
  const chEnd = page.indexOf('\n  ];', chStart);
  const chSrc = page.slice(chStart + '  const CHANGELOG = ['.length - 1, chEnd + 4);
  let entries = [];
  const chCtx = vm.createContext({});
  try { entries = vm.runInContext('(' + chSrc + ')', chCtx); } catch (e) { fail++; console.log('  FAIL the changelog could not be read — ' + e.message); }
  const notes = [];
  entries.forEach(e => {
    (e.items || []).forEach(i => notes.push(i));
    (e.details || []).forEach(d => notes.push(d));
  });
  ok('the whole changelog was read', notes.length > 300, notes.length + ' notes');
  // Emphasis tags and the named entities are what must never survive. A note that
  // QUOTES markup as an example (an <a target="_blank"> link) is describing code
  // and reads wrong without its brackets, so it keeps them.
  const bad = notes.filter(n => {
    const c = clean(n);
    return /<\/?(?:b|strong|i|em|code|small|span)\b/i.test(c) ||
           /&(?:mdash|ndash|rarr|larr|hellip|middot|nbsp|amp|quot|lt|gt|apos|#39);/i.test(c);
  });
  ok('no note keeps an emphasis tag or a named entity', bad.length === 0,
     bad.slice(0, 2).map(b => String(b).slice(0, 90)).join(' | '));
  const lostWords = notes.filter(n => clean(n).replace(/<[^>]*>/g, '').trim().length < 3);
  ok('and no note is emptied by the pass', lostWords.length === 0, lostWords.length + ' note(s)');
}

// ---- 2. the strip ------------------------------------------------------
// Scoped to the settings strip: the dock at the bottom of the app keeps its own
// snapping, and this release was never about that row.
const stripAt = page.indexOf('#settingsTabStrip {');
const stripBlock = stripAt > -1 ? page.slice(stripAt, page.indexOf('}', stripAt) + 1) : '';
ok('the settings strip has no snap', stripBlock.includes('scroll-snap-type: none;'));
ok('the old proximity snap is gone from the settings strip', !stripBlock.includes('scroll-snap-type: x proximity;'));
const tabAt = page.indexOf('#settingsTabStrip > .tab{');
const tabBlock = tabAt > -1 ? page.slice(tabAt, page.indexOf('}', tabAt) + 1) : '';
ok('no per-tab snap point is left', tabBlock.length > 0 && !tabBlock.includes('scroll-snap-align'));
ok('the strip scrolls smoothly when asked', page.includes('scroll-behavior: smooth;'));
ok('a drag on a tab moves the strip', page.includes('  touch-action: pan-x;\n  -webkit-user-drag: none;'));
ok('the tab centring still asks for a smooth scroll', page.includes("behavior: 'smooth'"));
ok('momentum scrolling is still on', page.includes('-webkit-overflow-scrolling: touch;'));
ok('the shell cache is v80.6.2', fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'sidecut-shell-v80.6.2'"));

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
