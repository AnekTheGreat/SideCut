#!/usr/bin/env node
// v60.0.10e — the muxed fallback is a much bigger download (~11 MB against
// ~3 MB), so say so in the row's status line instead of leaving the user
// watching a slow bar with no idea why.
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
const report = [];
function sub(label, needle, repl) {
  const n = src.split(needle).length - 1;
  if (n !== 1) { report.push({ label, ok: false, found: n }); throw new Error(label); }
  src = src.split(needle).join(repl);
  report.push({ label, ok: true });
}

sub('decode-status', `  async function scFetchDecode(stream){
    if(!stream) return null;
    var list = [{ url: stream.url, size: stream.size }].concat(stream.alts || []);
    for(var i = 0; i < list.length; i++){
      var s = list[i] || {};
      if(!s.url) continue;
      try{
        if(!(await scStreamUsable(s.url, s.size))) continue;
        var ab = await scFetchBytes(s.url, s.size);`, `  async function scFetchDecode(stream, onStatus){
    if(!stream) return null;
    var list = [{ url: stream.url, size: stream.size, muxed: stream.muxed }].concat(stream.alts || []);
    for(var i = 0; i < list.length; i++){
      var s = list[i] || {};
      if(!s.url) continue;
      try{
        if(!(await scStreamUsable(s.url, s.size))) continue;
        if(s.muxed && onStatus) onStatus('\u2b07 Music audio comes bundled with the video \u2014 downloading that instead (a bigger file)\u2026');
        var ab = await scFetchBytes(s.url, s.size);`);

sub('decode-call', `    var dec = await scFetchDecode(audio);
    if(!dec){ window.__scSourceFail = 'download blocked'; return null; }`, `    var dec = await scFetchDecode(audio, onStatus);
    if(!dec){ window.__scSourceFail = 'download blocked'; return null; }`);

fs.writeFileSync(FILE, src);
for (const r of report) console.log((r.ok ? '✓' : '✗') + ' ' + r.label);
console.log('index.html now ' + src.length + ' bytes');
