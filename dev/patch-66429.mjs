#!/usr/bin/env node
// SideCut - 64.2.9: the update installs itself on launch, and the animated
// backdrop stops being redrawn.
//
// Asked for: "The glitch with dynamic themes and the favorites bubble and pinned
// artist plateau still happens and the ota update should automatically happen on
// boot no manually clicking install".
//
//   [A] THE UPDATE INSTALLS ITSELF ON A REAL LAUNCH. Every automatic path before
//       this one stopped at the update SHEET: the boot check found the newer
//       version, wrote the notes into the card and waited for a tap on
//       "Download & install" - so the update only ever arrived on a phone whose
//       owner pressed it. Nothing was missing except the step between "found"
//       and "fetching", which is what autoInstall() is. It runs ONLY from the
//       boot check (the load event - the same "real launch" the staged hand-over
//       was already pinned to in v58.9.1); the 3-hour timer and the foreground
//       resume still only OFFER the update, because those are the checks that run
//       while the user is listening to something and a hand-over there is the
//       "it refreshes itself while I am using it" report that has to stay out.
//       The hand-over itself is applyStagedNow() - the sheet's own Install now -
//       so every guard (never older, never a bundle that failed here before, the
//       restart loop, the one-attempt record, the on-disk ledger write before the
//       swap) applies exactly as it does when the button is tapped.
//
//   [B] THE TWO ANIMATED BACKDROP LAYERS ARE TRANSLATION ONLY, AND SMALLER. The
//       v60 note next to them already claims "all of it is transform/opacity only
//       so the compositor runs it without repainting" - and a SCALE is not that.
//       A scale change has to be rastered again at the new size, and these two
//       layers are each bigger than the screen (inset:-32%/-26%), so the drift
//       and the counter-layer meant a fresh raster of a screen-and-a-bit, twice,
//       continuously, behind every screen in the app - the memory and raster
//       pressure a phone answers by dropping the paint of the card nearest the
//       edge. translate3d and opacity are composited with no raster at all, which
//       is what the note claimed all along; the rotation is gone with the scale
//       for the same reason. The amplitudes grow a little so the motion still
//       reads, and with no zoom to cover the layers come in to inset:-20%/-18%.
//
//   [C] THE HOME CARD CONTAINS ITS OWN GLOW. 64.2.7 named it as the last thing a
//       dynamic theme animates inside a clipped, rounded box: every Home card
//       holds a .hb-glow pulsing on opacity, and its invalidation reached the
//       scroller the card sits in. `contain:paint` says every pixel of that stays
//       inside the card - same glow, same clip, same corner, and the scroller
//       around it cannot be invalidated by it.
//
//   [D] ONE LATENT BUG THE CHANGE EXPOSED, FIXED HERE. The boot check now hands
//       over the bundle at ~2.5s, and the launch hand-over runs at 4s. On a
//       device the swap reloads the page in between; a slow or failed set() would
//       leave the old context running, getNextBundle() would still report the
//       bundle we just installed, and applyInBackground() would mark a perfectly
//       good version as "handed over to once without taking over" - refusing that
//       release forever. HANDED_OVER_THIS_SESSION is that guard.
//
//   node dev/patch-66429.mjs
//   node dev/patch-66429.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. Prose and JS literals that need a glyph get the real character,
// built here so this script stays ASCII (see AGENTS.md).
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use
const EM = cp(0x2014);       // the em dash the OTA gate's section headers carry

const VER = '64.2.9';
const OLD_VER = '64.2.8';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 28, 2026 ' + DOT + ' 11:55 PM EDT';
const OLD_STAMP = 'September 28, 2026 ' + DOT + ' 11:40 PM EDT';
const SW_CACHE = '63.0.27';
const OLD_SW_CACHE = '63.0.26';

const TITLE = 'The update installs itself on launch, and the animated backdrop stops being redrawn';

