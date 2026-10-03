#!/usr/bin/env node
/**
 * 71.4 - Studio that answers, an edit rack, a week of releases, letters that
 * flow, and a Donate pane that only offers what the copy can take.
 *
 * The user's two asks in one release, each pinned where the code actually lives
 * rather than by grepping for a phrase:
 *
 *   [1] release metadata  - APP_VERSION, the head entry and the shell cache;
 *   [2] the Studio buttons - the working song, the wrapper, the scoping;
 *   [3] the edit rack     - the real sample math, the preview and the save;
 *   [4] a week is the floor - the split, the count line and the heading;
 *   [5] letter by letter  - the mode, the wave, and every-song highlight;
 *   [6] the Donate pane   - only the amounts this copy can really take.
 *
 *   node dev/test-714.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '72.8'; /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */ /* repinned by dev/repin-715.mjs */ /* repinned by dev/repin-714.mjs */
const PREV = '72.7.1'; /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */ /* repinned by dev/repin-715.mjs */
const SHELL_CACHE = 'sidecut-shell-v72.8';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

// The Studio module's own block, so a check about Studio cannot accidentally
// match something in the app's own two scripts.
const STUDIO_AT = src.indexOf('<script id="sc-studio-70">');
const studio = STUDIO_AT === -1 ? '' : src.slice(STUDIO_AT);

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok((head.items || []).length >= 6, 'with at least six notes (' + (head.items || []).length + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next');
    const notes = (head.items || []).join('\n');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'and the notes name a surface this app really has');
    ok((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    // The first six ride to the store channel verbatim, so nothing about the
    // copy-specific tip routing may be inside them.
    ok((head.items || []).length > 6, 'there is a note past the six that ride to the store (' + (head.items || []).length + ')');
    ok(!/stripe/i.test((head.items || []).slice(0, 6).join('\n')),
      'and the card-page routing is deliberately past that cut');
  }
  const cache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1];
  ok(cache === SHELL_CACHE, 'the shell cache moved with the release (' + cache + ')');
  ok(cache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + cache + ')');
}

