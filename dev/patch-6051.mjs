#!/usr/bin/env node
// v60.5.1 — "exports take ALL of my data, everything in the app."
//
// The export already carries tracks+audio+covers, playlists, stats, premium
// and an explicit settings list — but anything NOT on that hand-written list
// was silently dropped: per-track lyrics sync nudges (lyricsSyncOff_*),
// albumOrder, sandboxDefaultView, widget theme, API bases, manual album data
// and every other localStorage key.
//
// Fix: embed the SAME wholesale sweep the on-device snapshot uses
// (collectLocalStorage + collectMeta — every stored key, minus caches and
// oversized values) as manifest.state in the zip, and hydrate it FIRST on
// import. The targeted settings-restore that follows still fixes live JS
// variables. idCounter jumps to the restored high-water mark before minting,
// so fresh ids can never collide with a restored library.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const nowEdt = new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York',
  month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
}).replace(' at ', ' \u00b7 ') + ' EDT';

const replacements = [
  {
    name: 'snapshot IIFE: expose collect + hydrate for the backup zip',
    old: `    };
    // Baseline snapshot shortly after boot - but ONLY when no snapshot file`,
    neu: `    };
    // Full-state collect/hydrate for the in-app backup zip (export everything /
    // import everything). Same sweep the on-device snapshot uses: every
    // localStorage key and every meta row, minus caches, oversized values and
    // shell snapshots — i.e. nothing a user can see in the app is left behind
    // when they move to a fresh install or a different build.
    window.__scSnapCollect = async function(){
      try{ return { v: 1, localStorage: collectLocalStorage(), meta: await collectMeta() }; }
      catch(e){ return null; }
    };
    window.__scSnapHydrate = async function(state){
      if(!state || state.v !== 1) return false;
      if(state.localStorage){
        for(var k in state.localStorage){ try{ localStorage.setItem(k, state.localStorage[k]); }catch(e){} }
      }
      if(state.meta){
        for(var mk in state.meta){ try{ await dbPut('meta', { key: mk, value: state.meta[mk] }); }catch(e){} }
      }
      return true;
    };
    // Baseline snapshot shortly after boot - but ONLY when no snapshot file`,
  },
  {
    name: 'exportLibrary: embed manifest.state (whole-store sweep)',
    old: `            manifest.pinnedArtists = typeof pinnedArtists !== "undefined" ? pinnedArtists : [];
          }catch(e){ console.log('Could not export discovery data:', e); }
        },`,
    neu: `            manifest.pinnedArtists = typeof pinnedArtists !== "undefined" ? pinnedArtists : [];
          }catch(e){ console.log('Could not export discovery data:', e); }
          // THE COMPLETE STATE — every localStorage key and every meta row, via
          // the same sweep the on-device snapshot uses. This closes the gap the
          // hand-written lists above always had: lyrics sync nudges
          // (lyricsSyncOff_*), albumOrder, sandboxDefaultView, widget theme,
          // API bases, manual album edits, hidden-album bookkeeping — imported
          // on a fresh install or a different build, nothing is left behind.
          try{
            if(window.__scSnapCollect) manifest.state = await window.__scSnapCollect();
            else console.log('Full-state collector unavailable');
          }catch(e){ console.log('Could not export full state:', e); }
        },`,
  },
  {
    name: 'importLibrary: hydrate full state first + idCounter jump',
    old: `      const isV2 = manifest.version === 2;`,
    neu: `      const isV2 = manifest.version === 2;
      // Full-state hydration FIRST: write every stored key back (lyrics sync
      // nudges, album order, widget theme, API bases, hidden playlists, manual
      // album data ...), then the targeted restores below fix the live JS
      // variables for the keys that have them. idCounter must jump to the
      // restored high-water mark before this import mints a single id, or the
      // fresh ids collide with the restored library on the next boot.
      if(manifest.state){
        try{ if(window.__scSnapHydrate) await window.__scSnapHydrate(manifest.state); }catch(e){ console.log('Full-state hydrate failed:', e); }
        try{
          if(manifest.state.meta && manifest.state.meta.idCounter !== undefined && typeof idCounter !== 'undefined'){
            var _expIdc = parseInt(manifest.state.meta.idCounter, 10);
            var _liveIdc = parseInt(idCounter, 10);
            if(isFinite(_expIdc) && (!isFinite(_liveIdc) || _expIdc > _liveIdc)) idCounter = _expIdc;
          }
        }catch(e){}
      }`,
  },
  {
    name: 'importLibrary: persist idCounter after minting',
    old: `      playlists['All Songs'] = allTracks.map(t => t.id);
      saveMeta();`,
    neu: `      playlists['All Songs'] = allTracks.map(t => t.id);
      saveMeta();
      // Persist the id high-water mark this import minted from, so the next
      // boot continues past every id in the restored library instead of
      // restarting from an older counter.
      try{ dbPut('meta', { key: 'idCounter', value: idCounter }); }catch(_eIdc){}`,
  },
  {
    name: 'export confirm copy: name what is now included',
    old: `PLUS playlists, listening stats, streak, theme, EQ, all settings, and your premium unlock code`,
    neu: `PLUS playlists, listening stats, streak, theme, EQ, all settings, EVERY stored preference (lyrics sync nudges, album order, widget theme, API bases, manual album edits), and your premium unlock code`,
  },
  {
    name: 'APP_VERSION -> 60.5.1',
    old: `const APP_VERSION = '60.5.0'`,
    neu: `const APP_VERSION = '60.5.1'`,
  },
  {
    name: 'changelog entry 60.5.1',
    old: `  { version: '60.5.0', date: 'September 22, 2026 \u00b7 4:10 PM EDT'`,
    neu: `  { version: '60.5.1', date: '${nowEdt}', title: 'Export takes everything — every stored preference, ready for a new build or phone', items: [
    'The backup zip now carries the COMPLETE app state \\u2014 every stored preference, not just the list the export screen names: per-song lyrics sync nudges, album order, widget theme, API bases, sandbox defaults, manual album edits, hidden-album bookkeeping, all of it, swept with the same collector the on-device snapshot uses.',
    'Import hydrates that full state first (then applies the live settings on top) and moves the id high-water mark past the restored library, so ids can never collide on the next boot \\u2014 restore this zip on a fresh install of any build and nothing is left behind.',
    'Android CI now builds both flavors on every push: the Play AAB/APK (flag-injected, licensed sources) and SideCut-full.apk (the complete build, sideloaded only).',
  ] },
  { version: '60.5.0', date: 'September 22, 2026 \u00b7 4:10 PM EDT'`,
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
console.log('written:', FILE, '| changelog date:', nowEdt);
