import fs from 'node:fs';
const s = fs.readFileSync(process.argv[2], 'utf8');
const starts = [...s.matchAll(/<script/g)].map(m => m.index);
const ends = [...s.matchAll(/<\/script>/g)].map(m => m.index);
const b4 = s.slice(starts[3], ends[3]);
const code = b4.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');

// Find candidate regex starts: '/' not preceded by an assignment/closure op and not
// followed by '[', '*', '!', '$', '%', '^', '=', '<', '>', ':', '.', ',', ';', '@', '\s', ']', ')'.
const reStart = /\/(?![*!$%^=<>:.,;@\s\]\)])/g;
const hits = [];
let m;
while ((m = reStart.exec(code))) {
  const raw = code.slice(m.index, m.index + 30);
  // skip if it's a comment or string
  hits.push({ index: m.index, raw });
}
// Prune hits that are inside strings or comments is hard; instead try new Function on
// progressively larger chunks but skip the binary-search false positive by checking the
// exact line where it breaks using line-by-line with trailing-node integration.
// We'll instead directly find unbalanced [ or unclosed ( by scanning.
let depth = 0;
let prev = '';
const stack = [];
for (let i = 0; i < code.length; i++) {
  const ch = code[i];
  if (ch === '\\') { i++; continue; }
  if (ch === '/') {
    // regex start candidate
    const next = code[i + 1];
    if (next !== '/' && next !== '*' && next !== '=') {
      // could be regex start
    }
  }
  if (ch === '[' || ch === '(' || ch === '{') {
    const opens = { '[': ']', '(': ')', '{': '}' };
    const closes = { ']': '[', ')': '(', '}': '{' };
    // naive depth counting ignoring strings/comments not reliable; rely on new Function threshold
  }
}
console.log('candidate regex starts (sample):', hits.slice(0, 20).map(h => ({ idx: h.index, raw: JSON.stringify(h.raw) })));
