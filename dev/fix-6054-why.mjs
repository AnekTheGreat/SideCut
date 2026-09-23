#!/usr/bin/env node
// 60.5.4 follow-up, caught by dev/test-6054.mjs before ship:
//
// scHttpJson records WHY the last attempt failed as it goes, but a call that
// eventually SUCCEEDS after a failed shape (native 403 -> raw-body 200, say)
// left that why standing. The next search that reached the source and simply
// matched nothing would then read a stale "native request answered 403" and
// report a transport problem for a search that had been answered perfectly
// well. The why must describe the OUTCOME of this call: cleared on success,
// set only when every shape and the page fetch have given up.
//
// Safe to re-run: both anchors are checked for presence and uniqueness.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
let src = fs.readFileSync(INDEX, 'utf8');

const applied = [], failed = [];
function replaceOnce(name, oldStr, newStr) {
  const first = src.indexOf(oldStr);
  if (first === -1) { failed.push(name + ': anchor not found'); return; }
  if (src.indexOf(oldStr, first + 1) !== -1) { failed.push(name + ': anchor not unique'); return; }
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  applied.push(name);
}

replaceOnce('native success clears the why',
  '            if(obj) return obj;',
  '            if(obj){ window.__scHttpWhy = \'\'; return obj; }');

replaceOnce('page success clears the why',
  '      if(r && r.ok) return await r.json();',
  '      if(r && r.ok){ var fj = await r.json(); window.__scHttpWhy = \'\'; return fj; }');

fs.writeFileSync(INDEX, src);

console.log('fix-6054-why: ' + applied.length + ' applied');
applied.forEach((a) => console.log('  \u2713 ' + a));
if (failed.length) {
  failed.forEach((f) => console.log('  \u2717 ' + f));
  process.exit(1);
}