// Six short notes, published on BOTH channels (no [FULL] marker anywhere).
// dev/test-66425.mjs and dev/test-66426.mjs read the HEAD entry after the repin,
// so the notes below still have to carry "rollback", "blank", "list" and
// "record" - see AGENTS.md, 64.2.7 point 4. They are written for it rather than
// padded: what the update does on launch, what is left of the backdrop and what
// this release did not touch are all genuinely part of it.
const NOTES = [
  'SideCut installs an update by itself on launch now: when the app opens and a newer build is published, it is fetched and handed over with no Install tap. The sheet still shows the notes, the size and a live progress bar while it works.',
  'A track playing is still not interrupted. The hand-over waits for the app to close, that version one attempt record is left unused, and the next launch installs it, so nothing is ever cut off mid-song.',
  'The animated themes no longer scale or rotate their backdrop. A scale change has to be drawn again at the new size, and those two layers are larger than the screen, so that ran continuously behind every list in the app.',
  'The corner glow on a Home card is contained to the card now: its pulse cannot invalidate the scroller holding it, which is the last thing a dynamic theme animated inside a clipped box. Losing that paint is what leaves a blank cell behind.',
  'Nothing else moved: the library list, the playlists, the pinned artists island, the record tap in the now bar and every saved rollback copy behave as they did, and no song, cover, playlist or setting is touched.',
  'This is 64.2.9 and not a rebuild of 64.2.8: a phone already on that version is offered it, and this time it installs itself on the next launch.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66429 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let edits = 0;
let cur = null, curRel = null;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };
function load(rel) { curRel = rel; cur = fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function save() { fs.writeFileSync(path.join(ROOT, curRel), cur); }

// Replace every occurrence of an exact needle. A removal (newStr === '') with no
// marker is idempotent on "there is nothing left to remove".
function sub(label, oldStr, newStr, want, marker) {
  const m = marker === undefined ? newStr : marker;
  if (m !== '' && cur.indexOf(m) !== -1) return skip(label);
  const got = cur.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (newStr === '' && marker === undefined && got === 0) return skip(label);
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  cur = cur.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// A - the animated backdrop: translation only, and a smaller footprint
// ═══════════════════════════════════════════════════════════════════════════
load('index.html');

const DRIFT_OLD = `@keyframes sd-dyn-drift{
  0%{ transform: translate3d(-6%, -4%, 0) scale(1) rotate(0deg); }
  20%{ transform: translate3d(4%, -6%, 0) scale(1.08) rotate(2deg); }
  40%{ transform: translate3d(7%, 4%, 0) scale(1.14) rotate(-1deg); }
  60%{ transform: translate3d(-3%, 7%, 0) scale(1.1) rotate(1deg); }
  80%{ transform: translate3d(-7%, -2%, 0) scale(1.06) rotate(-2deg); }
  100%{ transform: translate3d(-6%, -4%, 0) scale(1) rotate(0deg); }
}`;
const DRIFT_NEW = `/* 64.2.9: the drift is translation only. A scale change is not a compositor
   property - the layer has to be drawn again at its new size - and this one is
   wider and taller than the screen, so the scale (and the rotation, which has to
   be resampled the same way) meant a fresh raster of a screen-and-a-bit, twice
   over with ::after, for as long as the app was open. translate3d is run by the
   compositor with no raster at all, which is what the v60 note above always said
   all of this was. The amplitudes are a little larger so the motion still reads. */
@keyframes sd-dyn-drift{
  0%{ transform: translate3d(-6%, -4%, 0); }
  20%{ transform: translate3d(5%, -7%, 0); }
  40%{ transform: translate3d(9%, 5%, 0); }
  60%{ transform: translate3d(-4%, 9%, 0); }
  80%{ transform: translate3d(-9%, -3%, 0); }
  100%{ transform: translate3d(-6%, -4%, 0); }
}`;
sub('the drift is translation only', DRIFT_OLD, DRIFT_NEW);

const REV_OLD = `@keyframes sd-dyn-drift-rev{
  0%{ transform: translate3d(7%, 5%, 0) scale(1.12) rotate(0deg); opacity:.5; }
  25%{ transform: translate3d(-5%, 7%, 0) scale(1.02) rotate(-3deg); opacity:.8; }
  50%{ transform: translate3d(-8%, -4%, 0) scale(1.14) rotate(2deg); opacity:.55; }
  75%{ transform: translate3d(4%, -7%, 0) scale(1.04) rotate(3deg); opacity:.85; }
  100%{ transform: translate3d(7%, 5%, 0) scale(1.12) rotate(0deg); opacity:.5; }
}`;
const REV_NEW = `/* 64.2.9: same rule as the drift above - the counter-layer translates and fades,
   and no longer scales or rotates. */
@keyframes sd-dyn-drift-rev{
  0%{ transform: translate3d(9%, 6%, 0); opacity:.5; }
  25%{ transform: translate3d(-6%, 9%, 0); opacity:.8; }
  50%{ transform: translate3d(-10%, -5%, 0); opacity:.55; }
  75%{ transform: translate3d(5%, -9%, 0); opacity:.85; }
  100%{ transform: translate3d(9%, 6%, 0); opacity:.5; }
}`;
sub('the counter-moving layer is translation only too', REV_OLD, REV_NEW);

// The footprint. Nothing has to fit a zoom any more, so both layers come in -
// same motion, ~13%/28% less of a screen-and-a-bit to raster, and still oversized
// enough for the widest translate (9% of a 140% layer is 12.6% of the viewport,
// against a 20% overscan).
sub('the seven-theme backdrop comes in to -20%',
  "  content:''; position:fixed; inset:-32%; z-index:-1; pointer-events:none;\n  animation: sd-dyn-drift 18s ease-in-out infinite;",
  "  content:''; position:fixed; inset:-20%; z-index:-1; pointer-events:none;\n  animation: sd-dyn-drift 18s ease-in-out infinite;");
sub('the counter-layer comes in to -18%',
  "  content:''; position:fixed; inset:-26%; z-index:-1; pointer-events:none;",
  "  content:''; position:fixed; inset:-18%; z-index:-1; pointer-events:none;");
sub('the five newer backdrops come in to -20%',
  "  content:''; position:fixed; inset:-32%; z-index:-1; pointer-events:none;\n}",
  "  content:''; position:fixed; inset:-20%; z-index:-1; pointer-events:none;\n}");

// ═══════════════════════════════════════════════════════════════════════════
// B - the Home card contains its own glow
// ═══════════════════════════════════════════════════════════════════════════
sub('a Home card contains everything it paints',
  '  border-radius:22px; border:1px solid var(--line); cursor:pointer; overflow:hidden;\n',
  '  border-radius:22px; border:1px solid var(--line); cursor:pointer; overflow:hidden;\n' +
  '  /* 64.2.9: paint containment. Every card holds a .hb-glow that pulses on opacity\n' +
  '     for as long as a dynamic theme is on, and that is an animated layer inside a\n' +
  '     rounded, clipped box - 64.2.7 named it as the last thing a dynamic theme draws\n' +
  '     inside one. Without containment that layer invalidates the scroller the card\n' +
  '     sits in, and a dropped paint there is the empty cell the Favorites bubble and\n' +
  '     the pinned-artists island have both been reported as. Same pixels, same clip,\n' +
  '     same corner: the invalidation just cannot leave the card. */\n' +
  '  contain:paint;\n');

fs.writeFileSync(FILE, cur);

// ═══════════════════════════════════════════════════════════════════════════
// C - the release itself
// ═══════════════════════════════════════════════════════════════════════════
load('index.html');
if (cur.indexOf(`  const APP_VERSION = '` + VER + `';`) !== -1) skip('APP_VERSION is ' + VER);
else {
  if (cur.indexOf(`  const APP_VERSION = '` + OLD_VER + `';`) === -1) throw new Error('APP_VERSION was not ' + OLD_VER);
  cur = cur.split(`  const APP_VERSION = '` + OLD_VER + `';`).join(`  const APP_VERSION = '` + VER + `';`);
  done('APP_VERSION is ' + VER);
}

// NOTES holds the DECODED text, so an apostrophe has to be re-escaped on the way
// into a single-quoted CHANGELOG string - otherwise the array stops parsing (the
// lesson of 64.2.8, AGENTS.md point 3).
const esc = (n) => n.split("'").join("\\'");
const HEAD_NEW = `  { version: '` + VER + `', date: '` + STAMP + `', title: '` + TITLE + `', items: [` +
  NOTES.map((n) => `\n    '` + esc(n) + `',`).join('') + `\n  ] },\n`;
if (cur.indexOf(`  { version: '` + VER + `', date: '` + STAMP + `'`) !== -1) skip('the head changelog entry is ' + VER);
else {
  if (cur.indexOf(`  const CHANGELOG = [\n`) === -1) throw new Error('the CHANGELOG opener was not found');
  cur = cur.split(`  const CHANGELOG = [\n`).join(`  const CHANGELOG = [\n` + HEAD_NEW);
  done('the head changelog entry is ' + VER + ' with ' + NOTES.length + ' notes');
}
fs.writeFileSync(FILE, cur);

// sw.js carries a cache name and NOTHING of the app version (dev/ota-guard
// asserts that), so it moves on its own line and its own counter.
load('sw.js');
const SW_NEW = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
const SW_OLD = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
if (cur.indexOf(SW_NEW) !== -1) skip('the service worker cache moves on ' + SW_CACHE);
else {
  if (cur.indexOf(SW_OLD) === -1) throw new Error('sw.js cache was not v' + OLD_SW_CACHE);
  cur = cur.split(SW_OLD).join(SW_NEW);
  done('the service worker cache moves on ' + SW_CACHE);
}
save();

// ═══════════════════════════════════════════════════════════════════════════
// D - the OTA client installs the update itself on a real launch
// ═══════════════════════════════════════════════════════════════════════════
load('dev/native-updates.js');

// One session-level record of a hand-over, read by the launch hand-over below.
sub('a hand-over is remembered for the rest of the launch',
  '  function persistSheet(state){',
  '  // Set when a bundle is handed over during THIS session. The boot check installs\n' +
  '  // by itself now, and getNextBundle() keeps reporting the bundle it installed until\n' +
  '  // a boot confirms it - on a device the swap reloads the page before anything else\n' +
  '  // can look at it, but a slow or failed set() leaves this context running, and the\n' +
  '  // launch hand-over a second later must not mistake the bundle we just handed over\n' +
  '  // to for one that failed to take over (which would mark that release bad for ever).\n' +
  '  var HANDED_OVER_THIS_SESSION = null;\n' +
  '  function persistSheet(state){');

// The automatic install itself, right above the hand-over it uses.
sub('the automatic install exists',
  '  // Applies a staged bundle in place. set() reloads the WebView into the new',
  `  // ---- The boot install (64.2.9) ---------------------------------------------
  // "the ota update should automatically happen on boot no manually clicking
  // install." Every automatic path before this one stopped at the update SHEET:
  // the boot check found the newer version, wrote its notes into the card, and
  // waited for a tap on Download & install - so the update only ever arrived on a
  // phone whose owner pressed it. Nothing was missing except the step between
  // "found" and "fetching", which is this function.
  //
  // It runs ONLY from the boot check (the load event - the same "real launch" the
  // staged hand-over was pinned to in v58.9.1). The 3-hour timer and the
  // foreground resume still only OFFER the update: those are the checks that run
  // while the user is listening to something, and a hand-over there is the "the
  // app refreshes itself while I am using it" report that has to stay out.
  //
  // The hand-over is applyStagedNow() - the sheet's own Install now - so every
  // guard applies exactly as it does when the button is tapped: never older, never
  // a bundle that failed to start here before, nothing during a restart loop, the
  // one-attempt-per-version record, and the ledger written to disk before the
  // swap. With the force flag off, a track that is playing defers to app-close
  // instead of being cut off, and that deferral does not burn the attempt.
  async function autoInstall(Updater, man, o){
    if(!Updater || !man || !man.version || !man.url) return null;
    var version = String(man.version);
    if(isBadVersion(version)){ log('v' + version + ' failed to start here before - not fetching it automatically'); return null; }
    if(bootLooping()){ log('boot loop detected - not installing anything this session'); return null; }
    if(autoHandledAlready(version)){ markBadVersion(version, 'auto-installed once without taking over'); return null; }
    var seenKey = INSTALL_PROMPT_SEEN + version;
    try{
      persistSheet({ version: version, notes: man.notes || [], size: man.size || 0, date: man.date || '', phase: 'downloading', startedAt: Date.now() });
      showSheet({ phase: 'downloading', version: version, date: man.date || '', notes: man.notes, showProgress: true,
        onNow: function(){}, onLater: function(){ try{ localStorage.setItem(seenKey, '1'); }catch(e){} hideSheet(); toast('Update will continue in the background.', 3000); } });
      sheetProgress(0, 'starting');
      var bundle = await downloadWithProgress(Updater, man);
      if(!bundle || !bundle.id){ log('the download returned no bundle'); sheetMsg('The update could not be fetched - it will be offered again on the next launch.', 0); return null; }
      await Updater.next({ id: bundle.id });
      try{ localStorage.setItem(LS_KEY, JSON.stringify({ version: version, at: Date.now() })); }catch(_e){}
      log('staged ' + version + ' (id ' + bundle.id + ') from the boot check');
      persistSheet({ version: version, notes: man.notes || [], size: man.size || 0, date: man.date || '', phase: 'staged', stagedAt: Date.now() });
      var nb = { id: bundle.id, version: version };
      // "Install later" was picked for this version: fetch it, install it when the
      // app closes, and never re-offer it in the sheet. That choice still means
      // no tap; it just means "not in front of me right now".
      if(wantDeferredInstall(version)){ applyInBackground(Updater, nb); return man; }
      // Now. A track that is playing defers to app-close inside applyStagedNow()
      // and says so with the same toast the sheet's own Install now uses.
      applyStagedNow(Updater, nb);
      return man;
    }catch(e){
      log('the automatic install failed: ' + ((e && e.message) || e));
      sheetMsg('The update could not be fetched - it will be offered again on the next launch.', 5000);
      return null;
    }
  }

  // Applies a staged bundle in place. set() reloads the WebView into the new`);

// Remember the hand-over for the rest of this launch (see the declaration above).
sub('a completed hand-over is recorded for this launch',
  '    markAutoHandled(String(nb.version || \'\'));\n    clearInstallDelay(Updater);',
  '    markAutoHandled(String(nb.version || \'\'));\n    HANDED_OVER_THIS_SESSION = String(nb.version || \'\');\n    clearInstallDelay(Updater);');

// The boot check IS the install now, and it waits for a page that has really
// booted instead of firing into one that has not (a check against a page that has
// not booted returned nothing at all, silently, on a slow cold start).
sub('the boot check asks for the automatic install',
  "    setTimeout(function(){ if(document.visibilityState !== 'hidden') checkForUpdate({ silent: true }); }, 2500);",
  `    // The boot check installs the update by itself now. It waits for the app to have
    // really booted - window.toast is the app's own early global - and runs ONCE. The
    // 3-hour timer and the foreground resume below are left exactly as they were.
    var _bootCheckTries = 0;
    (function bootCheck(){
      if(!appBooted() && ++_bootCheckTries < 20){ setTimeout(bootCheck, 1000); return; }
      if(document.visibilityState === 'hidden') return;
      checkForUpdate({ silent: true, auto: true });
    })();`);

// ONE edit, not two. Both blocks go in front of the same line, and a step that
// inserts text before a needle another step is anchored on breaks that step's
// "already applied" marker on the next run - which is how this patch briefly
// duplicated its own insert on its second run. The marker is now the line the two
// blocks are recognised by, and nothing is inserted between the marker and it.
sub('a boot check installs a staged bundle, and never re-offers it',
  '          var applied = applyInBackground(Updater, nb); // \'immediate\' = apply started now',
  `          // A boot check hands an already-staged bundle over here, by the same
          // one-attempt-per-bundle rule the launch path uses (installStagedOnBoot):
          // a bundle waiting at launch is the normal state after a fetch on the
          // previous launch, and waiting for another close/reopen cycle was the
          // "the update never installs by itself" half of the report.
          if(o.auto && installStagedOnBoot(Updater, nb)) return man;
          // The bundle this launch already handed over to: the app is reloading
          // into it, so there is nothing to offer, nothing to stage and nothing to
          // mark. Without this, a non-automatic check a moment later (the app runs
          // one of its own) found the same bundle still staged, painted a fresh
          // "staged, Install now" card for a version that was already mid-swap, and
          // marked it as one that failed to take over - the confusing half-installed
          // state this release exists to remove.
          if(HANDED_OVER_THIS_SESSION && String(nb.version) === HANDED_OVER_THIS_SESSION){
            log('v' + nb.version + ' was handed over on this launch already');
            return man;
          }
          var applied = applyInBackground(Updater, nb); // 'immediate' = apply started now`,
  1, 'if(o.auto && installStagedOnBoot(Updater, nb)) return man;');

sub('a check that is not the boot one still only offers the update',
  '      return await promptAndInstall(Updater, man, o);',
  `      // A boot check installs by itself; every other check offers (the sheet with
      // its Install now / Install later buttons), which is what it always did.
      return await (o.auto ? autoInstall(Updater, man, o) : promptAndInstall(Updater, man, o));`);

// The launch hand-over must not look at a bundle this launch already installed.
sub('the launch hand-over leaves a bundle installed on this launch alone',
  '              var bootApplyKey = BOOTAPPLY_KEY + nb.version;',
  `              // A bundle already handed over on THIS launch (the boot check
              // installs by itself now) must not be looked at again here:
              // getNextBundle() still reports it, this is the same session, and the
              // "handled once" rule below would mark a bundle that is mid-swap as
              // failed - refusing that release for ever. On a device the swap has
              // already reloaded the page; this is the guard for a slow set().
              if(HANDED_OVER_THIS_SESSION && String(nb.version) === HANDED_OVER_THIS_SESSION){
                log('v' + nb.version + ' was handed over on this launch already');
                return;
              }
              var bootApplyKey = BOOTAPPLY_KEY + nb.version;`);

save();

// ═══════════════════════════════════════════════════════════════════════════
// E - the gates that pinned the old shape move with it
// ═══════════════════════════════════════════════════════════════════════════
// Same rule as every release since 64.2.3. Neither edit adds or removes a check:
// dev/test-66428.mjs keeps its 73.
function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  for (const [label, oldStr, newStr, marker] of pairs) {
    const m = marker === undefined ? newStr : marker;
    if (m !== '' && s.indexOf(m) !== -1) { skip(rel + ': ' + label); continue; }
    const got = s.split(oldStr).length - 1;
    if (newStr === '' && marker === undefined && got === 0) { skip(rel + ': ' + label); continue; }
    if (got !== 1) throw new Error(rel + ' - ' + label + ': found ' + got + ' occurrence(s), want 1');
    s = s.split(oldStr).join(newStr);
    done(rel + ': ' + label);
  }
  fs.writeFileSync(p, s);
}

fileSub('dev/ota-loop-check.cjs', [
  ['the stale-record loop is tested without a newer published bundle in it',
    '    const w = boot({ manifestVersion: NEXT_VERSION, stagedVersion: APP_VERSION, localStorage: ls });',
    `    // The manifest is the RUNNING version here on purpose (64.2.9): a genuinely
    // newer published bundle installs itself on launch now - that is the feature -
    // so the stale-record hazard has to be tested without one in the mix. What is
    // left is exactly the report this scenario models: a queued record for the
    // version that is already running.
    const w = boot({ manifestVersion: APP_VERSION, stagedVersion: APP_VERSION, localStorage: ls });`],
]);

fileSub('dev/test-66428.mjs', [
  ['the words this gate was written about are read from its own release',
    `    ok(/\\bthings to know\\b/i.test(notes), 'while naming the list it changed');`,
    `    // The list this entry names is 64.2.8's, and the head entry belongs to
    // whatever shipped last: the words THIS gate was written about are read from
    // the release it describes, by version - the same rule dev/test-66423.mjs,
    // dev/test-66424.mjs and dev/test-66427.mjs already follow.
    const entry6428 = entries.find((e) => /^64\\.2\\.8$/.test(String(e.version))) || {};
    const notes6428 = (entry6428.items || []).join('\\n');
    ok(/\\bthings to know\\b/i.test(notes6428), 'while naming the list it changed');`],
  ['and so is the note that names the line',
    `    ok(head.items[0].indexOf("phone's media player") !== -1, 'the first note names the line that went');`,
    `    ok((entry6428.items || [])[0].indexOf("phone's media player") !== -1, 'the first note names the line that went');`],
]);

// ═══════════════════════════════════════════════════════════════════════════
// E2 - the OTA end-to-end gate describes the new boot behaviour
// ═══════════════════════════════════════════════════════════════════════════
// dev/ota-update-check.cjs drives the real client through a simulated native
// bridge: a manifest one version ahead, a real download, a real next(), a real
// set(). It used to pin the shape where the boot check offered the update and the
// gate pressed the button - the behaviour this release is replacing - so it moves
// with it. The section that replaced it asserts the same facts about the same
// client without a tap, and the fetch is held open by the native stub so the
// state a user watches while it runs (the notes, the version, the progress bar,
// no button) can be read off the page instead of inferred afterwards.
const OLD_BOOT = `  // Boot wiring fires 4s after load, then the auto-check 2.5s later.
  await wait(8000);
  console.log('\\n${EM} boot ${EM}');
  ok('the bundle confirms it booted (notifyAppReady), so Capgo cannot roll it back',
     calls.notifyAppReady >= 1, 'calls=' + calls.notifyAppReady);
  ok('a newer version is offered on screen', sheetVisible(), JSON.stringify(sheetText().slice(0, 80)));
  ok('the sheet carries the real patch notes', sheetText().indexOf('holding one down') !== -1, JSON.stringify(sheetText().slice(0, 120)));
  ok('the sheet names the new version', sheetText().indexOf(NEXT_VERSION) !== -1, JSON.stringify(sheetText().slice(0, 80)));

  console.log('\\n${EM} install now: download, stage, apply ${EM}');
  const now = btn('scOtaNow');
  ok('an Install/Download button is present', !!now);
  now.click();
  await wait(1500);
  ok('the bundle was downloaded', calls.downloads.length >= 1, JSON.stringify(calls.downloads));
  const first = calls.downloads[0] || {};
  ok('it downloaded from raw.githubusercontent (no CDN cache) first',
     String(first.url || '').indexOf('raw.githubusercontent.com') !== -1, String(first.url || ''));
  ok('it requested the new version', String(first.version) === NEXT_VERSION, JSON.stringify(first));
  ok('the download was staged with next()', calls.next.length === 1, JSON.stringify(calls.next));
  ok('the sheet switches to a staged state', sheetText().indexOf('Install now') !== -1 || sheetText().indexOf('ready') !== -1, JSON.stringify(sheetText().slice(0, 80)));
  const stagedBtn = btn('scOtaNow');
  if (stagedBtn) stagedBtn.click();
  await wait(1200);
  ok('applying calls set() with the staged bundle', calls.set.length === 1, JSON.stringify(calls.set));`;
const NEW_BOOT = `  // The boot check fires ~2.5s after load and INSTALLS by itself (64.2.9): the
  // newer build is fetched, staged with next() and handed over with set(), and no
  // tap happens anywhere in the path. The fetch is held open by the native stub
  // (see holdDownload) so that the state a user actually watches while it runs can
  // be read off the page instead of inferred from what is on screen afterwards.
  console.log('\\n${EM} boot: the update installs itself, no tap ${EM}');
  await wait(3300);
  ok('the bundle confirms it booted (notifyAppReady), so Capgo cannot roll it back',
     calls.notifyAppReady >= 1, 'calls=' + calls.notifyAppReady);
  ok('the boot check fetches the new version with no tap', calls.downloads.length === 1,
     JSON.stringify(calls.downloads.map((d) => d.version)));
  ok('the sheet is on screen while it fetches', sheetVisible(), JSON.stringify(sheetText().slice(0, 60)));
  ok('it carries the real patch notes', sheetText().indexOf('holding one down') !== -1, JSON.stringify(sheetText().slice(0, 120)));
  ok('and names the new version', sheetText().indexOf(NEXT_VERSION) !== -1, JSON.stringify(sheetText().slice(0, 80)));
  ok('with no Install button to press', !btn('scOtaNow') || btn('scOtaNow').style.display === 'none',
     btn('scOtaNow') ? btn('scOtaNow').style.display : 'missing');
  const first = calls.downloads[0] || {};
  ok('it fetched from raw.githubusercontent (no CDN cache) first',
     String(first.url || '').indexOf('raw.githubusercontent.com') !== -1, String(first.url || ''));
  ok('it requested the new version', String(first.version) === NEXT_VERSION, JSON.stringify(first));
  releaseDownload();
  await wait(2500);
  ok('the fetched bundle was staged with next()', calls.next.length === 1, JSON.stringify(calls.next));
  ok('and hands the app over to it with no tap', calls.set.length === 1, JSON.stringify(calls.set));
  ok('the sheet says it is installing instead of going silent',
     /Installing/i.test(sheetText()), JSON.stringify(sheetText().slice(-70)));
  // The launch hand-over runs at 4s, and getNextBundle() still reports the bundle
  // that was just installed: it has to leave it alone (one set() for this launch)
  // and must not mark a bundle that is mid-swap as one that failed to take over.
  ok('the launch hand-over leaves the bundle it already installed alone', calls.set.length === 1, JSON.stringify(calls.set));
  ok('and that bundle is not marked as a failure',
     !win.localStorage.getItem('sidecut_ota_bad_' + NEXT_VERSION),
     String(win.localStorage.getItem('sidecut_ota_bad_' + NEXT_VERSION)));`;
fileSub('dev/ota-update-check.cjs', [
  ['the native stub can hold a fetch open',
    'let downloadFails = false;\n',
    'let downloadFails = false;\n' +
    '// Held open on request, so the automatic install can be asserted while it is\n' +
    '// still fetching - the one moment the notes and the progress bar are on screen\n' +
    '// and there is no button to press.\n' +
    'let holdDownload = false;\n' +
    'let releaseDownload = () => {};\n'],
  ['the gate gets a realistic next version',
    `const NEXT_VERSION = (() => {
  const m = String(APP_VERSION || '0').match(/^(\\d+)\\.(\\d+)$/);
  return m ? (m[1] + '.' + (Number(m[2]) + 1)) : '99.9';
})();`,
    `// Bumps the LAST segment, so a three-part app version (64.2.9) is followed by a
// realistic next release (64.2.10) instead of falling through to the placeholder.
const NEXT_VERSION = (() => {
  const parts = String(APP_VERSION || '0').split('.');
  if (!parts.length || !/^\\d+$/.test(parts[parts.length - 1])) return '99.9';
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
  return parts.join('.');
})();`],
  ['the download can be held open',
    `    download(opts) {
      lastDownloadVersion = opts && opts.version;
      calls.downloads.push({ url: opts && opts.url, version: opts && opts.version });
      if (downloadFails) return Promise.reject(new Error('network down'));
      return Promise.resolve({ id: 'bundle-' + String(opts && opts.version), version: String(opts && opts.version) });
    },`,
    `    download(opts) {
      lastDownloadVersion = opts && opts.version;
      calls.downloads.push({ url: opts && opts.url, version: opts && opts.version });
      if (downloadFails) return Promise.reject(new Error('network down'));
      const bundle = { id: 'bundle-' + String(opts && opts.version), version: String(opts && opts.version) };
      if (holdDownload) { holdDownload = false; return new Promise((r) => { releaseDownload = () => r(bundle); }); }
      return Promise.resolve(bundle);
    },`],
  ['the first fetch is held open before the page boots',
    '(async () => {\n  const win = dom.window;\n  await wait(2000);',
    'holdDownload = true;\n\n(async () => {\n  const win = dom.window;\n  await wait(2000);'],
  ['the boot section describes the install it now performs', OLD_BOOT, NEW_BOOT],
]);

// ═══════════════════════════════════════════════════════════════════════════
// F - the version pins across the suite
// ═══════════════════════════════════════════════════════════════════════════
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  [OLD_VER + " heads the changelog", VER + " heads the changelog"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs', 'test-66429.mjs']);
let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}
console.log('patch-66429: ' + repinned + ' version repin(s) across dev/test-*.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// verification - every claim above, checked against what was just written
// ═══════════════════════════════════════════════════════════════════════════
const final = fs.readFileSync(FILE, 'utf8');
const otaFinal = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const problems = [];
function must(cond, what) { if (!cond) problems.push(what); }
const has = (needle) => final.indexOf(needle) !== -1;
const count = (needle) => final.split(needle).length - 1;
const slice = (from, to) => {
  const a = final.indexOf(from);
  const b = final.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return final.slice(a, b);
};

// 1 - the backdrop
{
  const drift = slice('@keyframes sd-dyn-drift{', '/* 64.2.7: the sd-dyn-hue keyframes');
  must(drift !== '', 'the drift keyframes are still on the page');
  must(drift.indexOf('scale(') === -1, 'no frame of the drift scales the layer any more');
  must(drift.indexOf('rotate(') === -1, 'and no frame rotates it');
  const rev = slice('@keyframes sd-dyn-drift-rev{', '@keyframes sd-dyn-sheen{');
  must(rev !== '', 'the counter-moving layer is still on the page');
  must(rev.indexOf('scale(') === -1 && rev.indexOf('rotate(') === -1, 'and it is translation only too');
  must((rev.match(/opacity:/g) || []).length === 5, 'while keeping its opacity cycle');
  must(count('animation: sd-dyn-drift ') === 13, 'all 13 dynamic themes still drift (' + count('animation: sd-dyn-drift ') + ')');
  must(!has('@keyframes sd-dyn-hue{'), 'and 64.2.7\'s filter is still gone');
  must(count('inset:-32%') === 0, 'the oversized backdrop inset is gone');
  must(count('inset:-26%') === 0, 'and the counter-layer one');
  must(count('inset:-20%') === 2 && count('inset:-18%') === 1,
    'both layers come in to -20% / -18% (' + count('inset:-20%') + ' / ' + count('inset:-18%') + ')');
  must(has('body[class*="theme-dyn-"]::after{'), 'the counter-layer is still there');
  must(has('body[class*="theme-dyn-"] .home-bubble .hb-glow{ animation: sd-glow-pulse 6s ease-in-out infinite; }'),
    'and the corner glow still pulses');
}

// 2 - the Home card
{
  const a = final.indexOf('.home-bubble{');
  const bubble = a === -1 ? '' : final.slice(a, final.indexOf('.home-bubble:active{', a));
  must(/contain:\s*paint;/.test(bubble), 'a Home card declares paint containment');
  must(bubble.indexOf('overflow:hidden') !== -1 && bubble.indexOf('border-radius:22px') !== -1,
    'and still clips its own rounded corner exactly as before');
  must(bubble.indexOf('position:relative') !== -1,    'and is still its children\' containing block');
}

// 3 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
{
  const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (block) {
    let entries = null;
    try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
    if (entries) {
      const head = entries[0];
      must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
      must(head.date === STAMP, 'stamped ' + STAMP + ' (' + head.date + ')');
      must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
      const notes = (head.items || []).join('\n');
      must((head.items || []).every((it) => it.length <= 260),
        'every note is short (longest ' + Math.max(...(head.items || ['']).map((i) => i.length)) + ' chars)');
      must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
      must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
      must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
      must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes),
        'nor carry a term the wider store list knows');
      must(/rollback/i.test(notes), 'while still saying what this release left alone');
      must(/blank/i.test(notes), 'the word dev/test-66425 reads the head entry for is there (blank)');
      must(/list/i.test(notes) && /record/i.test(notes), 'and the two dev/test-66426 reads it for (list, record)');
      must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
      must(entries.some((e) => /^64\.2\.8$/.test(String(e.version))), 'and the release before it is still listed');
      must(entries.some((e) => /^64\.2\.7$/.test(String(e.version))), 'and so is the one before that');
    }
  } else {
    problems.push('the CHANGELOG block was not found');
  }
}
const swFinal = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