console.log('\n[2] every Studio button answers, on a song of your choosing');
{
  ok(studio.length > 1000, 'the Studio block is on the page');
  // ---- one working song, and a way to point it anywhere ----
  ok(count(studio, 'function workTrack(){') === 1, 'Studio has a working song of its own');
  ok(studio.indexOf('if(studioPickId){ var picked = trackById(studioPickId); if(picked) return picked; }') !== -1,
    'a song you picked wins');
  ok(studio.indexOf('var playing = currentTrack();') !== -1, 'then whatever is playing');
  ok(studio.indexOf('return all.length ? all[0] : null;') !== -1,
    'and only then the first song in the library, so a tool always has a song');
  ok(count(studio, 'function pickSong(id){') === 1, 'a pick is remembered');
  ok(studio.indexOf("lsSet('sidecut_studio_pick', id);") !== -1, 'across launches');
  ok(count(studio, 'function openSongPickerSheet(){') === 1, 'the picker exists');
  ok(studio.indexOf('id="scPickSearch"') !== -1 && studio.indexOf('class="sc-pick') !== -1, 'with a search box and a row per song');
  ok(count(studio, 'function playWorkTrack(){') === 1, 'and the working song can be played');
  ok(studio.indexOf("if(!call('__scPlayTrack', t.id))") !== -1, 'through the app’s own play-a-song path');
  // The app side of that hook keeps the playlist context.
  ok(count(src, 'window.__scPlayTrack = function(id){') === 1, 'the app publishes that hook once');
  ok(/window\.__scPlayTrack = function\(id\)\{[\s\S]{0,300}?playTrackInPlaylistContext\(id\);/.test(src),
    'and it plays in the song’s own playlist instead of dumping the library');
  // ---- every file tool reads it ----
  ok(studio.indexOf('data-act="choose"') !== -1, 'the header offers Choose song');
  ok(studio.indexOf('data-act="edit"') !== -1, 'and the edit rack');
  ok(studio.indexOf('data-act="playpick"') !== -1, 'and Play it');
  ok(/var t = workTrack\(\);\n    var s = stats\(\);/.test(studio), 'renderStudio paints the working song');
  ok(count(studio, "      if(act === 'loadsampler') loadSamplerFor(workTrack());") === 1, 'the sampler loads it');
  ok(count(studio, 'loadSamplerFor(workTrack()).then(function(){ openSamplerSheet(); })') === 1, 'and reloads it');
  ok(count(studio, 'workTrack() && workTrack().artUrl') === 1, 'the sampler sheet names it');
  ok(/function cropCurrent\(\)\{[\s\S]{0,220}?var t = workTrack\(\);/.test(studio), 'the cropper works on it');
  ok(/function openClipSheet\(preStart, preEnd\)\{[\s\S]{0,120}?var t = workTrack\(\);/.test(studio), 'and so does the clip maker');
  // ---- a tool that throws can no longer look unwired ----
  ok(studio.indexOf("toast('That tool could not open: '") !== -1, 'a tool card that fails says so');
  ok(studio.indexOf("toast('That tool could not answer: '") !== -1, 'and so does every other control');
  ok(/function openTool\(id\)\{[\s\S]{0,400}?try\{/.test(studio), 'the card dispatcher is wrapped');
  ok(/var act = b\.getAttribute\('data-act'\);[\s\S]{0,2400}?\}catch\(e\)\{ toast\('That tool could not answer: '/.test(studio),
    'and the whole action row with it');
  ok(studio.indexOf("toast('That tool is not in this build.');") !== -1, 'an unknown tool is named, not swallowed');
  // ---- the sheet's own controls are the sheet's own ----
  ok(count(studio, "document.querySelectorAll('#scSheetBody [data-clipnudge]')") === 1,
    'the clip nudge chips are found in the clip sheet');
  ok(count(studio, "document.querySelector('#scSheetBody [data-cliptrue]')") === 1, 'and so is Whole song');
  ok(count(studio, "document.querySelector('#scSheetBody [data-clipring]')") === 1, 'and the ringtone chip');
  ok(studio.indexOf("document.querySelectorAll('[data-clipnudge]')") === -1, 'nothing reaches for them document-wide');
  // ---- the surface the gates and the assistant drive ----
  ['workTrack: workTrack,', 'pickSong: pickSong,', 'openSongPickerSheet: openSongPickerSheet,',
   'playWorkTrack: playWorkTrack,', 'openEditSheet: openEditSheet,', 'editRender: editRender,',
   'editExport: editExport,', 'editPreview: editPreview,'].forEach((line) =>
    ok(studio.indexOf(line) !== -1, 'published: ' + line.split(':')[0]));
}

console.log('\n[3] the edit rack is real editing, on a copy');
{
  ok(count(studio, 'function openEditSheet(){') === 1, 'the edit rack exists');
  ok(count(studio, 'toolCard(\'edit\'') === 1, 'and has a card of its own');
  ok(count(studio, "if(id === 'edit') return openEditSheet();") === 1, 'the card opens it');
  ok(count(studio, 'function editRender(buf){') === 1, 'the render exists');
  // The five operations, each in the render itself.
  ok(studio.indexOf('if(edit.silent){') !== -1 && studio.indexOf('function editThreshold(buf){') !== -1,
    'it trims the silence off both ends, against the song’s own peak');
  ok(studio.indexOf('if(edit.fades){') !== -1 && studio.indexOf('edit.fadeIn * buf.sampleRate') !== -1, 'it fades in and out');
  ok(/d2\[i\] \*= i \/ fin;/.test(studio) && /d2\[n - 1 - i\] \*= i \/ fout;/.test(studio), 'with a real ramp, not a cut');
  ok(studio.indexOf('rev[i] = src[n - 1 - i];') !== -1, 'it reverses');
  ok(studio.indexOf('var g = edit.gainDb ? Math.pow(10, edit.gainDb / 20) : 1;') !== -1, 'it applies the chosen gain');
  ok(/if\(edit\.normalize && peak2 > 0\)\{[\s\S]{0,140}?var to = 0\.98 \/ peak2;/.test(studio),
    'and matches the level of the whole song, measured after the gain');
  ok(studio.indexOf('var out = cOut.createBuffer(ch, Math.max(1, n), buf.sampleRate);') !== -1, 'the result is a fresh buffer');
  ok(studio.indexOf('out.copyToChannel(chan[c], c);') !== -1, 'written channel by channel');
  // It previews what it will save, and saves a copy.
  ok(count(studio, 'function editPreview(){') === 1, 'it previews');
  ok(/var node = ctx\(\)\.createBufferSource\(\);[\s\S]{0,140}?node\.buffer = out;/.test(studio), 'playing the rendered audio itself');
  ok(count(studio, 'function editExport(){') === 1, 'and it saves');
  ok(/window\.__scEncodeMp3\(out, edit\.kbps, meta\)/.test(studio), 'encoding the edit at the chosen rate');
  ok(/window\.__scSaveClip\(blob, fname\);/.test(studio), 'through the app’s own save path');
  ok(studio.indexOf("var fname = base + ' (edit).mp3';") !== -1, 'under a name that says it is an edit');
  ok(studio.indexOf('meta.title = (t.name') === -1 && /tagMetaFor\(t, \(t\.name \|\| 'Edit'\) \+ ' \(edit\)'\)/.test(studio),
    'tagged as the edit, so the original keeps its own title');
  const exportFn = studio.slice(studio.indexOf('function editExport(){'), studio.indexOf('function editSheetHtml(){'));
  ok(exportFn.indexOf('__scPersistTrack') === -1, 'and nothing writes over the library copy');
  ok(exportFn.indexOf('t.file = newFile') === -1, 'not even by swapping the stored file, which the re-encode path does');
  ok(/done\(saved \? 'Edit saved/.test(studio), 'it says where the copy went');
  // The sheet itself: the controls are all there and all wired.
  ['[data-edit]', '[data-editgain]', '[data-editkbps]', "id=\"scEditPreview\"", "id=\"scEditSave\""].forEach((sel) =>
    ok(studio.indexOf(sel) !== -1, 'the rack offers ' + sel));
  ok(count(studio, "if(what === 'reverse') edit.reverse = !edit.reverse;") === 1, 'Reverse toggles the operation');
  ok(studio.indexOf('function editSummary(){') !== -1, 'and the card says what is armed');
}

console.log('\n[4] a release over a week old stays in the New Releases bubble');
{
  ok(count(src, 'window.__scRelWeekMs = 7 * 86400000;') === 1, 'a week is a named window');
  ok(count(src, 'window.__scRelIsRecent = function(dateStr){') === 1, 'and there is one way to ask');
  ok(/window\.__scRelIsRecent[\s\S]{0,320}?return \(Date\.now\(\) - t\) < window\.__scRelWeekMs;/.test(src),
    'which answers from the release date');
  ok(count(src, 'window.__scRelCountText = function(list, unseenCount){') === 1, 'the count line is one function');
  ok(src.indexOf("var txt = week + ' this week';") !== -1, 'and it opens with the week');
  ok(src.indexOf("if(older > 0) txt += ' \\u00b7 ' + older + ' earlier';") !== -1 || src.indexOf("' earlier'") !== -1,
    'then says how much came before');
  ok(src.indexOf("txt += ' \\u00b7 ' + n + ' recent release'") !== -1 || src.indexOf("' recent release'") !== -1,
    'and keeps the total, so older releases are visibly still in the bubble');
  ok(count(src, 'window.__scRelCountText(all, unseenCount)') === 2, 'the panel reads it, and so does the in-place repaint');
  ok(count(src, 'var countTxt = window.__scRelCountText(all, unseenCount);') === 1, 'the repaint through the same one function');
  // The heading that groups them, and the row attribute it is driven from.
  ok(count(src, "'Earlier than a week'") === 1, 'one heading names the older group');
  ok(count(src, "var _head = host.querySelector('#hbRelEarlier');") === 1, 'it is reused rather than re-added');
  ok(/host\.insertBefore\(_head, _older\[0\]\);/.test(src), 'and it is moved in front of the first older release');
  ok(/return !window\.__scRelIsRecent\(row\.getAttribute\('data-date'\)\);/.test(src), 'reading each row’s own date');
  ok(count(src, 'row.setAttribute(\'data-date\'') >= 1 || src.indexOf("row.setAttribute('data-date', String(r.date || '').slice(0, 10));") !== -1,
    'which every release row carries');
  ok(src.indexOf('_head.remove();') !== -1, 'and it goes away when nothing is that old');
  ok(count(src, '.hb-rel-earlier{') === 1, 'the heading has a style of its own');
}

console.log('\n[5] letter by letter, and a highlight that works on every song');
{
  ok(count(src, 'let lyricsLetterByLetter = false;') === 1, 'the third highlight is its own setting');
  ok(src.indexOf("dbGet('meta','lyricsLetterByLetter')") !== -1, 'kept like the word flag');
  ok(count(src, 'id="lyricsLetterBtn"') === 1, 'with a chip beside Word-by-word');
  ok(count(src, "lyricsLetterBtn').addEventListener('click'") === 1, 'and it is wired');
  ok(/if\(lyricsLetterByLetter\) lyricsWordByWord = true;/.test(src),
    'letter mode turns the word spans on, because it needs them');
  ok(/lyricsWordByWord = !lyricsWordByWord;[\s\S]{0,600}?if\(!lyricsWordByWord\) lyricsLetterByLetter = false;/.test(src),
    'and turning word mode off takes letter mode with it');
  // The wave itself.
  ok(count(src, 'function scEnsureLetterSpans(wordEl){') === 1, 'a word’s letters are wrapped once');
  ok(/style="transition-delay:' \+ \(i \* 26\) \+ 'ms"/.test(src), 'each letter carrying a growing transition delay');
  ok(count(src, 'function clearLetters(wordEl){') === 1, 'and a way to clear a run');
  ok(src.indexOf('if(lettersOn()){') !== -1 && count(src, 'function lettersOn(){') === 1, 'the pacing asks whether letter mode is on');
  ok(/scEnsureLetterSpans\(w\);[\s\S]{0,700}?const upto = Math\.max\(1, Math\.ceil\(frac \* ls\.length\)\);/.test(src),
    'and lights the letters up to the point the word has reached');
  ok(/for\(let li = 0; li < ls\.length; li\+\+\) ls\[li\]\.classList\.toggle\('lit', li < upto\);/.test(src), 'turning them on in order');
  ok(/if\(wi !== litIdx\)\{ clearLetters\(w\); return; \}/.test(src), 'while every other word is wiped back');
  ok(src.indexOf("words.forEach(clearLetters);") !== -1, 'and switching letter mode off clears the run');
  // The styles that make it read as a wave.
  ok(count(src, '#lyricsText .lyric-word .lyric-letter{') === 1, 'the letters have a transition');
  ok(count(src, '#lyricsText.ll-on .lyric-word.current .lyric-letter.lit{') === 1, 'and lit letters light');
  ok(src.indexOf("classList.toggle('ll-on', !!lyricsWordByWord && !!lyricsLetterByLetter)") !== -1, 'scoped to letter mode');
  // Every song, with or without timestamps, and with or without auto-scroll.
  ok(count(src, '        if (audio.duration > 0) {\n') === 1, 'the plain-lyrics branch runs on duration, not on the scroll switch');
  ok(count(src, 'if (lyricsAutoScroll && audio.duration > 0) {') === 0,
    'so turning auto-scroll off can no longer silence the highlight');
  ok(/if \(lyricsWordByWord && audio\.duration > 0 && allLines\[targetIdx\]/.test(src),
    'the unsynced pacing is still guarded by word mode alone');
  ok(src.indexOf('scrollLyricsToLine(container, allLines[targetIdx]);') !== -1,
    'and the scroll still has its own guard, so the picture is unchanged when it is on');
  // Both chips are offered whenever a song has lyrics.
  ok(count(src, "try{ $('lyricsLetterBtn').style.display = ''; }catch(_eShowLet){}") === 1,
    'the letter chip appears with the word chip, for every song');
  ok(count(src, 'if(window.__scLyricsHighlightChips) window.__scLyricsHighlightChips();') >= 2,
    'and both are painted from one place');
  // The setting rides in a saved file and back.
  ok(count(src, 'lyricsLetterByLetter: lyricsLetterByLetter,') === 1, 'the setting is exported');
  ok(count(src, 'manifest.settings.lyricsLetterByLetter !== undefined') === 1, 'and restored');
}

console.log('\n[6] the Donate pane offers only what this copy can take');
{
  ok(count(src, 'function donateUrlFor(amt){') === 1, 'the card page for an amount has one lookup');
  ok(count(src, 'function donateTierList(){') === 1, 'and one list of the amounts that have one');
  const donate = src.slice(src.indexOf('function initDonateTab(){'), src.indexOf('function showSettingsTab(tab){'));
  ok(donate.indexOf('if(promise && !SC_IS_PLAY){') !== -1, 'the copy-specific block is guarded on the store build');
  ok(/if\(!donateUrlFor\(amt\)\) btn\.style\.display = 'none';/.test(donate),
    'a tier with no card page behind it is not shown at all');
  ok(/pane\.querySelectorAll\('\.donate-quick'\)\.forEach/.test(donate),
    'only the tier buttons in this pane are touched');
  ok(donate.indexOf('through Stripe for donations') !== -1, 'and the pane says the tip comes through Stripe');
  ok(/donations are brought to you through Stripe, on a secure card page\./.test(donate), 'in the paragraph above it too');
  ok(donate.indexOf('secure card page') !== -1, 'naming the rail rather than the vendor alone');
  // The store build keeps every tier, and never names the other rail.
  ok(donate.indexOf('const web = SC_IS_PLAY ? \'\' : donateUrlFor(amt);') !== -1,
    'the store build never resolves a card page at all');
  ok(count(src, "a tip helps keep it running and improving — processed through Google Play. Thank you! 💛") === 1,
    'its own paragraph is untouched');
  ok(count(src, 'Google Play handles the payment.') === 1, 'and so is its own promise line');
  // The markup still carries every tier - the hiding is per copy, at run time.
  ok(count(src, 'class="donate-quick" data-amt="') === 11, 'all eleven tiers are still in the markup');
  const pages = (src.match(/(\d+): 'https:\/\/buy\.stripe\.com\//g) || []).length;
  ok(pages === 5, 'and there are still five card pages (' + pages + ')');
  const amounts = [...src.slice(src.indexOf('donateLinks: {'), src.indexOf('donateUrl:')).matchAll(/(\d+): 'https/g)].map((m) => m[1]);
  ok(amounts.join(',') === '2,5,10,25,50', 'for exactly 2, 5, 10, 25 and 50 (' + amounts.join(',') + ')');
  // The refresh-rate buttons share the class but live in another pane.
  ok(count(src, 'id="refreshRateOptions"') === 1, 'the refresh-rate row keeps the shared class');
  ok(src.indexOf("wrap.querySelectorAll('[data-rate]')") !== -1, 'and wires its own buttons');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
