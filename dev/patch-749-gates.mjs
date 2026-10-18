// 74.9 gate retargets. The owner's changes are intentional, so the gates that
// pinned the old behaviour are moved to the new truth (the repo's rule: a gate
// follows an intentional change; it never blocks it by staying behind).
//
//   node dev/patch-749-gates.mjs     # idempotent — a second run is a no-op
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
let applied = 0, skipped = 0;

function patch(rel, name, oldStr, newStr) {
  const P = path.resolve(HERE, '..', rel);
  let src = fs.readFileSync(P, 'utf8');
  if (src.indexOf(newStr) !== -1) { console.log('  = already applied: ' + name); skipped++; return; }
  const i = src.indexOf(oldStr);
  if (i === -1) { console.error('  ✗ ANCHOR MISSING: ' + name); process.exit(1); }
  src = src.slice(0, i) + newStr + src.slice(i + oldStr.length);
  fs.writeFileSync(P, src);
  console.log('  ✓ ' + name); applied++;
}

// studio-70-check — the driven dock-pill section: the dock now ARRIVES joined
// and the switch's first tap takes it apart, second tap joins it again.
patch('dev/studio-70-check.cjs', 'studio-70-check: the dock arrives joined',
String.raw`    const sw = doc.querySelector('#studioView [data-act="dockpill"]');
    ok(!!sw, 'the Studio renders the Pill dock switch');
    ok(!doc.body.classList.contains('sc-dock-pill') && typeof win.__scSetDockPill === 'function',
      'and the dock starts apart, with a way to join it');
    if (sw) sw.click();
    await wait(120);
    ok(doc.body.classList.contains('sc-dock-pill'), 'tapping it joins the dock');
    ok(!!doc.getElementById('scDockPillTrack') && !!doc.getElementById('scDockPillThumb'),
      'and builds the capsule and the highlight');
    ok(String(win.localStorage.getItem('sidecut_dockPill')) === '1',
      'the choice is written down, so the next boot comes back joined');
    const sw2 = doc.querySelector('#studioView [data-act="dockpill"]');
    if (sw2) sw2.click();
    await wait(120);
    ok(!doc.body.classList.contains('sc-dock-pill'), 'tapping it again takes the dock apart');
    ok(String(win.localStorage.getItem('sidecut_dockPill')) === '0', 'and writes that down too');`,
String.raw`    const sw = doc.querySelector('#studioView [data-act="dockpill"]');
    ok(!!sw, 'the Studio renders the Pill dock switch');
    // 74.9 — THE PILL IS THE STANDARD. This used to pin the opt-in world: the
    // dock started apart and the switch joined it. The owner made the capsule
    // the default, so the dock ARRIVES joined and both directions of the
    // switch are still driven, written down and reversible.
    ok(doc.body.classList.contains('sc-dock-pill') && typeof win.__scSetDockPill === 'function',
      'and the dock arrives joined — the pill is the standard now');
    if (sw) sw.click();
    await wait(120);
    ok(!doc.body.classList.contains('sc-dock-pill'), 'tapping it takes the dock apart');
    ok(String(win.localStorage.getItem('sidecut_dockPill')) === '0',
      'the choice is written down, so the next boot stays apart');
    const sw2 = doc.querySelector('#studioView [data-act="dockpill"]');
    if (sw2) sw2.click();
    await wait(120);
    ok(doc.body.classList.contains('sc-dock-pill'), 'tapping it again joins the dock');
    ok(!!doc.getElementById('scDockPillTrack') && !!doc.getElementById('scDockPillThumb'),
      'and the capsule and the highlight are still there');
    ok(String(win.localStorage.getItem('sidecut_dockPill')) === '1', 'and writes that down too');`);

console.log(`patch-749-gates: ${applied} applied, ${skipped} already present`);
