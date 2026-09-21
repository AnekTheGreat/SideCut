// Whitespace-only follow-up to dev/_patch_v609.cjs: the store loop wrapped the
// existing body, so re-indent that body by two spaces — the structure is
// unchanged, it just reads as the nesting it now is.
//
//   node dev/_patch_v609b.cjs
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(HTML, 'utf8');

const START = "      try{\n      var sresp = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(artistName) + '&media=music&entity=song&limit=200' + stores[sti]);\n";
const END = "      }\n      }catch(_e1){}\n    }\n    out.sort(function(x, y){ return String(y.releaseDate || '').localeCompare(String(x.releaseDate || '')); });";

const a = s.indexOf(START);
if (a === -1) { console.error('MISMATCH: store-loop head not found'); process.exit(1); }
const b = s.indexOf(END, a);
if (b === -1) { console.error('MISMATCH: store-loop tail not found'); process.exit(1); }

const head = "      try{\n";
const body = s.slice(a + START.length, b);
const shifted = body.split('\n').map((l) => (l.trim() ? '  ' + l : l)).join('\n');
s = s.slice(0, a) + head + shifted + s.slice(b);

fs.writeFileSync(HTML, s);
console.log('index.html: per-store block re-indented');
