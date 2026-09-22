#!/usr/bin/env node
// v60.4.5 — OTA delivery hardening.
//
// Root cause of "no update notification, ever": the launch hand-over in
// dev/native-updates.js ran ONE boot attempt 4s after load and, if
// appBooted() was false (or anything above startAutoCheck() threw),
// returned without ever calling startAutoCheck() — silently disabling
// every update check for the rest of that session, on every session.
//
// Fixes:
//  1. startAutoCheck() runs FIRST, before any boot-glue that can throw.
//  2. The boot hand-over retries (every 2s, up to 30 tries) instead of
//     giving up permanently on one failed attempt.
//  3. The whole hand-over body is wrapped so a throw can never again
//     prevent the checks from starting.
//  4. Manual "Check for updates" always answers: up-to-date + running
//     version, or exactly which versions were compared — never silence.
//  5. APP_VERSION -> 60.4.5 (not a key in any LEGACY_VERSIONS map) and a
//     changelog entry with the correct EDT timestamp.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function patch(rel, pairs) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  let applied = 0, skipped = 0;
  for (const [name, oldStr, newStr] of pairs) {
    if (src.includes(newStr)) { console.log(`  = ${rel}: ${name} already applied`); skipped++; continue; }
    if (!src.includes(oldStr)) { console.error(`  ✗ ${rel}: ${name} — anchor NOT found`); process.exitCode = 1; skipped++; continue; }
    src = src.split(oldStr).join(newStr);
    applied++;
    console.log(`  ✓ ${rel}: ${name}`);
  }
  fs.writeFileSync(file, src);
  return { applied, skipped };
}

// ---- 1/2/3. native-updates.js boot chain --------------------------------
patch('dev/native-updates.js', [
  ['start auto-check first + retry boot',
`      setTimeout(function(){
        if(!appBooted()){ log('app did not finish booting — bundle stays unconfirmed'); return; }
        markAppReady();`,
`      var _bootTries = 0;
      var _autoStarted = false;
      function _bootTick(){
        // Start the update checks FIRST, before any boot-glue that can throw.
        // One failed boot attempt used to return out of here without ever
        // reaching startAutoCheck() — disabling every update check for the
        // session, silently, which is why no update notification ever came.
        if(!_autoStarted){
          _autoStarted = true;
          try{ startAutoCheck(); }catch(_ae){ log('auto-check failed to start: ' + ((_ae && _ae.message) || _ae)); }
        }
        _bootTries++;
        if(!appBooted()){
          log('app did not finish booting yet — bundle stays unconfirmed (attempt ' + _bootTries + ')');
          if(_bootTries < 30) setTimeout(_bootTick, 2000); // keep retrying — never give up silently
          return;
        }
        try{
        markAppReady();`],
  ['close the hand-over wrapper',
`        startAutoCheck();
      }, 4000);
    });`,
`        }catch(_ge){ log('boot hand-over skipped: ' + ((_ge && _ge.message) || _ge)); }
      }
      setTimeout(_bootTick, 4000);
    });`],
  ['manual check: never silent on up-to-date',
`        log(_cmp === 0 ? ('up to date (' + cur + ')')
                       : ('published bundle is older (v' + man.version + ') than this build (v' + cur + ') — nothing to install'));
        return null;`,
`        log(_cmp === 0 ? ('up to date (' + cur + ')')
                       : ('published bundle is older (v' + man.version + ') than this build (v' + cur + ') — nothing to install'));
        if(!o.silent){
          toast(_cmp === 0 ? ('You\\'re on the latest version ✓ (v' + cur + ')')
                           : ('Update check: published v' + man.version + ' is not newer than this build (v' + cur + ') — nothing to install.'), 4500);
        }
        return null;`],
  ['manual check: say when the running version is unknown',
`      if(!cur){ log('cannot determine the running version — skipping update check (fail safe)'); return null; }`,
`      if(!cur){
        log('cannot determine the running version — skipping update check (fail safe)');
        if(!o.silent) toast('Update check could not identify the running build — wait for the app to fully load, then try again.', 5000);
        return null;
      }`],
]);

// ---- 4/5. index.html version + changelog --------------------------------
const now = new Date();
const edt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
}).format(now).replace(/(\d+):(\d+) (AM|PM)/, (_, h, m, ap) => `${h}:${m} ${ap}`);
const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(now);
const dateStr = `${edt} EDT`.replace(' EDT', ' EDT'); // "September 21, 2026, 9:33 PM EDT"
const commaDate = edt.includes(',') ? edt : edt; // Intl en-US already yields "September 21, 2026 at 9:33 PM"
const normalized = commaDate.replace(' at ', ' · ').replace(/,\s/, ', ');
console.log('  changelog date:', `${normalized} EDT`);

patch('index.html', [
  ['APP_VERSION bump', `const APP_VERSION = '60.4.4';`, `const APP_VERSION = '60.4.5';`],
  ['changelog entry',
`  const CHANGELOG = [
  { version: '60.4.4',`,
`  const CHANGELOG = [
  { version: '60.4.5', date: '${normalized} EDT', title: 'Update notifications can no longer be silently skipped', items: [
    'The update check now starts before any other launch code and keeps retrying if the app is slow to finish starting — this is why the update notification never appeared: one unfinished boot check used to disable update checks for the whole session, quietly, every session.',
    'The launch hand-over is now wrapped so an error in it can never again stop the update check from starting.',
    'Check for updates always answers now: "You\\'re on the latest version" with the running build number, or exactly which two versions were compared — never silence.',
  ],
  { version: '60.4.4',`],
]);

console.log(process.exitCode ? 'PATCH FAILED' : 'ALL PATCHES APPLIED');
