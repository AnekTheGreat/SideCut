// Corrective step for dev/_patch_v609b.cjs: its slice dropped the request line
// and left the try's closing brace unshifted. Both are restored here exactly.
//
//   node dev/_patch_v609c.cjs
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(HTML, 'utf8');
let n = 0;
function rep(from, to, expect) {
  const c = s.split(from).length - 1;
  if (c !== expect) { console.error(`MISMATCH (found ${c}, expected ${expect}):\n${from.slice(0, 160)}`); process.exit(1); }
  s = s.split(from).join(to);
  n += c;
}

rep(
  "      try{\n        if(sresp && sresp.ok){",
  "      try{\n        var sresp = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(artistName) + '&media=music&entity=song&limit=200' + stores[sti]);\n        if(sresp && sresp.ok){",
  1
);
rep(
  "          });\n      }\n      }catch(_e1){}",
  "          });\n        }\n      }catch(_e1){}",
  1
);

fs.writeFileSync(HTML, s);
console.log(`index.html: ${n} corrections`);
