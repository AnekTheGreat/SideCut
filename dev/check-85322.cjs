// 85.3.22 harness - the split Studio tab has to be readable on the tab you are on.
//
// The owner's report: "it looks so good on dev version the tabs but so shit on regular
// version fix that", with two screenshots of the same dock: one where the Studio/Tools
// tile was a filled block with both names legible, and one where the highlight was a
// capsule whose curve ran through the corner "Tools" sits in, so the word hung outside
// it in the dock.
//
// Two browsers states, same build, two ways of painting the same tab:
//
//   * PLAIN DOCK, Studio open. `.active` fills the tile with the accent, and both halves
//     then painted their names IN that accent - coral on coral. The screenshot in the
//     report is a solid coloured block with no words in it.
//   * PILL DOCK, Studio open. The sliding highlight is a 999px capsule inset 4px; a split
//     tab keeps its names in its own CORNERS, so the capsule's round corner cut through
//     the one the name sits in.
//
// This gate reads the shipped stylesheet and the shipped highlight writer, and it also
// drives `scDockPillSync` far enough to see what radius the highlight is given over each
// kind of tab. Looked at, not only asserted: both dock states were rendered in a browser
// at 412x915 before and after the change (see AGENTS.md).
//
//   node dev/check-85322.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function count(src, needle) {
  let n = 0, at = 0;
  for (;;) { const i = src.indexOf(needle, at); if (i < 0) return n; n++; at = i + needle.length; }
}
function grab(name) {
  const key = 'function ' + name + '(';
  const start = page.indexOf(key);
  if (start < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}

(async function main() {

  // =======================================================================
  console.log('1. The filled tab wears a colour you can read');
  {
    const filled = '#studioBtn.active #studioHalf span, #studioBtn.active #toolsHalf span{ color: var(--on-coral) !important; }';
    ok('a filled split tab paints its names in the on-accent colour', page.includes(filled));
    ok('...and once', count(page, filled) === 1, count(page, filled));
    ok('the half you are in is covered too, whichever rule wins',
      page.includes('#studioBtn.active #studioHalf.active-half span, #studioBtn.active #toolsHalf.active-half span{ color: var(--on-coral) !important; }'));
    // The accent-colour cue is still what an UNFILLED half wears - that is the "where am
    // I" mark and it was never the problem.
    ok('an unfilled half keeps its accent-colour mark',
      page.includes('#studioHalf.active-half span, #toolsHalf.active-half span{ color: var(--coral) !important; font-weight: 700; }'));
    ok('the on-accent colour is a real variable, with a fallback', /--on-coral:\s*#[0-9a-f]{3,8}/i.test(page));
    ok('...and the theme writer can change it', page.includes("root.setProperty('--on-coral'"));
    // The two rules must not be the same one: a lit tile is not an unfilled half.
    const lit = page.indexOf(filled);
    const mark = page.indexOf('#studioHalf.active-half span, #toolsHalf.active-half span{ color: var(--coral)');
    ok('the lit tile rule comes after the accent mark, so it wins', lit > mark, [lit, mark].join(','));
  }

  // =======================================================================
  console.log('\n2. Under the sliding highlight the split tab is a rounded rect');
  {
    const sync = grab('scDockPillSync');
    ok('the highlight takes the split tab\'s own corner',
      /e\.thumb\.style\.borderRadius = b\.half \? '14px' : ''/.test(sync), sync.slice(sync.indexOf('borderRadius') - 80, sync.indexOf('borderRadius') + 80));
    ok('...only on a split tab, so a plain tab keeps the capsule',
      /b\.half \?/.test(sync));
    ok('the capsule is still the base shape for every other tab',
      /#scDockPillThumb\{[\s\S]*?border-radius: 999px;/.test(page));
    ok('and 14px is the split tab\'s own radius', /#studioBtn\{ flex: 1\.5 1 0; border-radius: 14px; \}/.test(page));
    ok('the highlight still wears the diagonal of the half', /e\.thumb\.style\.clipPath = b\.half \? scDockDividerPoly\(b\) : '';/.test(sync));

    // DRIVEN: the radius the highlight is actually given, for each kind of tab.
    const run = (half) => {
      const thumb = { style: {}, getBoundingClientRect: () => ({}) };
      const track = { style: {} };
      const mk = (id) => ({ id, classList: { toggle() {} }, getBoundingClientRect: () => ({}) });
      const sandbox = {
        scDockPillOn: true,
        scDockPillEls: function () { return { strip: { getBoundingClientRect: () => ({ left: 0, top: 0 }) }, track: track, thumb: thumb }; },
        scDockPillMeasure: function () { return [{ left: 10, top: 0, width: 60, height: 40, right: 70 }]; },
        scDockPillHotEl: mk('studioHalf'),
        scDockPillRest: function () { return null; },
        scDockPillBox: function () { return { left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40, half: half }; },
        scDockDividerPoly: function () { return 'polygon(half)'; },
        console: console
      };
      vm.createContext(sandbox);
      vm.runInContext(sync + '\nthis.__sync = scDockPillSync;', sandbox);
      sandbox.__sync();
      return thumb.style;
    };
    let st = run(true);
    ok('driven: over the split tab the highlight is a 14px rounded rect',
      st.borderRadius === '14px' && st.clipPath === 'polygon(half)', JSON.stringify(st));
    st = run(false);
    ok('driven: over a plain tab it is left as the capsule',
      st.borderRadius === '', JSON.stringify(st));
  }

  // =======================================================================
  console.log('\n3. The half you are in reads on the highlight');
  {
    const rule = 'body.sc-dock-pill #studioBtn #studioHalf.active-half span,';
    ok('the active half is drawn in the dock\'s ink under the highlight',
      page.includes(rule) && page.includes('body.sc-dock-pill #studioBtn #toolsHalf.active-half span,'),
      rule);
    ok('...which is the same ink the lit tabs use',
      page.includes('body.sc-dock-pill #studioHalf.sc-dock-hot span, body.sc-dock-pill #toolsHalf.sc-dock-hot span{ color: var(--ink) !important; }'));
    ok('and the library halves follow the same rule',
      page.includes('body.sc-dock-pill #playlistsHalf.active-half span,') &&
      page.includes('body.sc-dock-pill #albumsHalf.active-half span{ color: var(--ink) !important; }'));
  }

  // =======================================================================
  console.log('\n4. The release itself');
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) {
      scripts++;
      try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
    }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
    const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
    // The dock work was built under the label 85.3.22 and ships in 85.4 - the version after
    // 85.3.9, because a segment after the second only ever runs 0-9 (see the numbering rule at
    // the top of AGENTS.md). So the pin reads "85.4 or newer".
    const vNum = (s) => String(s || '').split('.').map(Number);
    const atLeast = (v, w) => {
      const a = vNum(v), b = vNum(w);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0, y = b[i] || 0;
        if (x !== y) return x > y;
      }
      return true;
    };
    ok('the page is on 85.4 or newer', atLeast(vPage, '85.4'), vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.4 entry', page.includes("version: '85.4'"));
    ok('the new entry is above 85.3.19',
      page.indexOf("version: '85.4'") < page.indexOf("version: '85.3.19'"));
    const entry = page.slice(page.indexOf("version: '85.4'"), page.indexOf("version: '85.3.19'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      entry.slice(0, 240));
    const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
    ok('the entry carries the things it describes', items >= 3, items);
    ok('and names the tab, the highlight and the names it could not read',
      /studio/i.test(entry) && /highlight/i.test(entry) && /names/i.test(entry));
  }
})().catch(function (e) { console.error(e); process.exitCode = 1; }).then(function () {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
});
