#!/usr/bin/env node
/**
 * SideCut 71.3b - the PRO tags come off the Sandbox panel.
 *
 * The user's words: "On sandbox remove the pro tags".
 *
 * 70.1.3 removed the last entitlement (see the note at applySandboxStyles:
 * "Nothing is PRO any more") and the panel's own description says so out loud -
 * "Every switch in Sandbox is on for everyone ... the line that used to divide
 * this list in two was the paywall, and it is gone." What it left behind were the
 * twelve little gold PRO badges in the markup, still telling every reader that
 * half the list is held back. They are the last thing on the panel that is not
 * true, so they come off.
 *
 * This is a follow-up to dev/patch-713.mjs rather than an edit inside it, because
 * that script short-circuits on a tree already carrying APP_VERSION 71.3 - which
 * is exactly the tree this runs on. The shape is the repo's own:
 * dev/patch-6055b.mjs / patch-6055c.mjs did the same for 60.5.5.
 *
 * The badge is one exact string, repeated twelve times, and all twelve are in the
 * settings panel (nowhere else in the app draws it). Removing it takes the whole
 * span and the space before it, leaving the label exactly as it reads without a
 * badge. Idempotence keys on the RESULT - "Compact now bar </span>" is absent
 * before the removal and present after it, which is the only text a removal can
 * key on.
 *
 * A seventh note joins the 71.3 changelog entry. It stays past the first six, so
 * it is not one of the notes copied into ota-play/updates.json - the Play bundle
 * does not need to describe this panel - but it is written Play-clean anyway.
 *
 *   node dev/patch-713b.mjs
 *   node dev/patch-713b.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const CHECK = process.argv.includes('--check');

const BADGE = '<span style="font-size:10px;color:var(--gold);font-weight:600;vertical-align:super;">PRO</span>';
const RESULT_KEY = 'Compact now bar </span>';

const NOTE6 = 'A library saved before this release comes back the same, and a song that was already in it is untouched. Nothing here rewrites a stored track or its cover, and nothing is lost if a run is stopped part way.';
const NOTE7 = 'The Sandbox panel no longer carries a PRO label anywhere. Every switch in it has been open to everyone for a while and the gold tags that still said otherwise are gone, so the panel reads as what it is: a plain list of settings, nothing held back and nothing to unlock.';

const problems = [];
let applied = 0, already = 0;
const count = (h, n) => h.split(n).length - 1;

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const html = { text: fs.readFileSync(IDX, 'utf8') };

if(CHECK && count(html.text, RESULT_KEY) >= 1){
  console.log('patch-713b: the Sandbox PRO tags are already gone - nothing to apply');
  process.exit(0);
}

// 1. Every PRO badge comes off. One exact string, twelve times, all in the panel,
// and only the span itself is dropped - the space before it stays, so the label
// reads "Compact now bar " and RESULT_KEY is the text that proves it ran.
sub(html, 'the Sandbox PRO badges come off', BADGE, '', { all: true, key: RESULT_KEY });

// 2. The release says so.
sub(html, 'the 71.3 notes mention the panel',
  "    '" + NOTE6 + "',\n  ] },\n",
  "    '" + NOTE6 + "',\n    '" + NOTE7 + "',\n  ] },\n",
  { key: 'no longer carries a PRO label' });

const left = count(html.text, BADGE);
if(left !== 0) problems.push(left + ' PRO badge(s) survived');

if(!CHECK) fs.writeFileSync(IDX, html.text);

console.log('patch-713b: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-713b: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
