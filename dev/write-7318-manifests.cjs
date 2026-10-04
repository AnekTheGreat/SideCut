// Writes the 73.1.8 notes (the head CHANGELOG entry's first 6 items) into
// updates.json and manifest.json, and sets the version + date. Size is left
// for ota-bundle.mjs to fill in on rebuild.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/const CHANGELOG = \[\s*\{[^{}]*?version: '73\.1\.8'[^{}]*?items: \[([\s\S]*?)\]\s*\},\s*\{/);
if(!m){ console.error('73.1.8 head entry not found'); process.exit(1); }
const notes = [];
const re = /'((?:[^'\\]|\\.)*)'/g; let x;
while((x = re.exec(m[1])) !== null){ notes.push(x[1].replace(/\\'/g, "'")); if(notes.length === 6) break; }
if(notes.length < 6){ console.error('head entry has fewer than 6 notes'); process.exit(1); }
const hasBad = /(download|convert|converter|mp3)/i;
if(hasBad.test(notes.join(' '))){ console.error('forbidden word in notes'); process.exit(1); }
const need = ['widget', 'player', 'lyrics', 'letter'];
for(const w of need){ if(!notes.join(' ').includes(w)){ console.error('missing required word: ' + w); process.exit(1); } }
if(!/(studio|player|dock|premium|license)/.test(notes.join(' '))){ console.error('missing required bracket word'); process.exit(1); }
for(const n of notes){
  if(n.length > 260){ console.error('note too long: ' + n.length); process.exit(1); }
  if(/'/.test(n)){ console.error('apostrophe in note'); process.exit(1); }
}
const date = 'October 4, 2026 · 10:05 PM EDT';
for(const f of ['updates.json', 'manifest.json']){
  const p = path.join(ROOT, f);
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  o.version = '73.1.8';
  o.date = date;
  o.notes = notes;
  fs.writeFileSync(p, JSON.stringify(o) + '\n');
  console.log(f + ' -> 73.1.8 (' + notes.length + ' notes)');
}