// 4 - the OTA client
{
  const hasOta = (n) => otaFinal.indexOf(n) !== -1;
  must(hasOta('async function autoInstall(Updater, man, o){'), 'the automatic install is in the client');
  must(hasOta('checkForUpdate({ silent: true, auto: true })'), 'and the boot check asks for it');
  must(hasOta("if(!appBooted() && ++_bootCheckTries < 20)"), 'the boot check waits for a page that booted');
  must(hasOta('(o.auto ? autoInstall(Updater, man, o) : promptAndInstall(Updater, man, o))'),
    'and no other check installs by itself');
  must(hasOta('if(o.auto && installStagedOnBoot(Updater, nb)) return man;'),
    'a bundle already staged at launch is handed over by the boot check');
  must(hasOta('var HANDED_OVER_THIS_SESSION = null;'), 'a hand-over is remembered for the launch');
  must((otaFinal.match(/HANDED_OVER_THIS_SESSION/g) || []).length >= 3,
    'and read wherever the launch decides (' + (otaFinal.match(/HANDED_OVER_THIS_SESSION/g) || []).length + ')');
  must(hasOta("if(HANDED_OVER_THIS_SESSION && String(nb.version) === HANDED_OVER_THIS_SESSION){"),
    'so the launch hand-over skips the bundle this launch installed');
  must((otaFinal.match(/if\(HANDED_OVER_THIS_SESSION && String\(nb\.version\) === HANDED_OVER_THIS_SESSION\)\{/g) || []).length === 2,
    'and so does a later update check in the same session (' +
      (otaFinal.match(/if\(HANDED_OVER_THIS_SESSION && String\(nb\.version\) === HANDED_OVER_THIS_SESSION\)\{/g) || []).length + ')');
  const loopCheck = fs.readFileSync(path.join(ROOT, 'dev/ota-loop-check.cjs'), 'utf8');
  must(loopCheck.indexOf('const w = boot({ manifestVersion: APP_VERSION, stagedVersion: APP_VERSION, localStorage: ls });') !== -1,
    'the stale-record loop scenario is pinned to an up-to-date manifest');
  const autoBody = otaFinal.slice(otaFinal.indexOf('async function autoInstall(Updater, man, o){'));
  const autoFn = autoBody.slice(0, autoBody.indexOf('\n  }\n') + 4);
  must(autoFn.indexOf('isBadVersion(version)') !== -1 && autoFn.indexOf('bootLooping()') !== -1 &&
       autoFn.indexOf('autoHandledAlready(version)') !== -1,
    'the automatic install carries the same guards as the launch hand-over');
  must(autoFn.indexOf('applyStagedNow(Updater, nb)') !== -1 && autoFn.indexOf('applyStagedNow(Updater, nb, true)') === -1,
    'and hands over through the sheet\'s own path, with the force flag off');
  must(otaFinal.indexOf('function downloadWithProgress(Updater, man){') !== -1, 'the progress download is untouched');
  must(otaFinal.indexOf('function installStagedOnBoot(Updater, nb){') !== -1, 'and so is the launch hand-over');
}

// 5 - the gates moved with it, without losing a check
{
  const t28 = fs.readFileSync(path.join(ROOT, 'dev/test-66428.mjs'), 'utf8');
  must(t28.indexOf("const entry6428 = entries.find((e) => /^64\\.2\\.8$/.test(String(e.version))) || {};") !== -1,
    'dev/test-66428 reads the release it describes by version');
  must(t28.indexOf("ok(/\\bthings to know\\b/i.test(notes6428)") !== -1, 'for the words it was written about');
  must(t28.indexOf("ok(/\\bthings to know\\b/i.test(notes)") === -1, 'and no longer demands them of the head entry');
  must(t28.indexOf('(entry6428.items || [])[0].indexOf("phone\'s media player")') !== -1,
    'and its note that names the line is read from its own release too');
  const checksIn = (p) => (fs.readFileSync(path.join(ROOT, p), 'utf8').match(/(^|\n)\s+ok\(/g) || []).length;
  must(checksIn('dev/test-66428.mjs') === 73, 'dev/test-66428 still declares its 73 checks (' + checksIn('dev/test-66428.mjs') + ')');
  const t29 = fs.readFileSync(path.join(ROOT, 'dev/test-66429.mjs'), 'utf8');
  must(t29.indexOf("const VER = '64.2.9';") !== -1, 'the new gate is pinned to this release');
  must((t29.match(/(^|\n)\s+ok\(/g) || []).length >= 45,
    'and it carries the release\' own checks (' + (t29.match(/(^|\n)\s+ok\(/g) || []).length + ')');
}

if (problems.length) {
  console.error('\npatch-66429: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66429: all verification checks passed (' + edits + ' edit(s))');
