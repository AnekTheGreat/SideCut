// 80.0.5 - THE STAIRCASE, answered from the page's own text.
//
// The cloud layout's dock is not a bar any more: each tab is its own capsule, the
// container has no chrome of its own, and the four of them step right as they go
// down the screen so the last one sits in the corner. Every rule below is one line
// of that contract, read straight out of index.html - so a later release that drags
// the tabs back into a row has to say so here, in the open.
//
//   node dev/staircase-check.cjs
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log('  PASS ' + label); }
  else { fail += 1; console.log('  FAIL ' + label); }
}

// The block this release added, from its banner to the last wide-window rule.
const start = src.indexOf('5. 80.0.5: the tabs are a staircase');
const end = src.indexOf('/* COMPUTERS.', start);
const block = start >= 0 && end > start ? src.slice(start, end) : '';
const wide = start >= 0 ? src.slice(end, src.indexOf('</style>', end > 0 ? end : start)) : '';

console.log('[1] the block exists and is one block');
{
  ok(start > 0, 'the 80.0.5 staircase block is in the page');
  ok(block.length > 1500, 'and it is not a stub (' + block.length + ' chars)');
  ok(/body\.sc80-cloud \.action-strip\{[\s\S]*?position: fixed;/.test(block),
    'the dock is position: fixed');
  ok(/left: auto; right: 12px;/.test(block), 'and anchored to the right edge');
  ok(/top: auto; bottom: calc\(env\(safe-area-inset-bottom\) \+ var\(--sc80-player\) \+ 10px\);/.test(block),
    'and to the bottom, above the measured player');
  ok(/flex-direction: column/.test(block), 'the tabs stack as a column, not a row');
  ok(/align-items: flex-end/.test(block), 'against that right edge');
  ok(/background: none;/.test(block) && /box-shadow: none;/.test(block),
    'and the container carries no chrome of its own, so each tab is its own capsule');
}

console.log('[2] four steps, one per tab');
{
  const steps = ['#homeBtn', '#libraryBtn', '#discoverBtn'];
  ok(/\.action-strip > #homeBtn\{ margin-right: calc\(var\(--sc80-step\) \* 3\); \}/.test(block),
    'Home is three steps in from the edge');
  ok(/\.action-strip > #libraryBtn\{ margin-right: calc\(var\(--sc80-step\) \* 2\); \}/.test(block),
    'Library two');
  ok(/\.action-strip > #discoverBtn\{ margin-right: var\(--sc80-step\); \}/.test(block),
    'Discover one');
  ok(/\.action-strip > #studioBtn\{ margin-right: 0; \}/.test(block),
    'and Studio sits in the corner, so the four read as a staircase');
  const margins = steps.map((s) => (block.match(new RegExp('\\' + s + '\\{ margin-right: ([^}]+)\\}')) || [])[1]);
  ok(new Set(margins).size === 3, 'three different offsets, not one shared inset (' + margins.join(' | ') + ')');
  ok(/--sc80-step: 15px/.test(block), 'the step is one variable (--sc80-step)');
  ok(/--sc80-step: 18px/.test(wide), 'and it widens on a computer');
}

console.log('[3] the player is measured, not guessed');
{
  ok(/--sc80-player: 112px;/.test(block), 'the fallback is declared in the same block');
  ok(/getElementById\('nowPlaying'\)/.test(src), 'applyLayout reaches for the player');
  ok(/setProperty\('--sc80-player', nh \+ 'px'\)/.test(src),
    'and writes its measured height into the variable the dock sits above');
  ok(/if\(nh > 40 && nh < 320\)/.test(src), 'with a guard, so a hidden player cannot lift the dock off the screen');
}

console.log('[4] the old bar is gone from this layout, not hidden behind');
{
  ok(/padding-top: 10px; padding-right: 0;/.test(block),
    'the views no longer reserve the top bar band');
  ok(/padding-bottom: calc\(var\(--sc80-player\) \+ 240px\)/.test(block),
    'they reserve the staircase and the player at the bottom instead');
  ok(/bottom: calc\(100% \+ 10px\);/.test(block),
    'the add-songs menu opens above the staircase, not under a top bar');
}

console.log('[5] bubbles: bigger on a phone, more per row on a computer');
{
  ok(/body\.sc80-cloud #homeBubbles\{ gap: 10px; \}/.test(block), 'the gap between two bubbles is 10px');
  ok(/body\.sc80-cloud \.home-bubble\{ width: calc\(50% - 5px\); padding: 14px; \}/.test(block),
    'and two still fit on a phone row');
  ok(/@media \(min-width: 900px\)/.test(wide), 'a 900px window gets its own rules');
  ok(/width: calc\(33\.333% - 7px\)/.test(wide), 'three bubbles to a row there');
  ok(/@media \(min-width: 1280px\)/.test(wide), 'and a 1280px one');
  ok(/width: calc\(25% - 8px\)/.test(wide), 'four to a row');
  ok(/max-width: 1120px; margin: 0 auto;/.test(wide), 'the wall is centred in a column rather than hugging the left edge');
}

console.log('[6] one motion set');
{
  ok(/--sc-ease: cubic-bezier/.test(src), 'the easing curve is a theme variable');
  ok(/--sc-ease-mid: 260ms;/.test(src), 'with one mid duration');
  ok(/transition: transform var\(--sc-ease-mid\) var\(--sc-ease\), background var\(--sc-ease-mid\) var\(--sc-ease\)/.test(block),
    'and the tabs read it');
  ok(!/transition:[^;]*\b(width|height|top|left|padding|margin)\b/.test(block),
    'nothing in this block animates layout');
}

console.log('[7] the split tabs kept their cut');
{
  ok(/clip-path:polygon\(0 0, 0 100%, 100% 100%\)/.test(src), 'Studio still owns the lower triangle');
  ok(/clip-path:polygon\(0 0, 100% 0, 100% 100%\)/.test(src), 'Tools the upper one');
  ok(/<line x1="0" y1="0" x2="100%" y2="100%"/.test(src), 'and the seam still runs top left to bottom right');
}

console.log('[8] every pill is sized by the staircase, not by the old bar');
{
  // 80.0.5 shipped two of these pills at 0px tall, and nothing in [2] could see
  // it: a pill with no height still has its margin. The rules that did it are
  // 80.0.3's, written with IDs, so they outranked the staircase's `> button` and
  // gave the two split pills a HEIGHT with a basis of zero. This answers for the
  // bug itself, because it is a bug that looks like nothing at all.
  const banner = src.indexOf('6. 80.0.6: the staircase pills are sized by the staircase');
  ok(banner > 0, 'the 80.0.6 sizing block is in the page');
  const sized = src.indexOf('body.sc80-cloud .action-strip > #homeBtn,\n' +
    'body.sc80-cloud .action-strip > #libraryBtn,\n' +
    'body.sc80-cloud .action-strip > #discoverBtn,\n' +
    'body.sc80-cloud .action-strip > #studioBtn,\n' +
    'body.sc80-cloud .action-strip > #dockAddBtn{');
  ok(sized > banner, 'and it restates the size of all five pills');
  const rule = sized > 0 ? src.slice(sized, src.indexOf('}', sized)) : '';
  ok(/flex: 0 0 auto;/.test(rule), 'with flex 0 0 auto, so no basis-zero height');
  ok(/width: var\(--sc80-pill-w\); height: var\(--sc80-pill-h\);/.test(rule),
    'and the staircase variables, not the old bar flex');
  const oldFlex = src.indexOf('body.sc80-cloud .action-strip > #libraryBtn{ flex: 1.18 1 0; }');
  ok(oldFlex > 0 && oldFlex < sized, 'the bar rule is still in the sheet, and the staircase overrides it after it');
  ok(/body\.sc80-cloud \.action-strip > #libraryBtn,\nbody\.sc80-cloud \.action-strip > #studioBtn\{ width: calc\(var\(--sc80-pill-w\) \+ 16px\); \}/.test(src),
    'and the two split pills carry sixteen pixels more width, for their two names');
}

console.log('[9] the cloud layout has one now bar, and nothing was dropped with it');
{
  const from = src.indexOf('7. 80.0.7: the cloud layout has one now bar');
  const to = src.indexOf('/* ---------- 5. Bigger screens', from);
  const bar = from > 0 && to > from ? src.slice(from, to) : '';
  ok(from > 0, 'the 80.0.7 now-bar block is in the page');
  ok(/body\.sc80-cloud #sc80Now\{ display: none; \}/.test(bar),
    'the duplicate chip is hidden in this layout - one bar, not two');
  ok(/body\.sc80-cloud #npPlayerStage\{ width: 38px; height: 34px;/.test(bar),
    'the turntable is smaller');
  ok(/body\.sc80-cloud #npControls button\{ width: 30px; height: 30px; \}/.test(bar),
    'the control buttons are smaller');
  ok(/body\.sc80-cloud #npInfo \.t\{ font-size: 12px;/.test(bar),
    'and the two lines of text are a point smaller');
  const hidden = (bar.match(/display:\s*none/g) || []).length;
  ok(hidden === 1,
    'nothing else is hidden: the chip is the only display:none in the block (' + hidden + ')');
  ok(!/env\(safe-area-inset-bottom\)/.test(bar),
    'and the bar does not reserve the bottom inset a second time');
}

console.log('[10] the dock is one panel, and its offset is kept true');
{
  const from = src.indexOf('8. 80.0.8: the staircase is one dock');
  const to = src.indexOf('/* ---------- 5. Bigger screens', from);
  const panel = from > 0 && to > from ? src.slice(from, to) : '';
  ok(from > 0, 'the 80.0.8 dock block is in the page');
  ok(panel.indexOf('border-radius: 24px;') > 0 && panel.indexOf('box-shadow: 0 18px 40px') > 0,
    'the strip is one rounded panel, not a pile of capsules');
  ok(panel.indexOf('backdrop-filter: blur(20px)') > 0,
    'with its own glass');
  ok(panel.indexOf('.action-strip > button') > 0 && panel.indexOf('background: transparent;') > 0,
    'and the pills inside are unpainted until one is active');
  ok(panel.indexOf('.action-strip > button.active') > 0,
    'which is what paints the active tab');
  ok(src.indexOf('new ResizeObserver(writePlayerHeight).observe(np)') > 0,
    'the bar measured height is observed, not guessed once');
  ok(src.indexOf('orientationchange') > 0 && src.indexOf('__sc80PlayerRO') > 0,
    'and it is refreshed on rotation, once per page');
}

console.log('');
console.log((fail ? fail + ' FAILED, ' : 'ALL PASS: ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
