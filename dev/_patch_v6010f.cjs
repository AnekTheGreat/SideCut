#!/usr/bin/env node
// v60.0.10f — one more patch-note line: the third bug, where the correct upload
// existed but the merge buried it past the candidates that get verified.
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
const needle = `    'A truncated preview can never be saved as a song.`;
if (src.split(needle).length - 1 !== 1) throw new Error('anchor not found');
src = src.replace(needle, `    'Buried uploads are found again. The three searches behind a conversion were merged by putting the quoted search\\u2019s results in FRONT, which pushed the artist\\u2019s own upload behind re-uploads of the same title \\u2014 and only the first few candidates get verified, so a correct source could exist and never be reached. Live, the SUKHA channel sat behind "SYSTEM RECORDS", "48 RECORDS" and a bass-boost channel. The merged list is ranked by the score each candidate carries now, a multi-artist credit scores its own channel, and a few more candidates are checked before giving up',
    'A truncated preview can never be saved as a song.`);
fs.writeFileSync(FILE, src);
console.log('✓ notes updated, index.html now ' + src.length + ' bytes');
