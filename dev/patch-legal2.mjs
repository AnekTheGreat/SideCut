#!/usr/bin/env node
// v60.5.0 part 2 — the actual acquisition-layer swap.
//
// scYtSearch/scYtPlayer keep their exact contracts (candidate list -> player
// object) and simply delegate to the licensed-source implementations when
// SC_IS_PLAY is set. Everything downstream — scTitleMatch, scDurationOk,
// scArtistMatch, tagging, album ordering, retries — runs unchanged.
//
// Sources (no API key, openly-licensed only):
//   search: archive.org advancedsearch restricted to netlabel collections or
//           items carrying a Creative Commons / CC0 license URL, audio only
//   player: archive.org/metadata/<id> -> direct licensed audio file URL
// videoId format on the Play path: 'ia:<identifier>'.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const legalLayer = `  // ---- Play build acquisition layer ------------------------------------------
  // Both implementations below run ONLY when SC_IS_PLAY is set. They keep the
  // exact contract of the video-host path (candidate list -> player object),
  // so every verification gate — scTitleMatch, scDurationOk, scArtistMatch —
  // and the whole tagging pipeline run unchanged on openly-licensed sources.
  async function scLegalSearch(query, artistHint, albumHint){
    try{
      var terms = String(query || '').trim();
      if(!terms) return null;
      // License-first: netlabel collections are CC by definition, otherwise the
      // item must carry a Creative Commons / CC0 license URL. Audio only, most
      // downloaded first so well-seeded copies of a match rank highest.
      var words = terms.toLowerCase().split(/\\s+/).filter(function(w){ return w.length > 1; });
      var titleClause = words.map(function(w){ return 'title:(' + w.replace(/[^\\w'-]/g, '') + ')'; }).join(' OR ');
      if(!titleClause) return null;
      var q = 'mediatype:(audio) AND (collection:(netlabels) OR licenseurl:(creativecommons*) OR licenseurl:(cc0*)) AND (' + titleClause + ')';
      var url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) +
                '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=length&fl[]=licenseurl&fl[]=downloads' +
                '&sort%5B%5D=downloads%20desc&rows=15&page=1&output=json';
      var d = await scHttpJson(url, null);
      var rows = d && d.response && d.response.docs;
      if(!rows || !rows.length) return null;
      function secsAny(v){
        if(v == null) return -1;
        var s = Array.isArray(v) ? v[0] : v;
        if(typeof s === 'number') return Math.round(s);
        s = String(s);
        if(s.indexOf(':') === -1){ var f = parseFloat(s); return isFinite(f) ? Math.round(f) : -1; }
        var p = s.split(':').map(function(x){ return parseInt(x, 10) || 0; });
        if(p.length === 2) return p[0] * 60 + p[1];
        if(p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
        return -1;
      }
      var artistNorm = String(artistHint || '').toLowerCase()
        .replace(/\\s+&\\s+/g, ' ').replace(/,/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ').replace(/\\s+/g, ' ').trim();
      var cands = [];
      for(var i = 0; i < rows.length; i++){
        var r = rows[i];
        if(!r || !r.identifier) continue;
        var t = String(Array.isArray(r.title) ? r.title[0] : (r.title || '')).trim();
        if(!t) continue;
        var creator = Array.isArray(r.creator) ? r.creator.join(', ') : String(r.creator || '');
        var tl = t.toLowerCase(), cl = creator.toLowerCase();
        var dur = secsAny(r.length);
        if(dur > 0 && (dur < 25 || dur > 30 * 60)) continue;
        var score = 0;
        for(var w = 0; w < words.length; w++){ if(tl.indexOf(words[w]) !== -1) score += 3; }
        if(tl.indexOf(terms.toLowerCase()) !== -1) score += 10;
        if(artistNorm && (cl.indexOf(artistNorm) !== -1 || tl.indexOf(artistNorm) !== -1)) score += 20;
        if(dur > 0 && dur < 60) score -= 20;
        if(dur > 720) score -= 20;
        if(/\\blive\\b|karaoke|cover|remix|instrumental|acoustic|tribute|reaction|podcast/.test(tl)) score -= 25;
        score += Math.min(8, Math.log10((Number(r.downloads) || 0) + 1) * 2);
        cands.push({ videoId: 'ia:' + r.identifier, title: t, owner: creator || 'Internet Archive', duration: dur, score: score });
      }
      if(!cands.length) return null;
      cands.sort(function(x, y){ return y.score - x.score; });
      return cands;
    }catch(e){ return null; }
  }
  async function scLegalPlayer(videoId){
    try{
      var id = String(videoId || '');
      if(id.indexOf('ia:') !== 0) return null;   // Play build refuses foreign ids
      id = id.slice(3);
      if(!id) return null;
      var md = await scHttpJson('https://archive.org/metadata/' + encodeURIComponent(id), null);
      if(!md || !md.files || !md.files.length) return null;
      var pick = [], rest = [];
      for(var i = 0; i < md.files.length; i++){
        var f = md.files[i];
        if(!f || !f.name) continue;
        var fmt = String(f.format || '');
        var probe = fmt + ' ' + f.name;
        var isAudio = /mp3|mpeg|ogg|vorbis|flac|wave|m4a|aac/i.test(probe) &&
                      !/image|jpeg|png|pdf|torrent|mpeg4|ogv|archive helper|stationlogo|thumbnail/i.test(probe);
        if(!isAudio) continue;
        var fileUrl = 'https://archive.org/download/' + encodeURIComponent(md.identifier || id) + '/' +
          f.name.split('/').map(encodeURIComponent).join('/');
        var row = { url: fileUrl,
                    mime: /ogg|vorbis/i.test(fmt) ? 'audio/ogg' : (/flac/i.test(fmt) ? 'audio/flac' : 'audio/mpeg'),
                    itag: 0, size: Number(f.size) || 0, muxed: false };
        if(/vbr mp3|mp3/i.test(fmt)) pick.push(row); else rest.push(row);
      }
      var pool = pick.length ? pick : rest;
      if(!pool.length) return null;
      var alts = (pool === pick) ? pool.slice(1).concat(rest) : pool.slice(1);
      var title = String(Array.isArray(md.title) ? md.title[0] : (md.title || '')) ||
                  String((md.metadata && md.metadata.title) || '');
      var creator = Array.isArray(md.creator) ? md.creator.join(', ') :
                    String(md.creator || (md.metadata && md.metadata.creator) || '');
      return { url: pool[0].url, mime: pool[0].mime, itag: 0, size: pool[0].size, muxed: false,
               alts: alts, videoTitle: title, author: creator,
               license: String(md.licenseurl || (md.metadata && md.metadata.licenseurl) || '') };
    }catch(e){ return null; }
  }
`;

const replacements = [
  {
    name: 'legal layer + scYtSearch gate',
    old: `  async function scYtSearch(query, artistHint, albumHint){
    try{`,
    neu: legalLayer + `  async function scYtSearch(query, artistHint, albumHint){
    if(SC_IS_PLAY) return scLegalSearch(query, artistHint, albumHint);
    try{`,
  },
  {
    name: 'scYtPlayer gate',
    old: `  async function scYtPlayer(videoId){
    var clients = [`,
    neu: `  async function scYtPlayer(videoId){
    if(SC_IS_PLAY) return scLegalPlayer(videoId);
    var clients = [`,
  },
];

let failed = 0;
for (const r of replacements) {
  const count = src.split(r.old).length - 1;
  if (count !== 1) { console.error(`anchor "${r.name}" matched ${count} times (need exactly 1)`); failed++; continue; }
  src = src.replace(r.old, r.neu);
  console.log(`ok  ${r.name}`);
}
if (failed) { console.error(`${failed} anchor(s) failed — nothing written`); process.exit(1); }

fs.writeFileSync(FILE, src);
console.log('written:', FILE);
