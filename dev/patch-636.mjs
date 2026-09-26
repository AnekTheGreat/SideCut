#!/usr/bin/env node
// SideCut — 63.0.5: the reported batch. Ten reports, two sittings, one release:
// the Singles play button, the blank Album History covers, the total-time bubble,
// the wrong lyrics, the Gemini "expired key", the Library boot view, PRO access
// for free users, boot time, the seizure warning and the un-read tutorial.
//
//   * APP_VERSION moves 63.0.4 → 63.0.5. A step inside the 63 line the phone is
//     on; a jump past it (v64) still needs the user's say-so.
//   * sw.js's CACHE_NAME moves 63.0.5 → 63.0.6 — its own number, decoupled from
//     APP_VERSION (dev/patch-623.mjs): it is a cache-buster.
//   * The head CHANGELOG entry is NEW; the 63.0.4 entry stays below it.
//
// SIX items, on purpose. The OTA channel carries only the FIRST SIX items of the
// head entry (`.slice(0, 6)` in dev/ota-bundle.mjs and its two siblings), so an
// entry written as twelve would have shipped an update that silently said nothing
// about its last six fixes. The reports are therefore folded into the six notes a
// user actually receives; the full detail of each stays in this file's header.
//
// The entry text carries REAL characters — an em dash and the 📀 — and only the
// apostrophes that are genuine escapes use \u2019 written here as \\u2019, because
// this is a template literal: a single backslash would be eaten by the template
// and the note would render as the literal text "\u2019". Verified after building
// by reading the rendered notes in ota/updates.json.
//
//   node dev/patch-636.mjs              # version + changelog + sw.js + repins
//   node dev/patch-636.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.5';
const OLD_VER = '63.0.4';
const STAMP = 'September 26, 2026 · 11:31 AM EDT';
const OLD_STAMP = 'September 26, 2026 · 10:21 AM EDT';
const SW_CACHE = '63.0.6';
const OLD_SW_CACHE = '63.0.5';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'Every covered report: the play button that should not be there, the covers nothing had, the bubble for a cut-off time, lyrics that were never yours, and the key that was blamed for the wrong thing', items: [
    'Singles has no play button on a row. The ▶ that was reported was still being drawn by a second renderer — the ↻ / ⚡ per-artist refetch redraws a group through its own function, and that one still put a button on every row, which is what a saved list then kept. Both renderers are the same now, and a list saved by an older build is cleaned of it the moment it opens. Tapping the row opens the song, exactly like a track inside an album.',
    'The covers nothing had a picture for show up now. “Smile”, “Ishq Ho Gaya” and “Ishq Da Uda Ada” by Diljit Dosanjh have no album entry in Apple\\u2019s store at all — in the US storefront or the Indian one — so the one place that looked for artwork had nothing it could ever find. The lookup now asks Deezer, which carries that catalogue, and then MusicBrainz\\u2019s release group, whose front cover the Cover Art Archive serves; all three were checked live against those exact albums. Only a cover matching both the artist and the album is used — a same-titled album by someone else is refused, because a stranger\\u2019s cover is worse than a blank. And it runs at last: that lookup had exactly one caller, and it fired once while the app was still starting up, when the album list did not exist yet — so it had never run over a real row, and an album stored without artwork could only stay blank for good. It now runs every time the list is drawn, a fresh one or one reopened from its saved copy, and a cover it finds is remembered.',
    'The total time answers a tap even when the line is not cut off. The bubble was wired only on a line measured as too narrow, so a slightly wider line — or one that only just fits — silently ignored the tap. Every row answers now, and tapping it is no longer swallowed by the panel\\u2019s own scroll a moment after it opens.',
    'Lyrics can no longer be somebody else\\u2019s. A song was accepted when its title matched exactly and its length was within two seconds even when the artist was a stranger — which is how BK\\u2019s “LIFESTYLE” was answered with twenty matches headed by Jason Derulo and LISA. An entry filed under a real other artist is refused and counted instead, and when nothing is left the panel says no lyrics were found for that artist and that song, naming how many same-titled songs by other artists were skipped. The hand-search box still lists what it finds — that is what you asked it for — but a stranger is removed from that list too, so it can never be a menu of other people\\u2019s songs.',
    'The Gemini key is no longer blamed for the wrong thing, and pasting it works. “API model not found — your Gemini key may be expired” was a guess: a 404 means this key cannot see this model, not that the key is dead, and the app sent you off to make a new one. It now asks the API which models the key can actually use and retries with one of those, remembers the model that worked, and every error quotes what the API said instead of inventing a cause. “Clipboard access denied” was the WebView refusing the browser clipboard API: the paste button tries the app\\u2019s own clipboard first, then the browser one, then the older path, and if none can be read it puts the cursor in the field and says so — long-press and Paste always works.',
    'Playlists is the Library\\u2019s default view, PRO stays PRO, the first launch has to be read, and starting up is quicker. The Library opens on Playlists, and only the PRO “Default view on boot” setting can move it to Albums — so a free user lands on Playlists whatever a restored backup or an older unlock left in storage, and that dropdown now reads as locked instead of moving under the tap and then discarding the choice. Free users get no PRO effects at all: the PRO settings were still read out of storage and applied on every start with no unlock check anywhere, so a lapsed subscription, a restored backup or a row left by an older build could leave you wearing them — the whole PRO set is now gated where it is painted, including the now-bar size and the scroll speed. A brand new install opens the guide with the full seizure warning at the very top — the flashing themes, the RGB modes, what to turn off, and when to stop and see a doctor — and it can no longer be dismissed by tapping outside it: the button only unlocks once the panel is scrolled to the bottom, on that first showing only, with Replay tutorial and every other popup unchanged. And boot is shorter: the two independent metadata reads the app awaits on every launch ran one after the other, so it waited for two round trips to the same store for no reason — they run together now, each keeping its own guard.',
  ] },
`;

let src = MANIFEST_ONLY ? '' : fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// The changelog head, self-healing: an entry already there is replaced outright
// rather than skipped, so a rerun after a fix to the text corrects it instead of
// leaving a wrong one in place.
function headEntry(){
  const headMark = 'const CHANGELOG = [\n';
  const entryMark = "  { version: '" + VER + "',";
  const endMark = '\n  ] },\n';
  const at = src.indexOf(entryMark);
  if(at === -1){
    sub('CHANGELOG head entry', headMark, headMark + ENTRY, 1, entryMark);
    return;
  }
  const end = src.indexOf(endMark, at);
  if(end === -1) throw new Error('CHANGELOG: no end for the ' + VER + ' entry');
  const existing = src.slice(at, end + endMark.length);
  if(existing === ENTRY) return skip('CHANGELOG head entry');
  src = src.slice(0, at) + ENTRY + src.slice(end + endMark.length);
  done('CHANGELOG head entry (replaced)');
}

if (!MANIFEST_ONLY) {
  sub('APP_VERSION',
    "  const APP_VERSION = '" + OLD_VER + "';",
    "  const APP_VERSION = '" + VER + "';",
    1, "const APP_VERSION = '" + VER + "';");

  headEntry();

  fs.writeFileSync(FILE, src);

  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
  if (sw.includes(newSw)) {
    console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
  } else {
    const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
  }

  const REPINS = [
    ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
    ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
    ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
    ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
    ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"],
    ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"]
  ];

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (a === b || t.indexOf(a) === -1) continue;
      repinned += t.split(a).length - 1;
      t = t.split(a).join(b);
      console.log('  ' + name + ' — ' + a.slice(0, 52));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-636: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-636 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
