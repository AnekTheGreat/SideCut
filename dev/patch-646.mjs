#!/usr/bin/env node
// SideCut — the pinned-page guard has to wait for the app to say what version it is.
//
// `detectPinnedOlderPage()` stops a pinned old page and a newer installed bundle
// from fighting each other across launches (install, swap back, install — the
// restart loop). It ran ONCE, from the updater's own module, and asked
// `currentVersion()` what version the page is.
//
// The problem is WHEN that module runs: `dev/native-updates.js` is its own
// <script> tag, so the parser reaches it before it reaches the app's much larger
// inline script. Its promise chain (ledger read → ledger write) can therefore
// finish while the app has not run yet, and `currentVersion()` then falls back to
// the version LABEL — which the shipped markup carries as a stale placeholder,
// "SideCut v48". The guard compared the pin with 48, mismatched, and gave up for
// good: no detection, no pin clear, the fight continues.
//
// Found by dev/ota-guard-check.cjs once the 63.0.8 boot work changed when that
// chain lands (3 checks: "the masking pin is detected" and the two that follow).
// The fix: ask `appReportedVersion()` — the app's own constant / dataset, never
// the label — and treat "the app has not run yet" as "not yet" rather than "no".
//
//   node dev/patch-646.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'dev/native-updates.js');

const OLD = `  function detectPinnedOlderPage(Updater){
    try{
      if(!Updater || typeof Updater.current !== 'function') return;
      var pinned = null;
      try{ pinned = localStorage.getItem('sidecut_pinned_snapshot'); }catch(e){}
      var pageV = currentVersion();
      if(!pinned || !pageV || String(pinned) !== String(pageV)) return; // not a pinned snapshot view
`;

const NEW = `  function detectPinnedOlderPage(Updater, waited){
    try{
      if(!Updater || typeof Updater.current !== 'function') return;
      var pinned = null;
      try{ pinned = localStorage.getItem('sidecut_pinned_snapshot'); }catch(e){}
      if(!pinned) return; // nothing was ever pinned, so nothing can be masked
      // The page's own version, from a source the APP wrote -- never the label.
      // The markup ships a stale placeholder ("SideCut v48") for any boot that has
      // not finished, and this runs from the updater's own module, which the
      // parser reaches BEFORE the app's much larger script has run.
      //
      // This check used to run once, right here, against the label: it compared
      // the pin with 48, gave up for good, and left a pinned old page and a newer
      // installed bundle fighting across every launch (install, swap back,
      // install -- the restart loop it exists to stop). "Not yet" is not "no".
      var pageV = appReportedVersion();
      if(!pageV){
        waited = waited || 0;
        if(waited < 10000) setTimeout(function(){ detectPinnedOlderPage(Updater, waited + 250); }, 250);
        return;
      }
      if(String(pinned) !== String(pageV)) return; // not a pinned snapshot view
`;

if (path.basename(process.argv[1] || '') !== path.basename(fileURLToPath(import.meta.url))) {
  // noop guard for the unlikely case of being imported
}

let src = fs.readFileSync(FILE, 'utf8');
const marker = 'if(!pinned) return; // nothing was ever pinned, so nothing can be masked';
if (src.indexOf(marker) !== -1) {
  console.log('= detectPinnedOlderPage retry (already applied)');
} else {
  const got = src.split(OLD).length - 1;
  if (got !== 1) throw new Error('detectPinnedOlderPage: found ' + got + ' occurrence(s), want 1');
  src = src.split(OLD).join(NEW);
  fs.writeFileSync(FILE, src);
  console.log('• detectPinnedOlderPage waits for the app to report its version');
}
