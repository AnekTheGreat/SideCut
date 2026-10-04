import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = process.argv[2];
const s = fs.readFileSync(path, 'utf8');
const starts = [...s.matchAll(/<script/g)].map(m => m.index);
const ends = [...s.matchAll(/<\/script>/g)].map(m => m.index);
const b4 = s.slice(starts[3], ends[3]);
const code = b4.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
const lines = code.split('\n');

function testNode(code) {
  const f = `/tmp/_blk_test_${process.pid}.js`;
  fs.writeFileSync(f, code);
  try {
    execFileSync('node', ['--check', f], { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch (_) {
    return false;
  } finally {
    try { fs.unlinkSync(f); } catch (_) {}
  }
}

let bad = null;
for (let i = 0; i < lines.length; i++) {
  const c = lines.slice(0, i + 1).join('\n');
  if (!testNode(c)) { bad = i; break; }
}
console.log('first bad line:', bad);
if (bad !== null) console.log('line:', JSON.stringify(lines[bad]));
