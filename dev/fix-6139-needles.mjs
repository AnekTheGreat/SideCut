// One-shot repair for dev/patch-6139.mjs: the four test-file needles on lines
// 484/485/487/488 (1-indexed) over-escaped the regex metacharacters. The needles
// are template literals, so a raw run of 2 backslashes yields 1 in the value;
// dev/test-6137.mjs and dev/test-6138.mjs hold `\[ \n \{ \.` (ONE backslash
// each), so every raw run in those needles must be exactly 2. The current runs
// are [4,4,4,2,2] (values [2,2,2,0,0] — the bare `\.` even eats the dot), so
// clamp any run longer than 2 down to 2 on those four lines only, then prove
// the evaluated needle really occurs in the test file it targets.
import fs from 'node:fs';

const P = new URL('../dev/patch-6139.mjs', import.meta.url);
const TWO = '\\\\'; // source literal '\\\\' => value: two backslashes
const lines = fs.readFileSync(P, 'utf8').split('\n');

for (const n of [484, 485, 487, 488]) {
  const before = lines[n - 1];
  if (!before || before.indexOf('/const CHANGELOG = ') === -1) {
    throw new Error('line ' + n + ' is not the expected needle line: ' + JSON.stringify(before));
  }
  const after = before.replace(/\\{3,}/g, TWO);
  if (after === before) throw new Error('line ' + n + ' had no over-escaped run');
  lines[n - 1] = after;
}

// Every run on those lines must now be exactly 2, and the evaluated template
// must literally occur in the matching line of the matching test file.
// Lines 485/488 carry the NEW (61.3.9) needle — that one must not be in the
// file yet; its 61.3.8 twin is what has to match today.
for (const n of [484, 485, 487, 488]) {
  const line = lines[n - 1];
  const runs = (line.match(/\\+/g) || []).map((r) => r.length);
  if (runs.some((r) => r !== 2)) throw new Error('line ' + n + ' runs are ' + JSON.stringify(runs));
  const tpl = line.trim().match(/`([\s\S]*)`/);
  if (!tpl) throw new Error('line ' + n + ': no template literal found');
  const value = eval('`' + tpl[1] + '`'); // the needle exactly as subFile sees it
  const target = n === 484 || n === 485 ? 'dev/test-6137.mjs' : 'dev/test-6138.mjs';
  const want = /9'\/$/.test(value) ? value.slice(0, -3) + "8'/" : value;
  const text = fs.readFileSync(new URL('../' + target, import.meta.url), 'utf8');
  if (text.indexOf(want) === -1) {
    throw new Error('line ' + n + ': needle not found in ' + target + ': ' + JSON.stringify(want));
  }
}

fs.writeFileSync(P, lines.join('\n'));
console.log('patch-6139.mjs needles fixed and verified against test-6137/test-6138');
