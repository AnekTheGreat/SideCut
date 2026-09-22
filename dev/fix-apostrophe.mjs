import fs from 'node:fs';
const f = 'index.html';
let s = fs.readFileSync(f, 'utf8');
const bad = "so an album's songs keep";
const good = 'so an album\\u2019s songs keep';
if (s.includes(bad)) {
  s = s.replace(bad, good);
  fs.writeFileSync(f, s, 'utf8');
  console.log('fixed apostrophe');
} else {
  console.log('already fixed or not found');
}
