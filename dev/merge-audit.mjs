// Post-merge audit: did the merge keep what BOTH sides added?
//
// Resolving conflict markers is only half a merge — git can also auto-merge
// two sides into something that parses but is missing one side's work, which
// is how v61.5 lost `__scNativeFetch` (a swallowed ReferenceError, so every
// phone silently fell back to page fetch + CORS relays) and gained a stray
// `}` that stopped the whole main script from parsing.
//
// For each merge parent this diffs that side against the merge base, then
// reports every line that side ADDED which the merged file no longer carries
// (or carries fewer times). Intentional replacements — a newer version number,
// a reworded comment, a rule one side deliberately tightened — show up too, so
// read the list rather than trusting the count; the point is that nothing gets
// dropped silently.
//
// It reads the three-stage merge state (`git show :1/:2/:3:<file>`), so run it
// BEFORE the merge commit — after committing, the stages are gone.
//
//   node dev/merge-audit.mjs [file...]      # defaults to index.html
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const FILES = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html'];
const show = (ref) => execFileSync('git', ['show', ref], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const countLines = (arr) => {
  const m = new Map();
  for (const l of arr) m.set(l, (m.get(l) || 0) + 1);
  return m;
};

for (const file of FILES) {
  console.log('\n===== ' + file);
  let base, ours, theirs;
  try {
    base = show(':' + 1 + ':' + file).split('\n');
    ours = show(':' + 2 + ':' + file).split('\n');
    theirs = show(':' + 3 + ':' + file).split('\n');
  } catch (e) {
    console.log('  no three-stage merge state for this file (resolved already?) — skipped');
    continue;
  }
  const baseCount = countLines(base);
  const wt = countLines(fs.readFileSync(file, 'utf8').split('\n'));

  const missing = (side, label) => {
    const sm = countLines(side);
    const out = [];
    for (const [line, n] of sm) {
      const added = n - (baseCount.get(line) || 0);   // added relative to the base
      if (added <= 0) continue;
      const have = wt.get(line) || 0;
      if (have < n) out.push([line, n - have]);
    }
    console.log('  ' + label + ': ' + out.length + ' distinct line(s) that side added are short/absent in the merge');
    for (const [l, k] of out) console.log('    missing×' + k + '  ' + l.slice(0, 200));
  };
  missing(ours, 'OURS (local) ');
  missing(theirs, 'THEIRS (remote)');
}
