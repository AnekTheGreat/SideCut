import fs from 'node:fs';
const s = fs.readFileSync('index.html', 'utf8');
const blocks = s.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
const j = blocks[3].replace(/<\/?script[^>]*>/gi, '');
let open = 0;
let close = 0;
let deep = 0;
let max = 0;
const st = [];
const firstOver = [];
for (let i = 0; i < j.length; i++) {
  const c = j[i];
  if (c === '{') { st.push('{'); open++; max = Math.max(max, st.length); }
  else if (c === '}') { st.pop(); close++; }
  else if (c === ')') { if (st[st.length - 1] === '(') st.pop(); }
  else if (c === '(') st.push('(');
  else if (c === '[') st.push('[');
  if (st.length > 150 && firstOver.length === 0) firstOver.push(i);
}
console.log('open', open, 'close', close, 'bal', open - close, 'max', max, 'first-over-150', firstOver[0]);
