// v63.1 — a YouTube run starts sooner, gives up less often, and stops from the
// card that started it.
//
// The report: "YouTube conversion is also taking forever and doesn't work half
// the time", and "if you click the little x right next to convert it should
// cancel the download". The x cleared the fields and nothing else, so a run kept
// going with no way to stop it from its own card (only the bubble's Cancel
// could). The slowness had four causes, and this checks each one where it can:
//
//   [1] the x beside Convert stops a run on BOTH cards, through ONE cancel path
//       the bubble's Cancel shares;
//   [2] the two player clients are asked AT ONCE instead of one after the other,
//       so no second YouTube round trip sits in front of the first byte;
//   [3] the title lookup rides alongside the run instead of blocking it;
//   [4] a chosen output format falls back to another one when it cannot be
//       PRODUCED here, but a stream that would not fetch still ends the run
//       (behaviour of the chain);
//   [5] a usability probe that got NO answer no longer disqualifies a stream -
//       only an explicit refusal does (behaviour of scStreamUsable);
//   [6] the release that carries all of it says so, without ever reading as a
//       downloader to the channel that may not.
//
//   node dev/test-653.mjs                             # the shipped tree
//   SC_HTML=/path/to/index.html node dev/test-653.mjs  # any build - this fails
//                       on the pre-fix build, which is the whole point of it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const src = fs.readFileSync(HTML, 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

async function main() {
  console.log('[1] the x beside Convert stops the run, one cancel path');
  ok(src.indexOf('function scCancelConversion(btnEl){') !== -1, 'the shared cancel helper exists');
  ok(src.includes("if(cancelBtn) cancelBtn.addEventListener('click', function(){ scCancelConversion(); });"),
    "the bubble's Cancel uses it");
  ok((src.match(/scCancelConversion\(cbtn\);/g) || []).length === 2, "both cards' x asks it to cancel");
  ok(src.indexOf("var cbtn = document.getElementById('ytMp3Btn');") !== -1, 'the Discover card checks its own Convert button');
  ok(src.indexOf("var cbtn = document.getElementById('ytMp3BtnSettings');") !== -1, 'the Settings card checks its own Convert button');
  ok((src.match(/var running = !!\(cbtn && cbtn\.disabled\);/g) || []).length === 2, 'a run is in flight exactly when the button is disabled');
  // The helper itself: it latches the flag the run checks, dismisses the bubble
  // on a grace window, and hands the Convert button back.
  {
    const start = src.indexOf('  function scCancelConversion(btnEl){');
    const end = src.indexOf('  function scConvertPill(show){', start);
    ok(start !== -1 && end !== -1, 'the cancel helper is extractable');
    if (start !== -1 && end !== -1) {
      const code = src.slice(start, end);
      const timers = [];
      const state = { el: null, timer: null, pct: 42, cancelRequested: false };
      const win = {};
      const cb = { disabled: false, textContent: 'Cancel' };
      const cs = { textContent: '' };
      state.el = { querySelector: (s) => (s === '.sc-pill-cancel' ? cb : s === '.sc-pill-sub' ? cs : null) };
      const btn = { disabled: true, textContent: 'Converting…' };
      const fn = new Function('scConvertPillState', 'scConvertPill', 'scNotifyProgress', 'window',
        'setTimeout', 'clearTimeout', code + '\n return scCancelConversion;')(state, () => {}, () => {}, win,
        (f, ms) => { timers.push(ms); return 1; }, () => {});
      fn(btn);
      ok(win.__scCancelDl === true, 'the run is told to stop');
      ok(state.cancelRequested === true, 'and no later status can bring the bubble back');
      ok(cb.disabled === true && /Cancelling/.test(cb.textContent), 'the bubble says it is stopping');
      ok(/Stopping/.test(cs.textContent), 'and why it may take a moment');
      ok(btn.disabled === false && btn.textContent === 'Convert', 'the button is usable again at once');
      ok(timers.length === 1 && timers[0] === 1500, 'with a dismissal on a short grace window');
    }
  }

  console.log('[2] the two player clients are asked at once');
  ok(src.indexOf('var answers = await Promise.all(asks);') !== -1, 'both answers are awaited together');
  ok(src.indexOf('var asks = clients.map(function(cl){') !== -1, 'the asks are launched as a batch');
  ok(src.indexOf('if(answered >= 2) break;') === -1, 'the serial early-exit is gone');
  {
    const start = src.indexOf('function scYtPlayer(');
    const end = src.indexOf('\n  function ', start);
    const body = start === -1 ? '' : src.slice(start, end === -1 ? start + 8000 : end);
    ok(body.indexOf('answered') === -1, 'scYtPlayer carries no answer counter at all');
    ok(body.indexOf('await scHttpJson(') === -1, 'no player call is awaited one at a time');
  }

  console.log('[3] the title lookup rides alongside the run');
  ok(src.indexOf('var metaP = tryMeta();') !== -1, 'it is started, not awaited, before the run');
  ok(src.indexOf('tryMeta().then(function(){') === -1, 'it no longer gates the run');
  ok(src.indexOf('if(metaP){ try{ await metaP; }catch(_mp){} metaP = null; }') !== -1, 'the encoder is where the run waits for it');

  console.log('[4] a chosen format falls back, a stream failure does not (behaviour)');
  ok(src.indexOf('var ENC_FAIL = { encoder: true };') !== -1, 'the encoder-failure sentinel exists');
  ok(src.indexOf('return ENC_FAIL; }') !== -1, 'the encoder failure is reported as one, not as an empty stream');
  ok(src.indexOf('if(res === ENC_FAIL) return walk(i + 1);') !== -1, 'a format that cannot be produced moves on');
  ok(src.indexOf('? [chosen].concat(') !== -1, 'a chosen format carries the other formats behind it');
  {
    const start = src.indexOf('var chosen = (presetFmt && presetFmt');
    const endM = '})(0);';
    const end = src.indexOf(endM, start);
    ok(start !== -1 && end !== -1, 'the fallback chain is extractable');
    if (start !== -1 && end !== -1) {
      const code = src.slice(start, end + endM.length);
      const run = async (presetFmt, outcomes, mode) => {
        const tries = [], rendered = [];
        const ENC_FAIL = { encoder: true };
        const chain = new Function('presetFmt', 'setStatus', 'tryYtAudioFormat', 'renderDownload', 'ENC_FAIL', `
          ${code}
          return chain;
        `)(presetFmt, () => {}, async (f) => {
          tries.push(f);
          const o = outcomes[f];
          if (o === 'enc') return ENC_FAIL;
          return o;
        }, (f) => { rendered.push(f); return true; }, ENC_FAIL);
        await chain;
        return { tries, rendered };
      };
      // The chosen format cannot be produced here: another one is.
      const a = await run('mp3', { mp3: 'enc', flac: { ok: 1 }, wav: { ok: 2 } });
      ok(a.tries[0] === 'mp3' && a.tries[1] === 'flac', 'the chosen format is tried first, another follows (' + a.tries.join(' -> ') + ')');
      ok(a.rendered.length === 1 && a.rendered[0] === 'flac', 'the fallback that worked is the one rendered');
      // A stream that would not fetch is NOT a format problem: no other format.
      const b = await run('mp3', { mp3: null, flac: { ok: 1 }, wav: { ok: 2 } });
      ok(b.tries.length === 1 && b.tries[0] === 'mp3', 'a failed stream does not re-fetch the same streams as another format');
      ok(b.rendered.length === 0, 'and nothing is rendered from it');
    }
  }

  console.log('[5] a silent probe is not a refusal (behaviour)');
  ok(src.indexOf('return !(probe && probe.status);') !== -1, 'only an answer that refuses the range disqualifies a stream');
  {
    const start = src.indexOf('  async function scStreamUsable(url, size){');
    const end = src.indexOf('  async function scFetchBytes(', start);
    ok(start !== -1 && end !== -1, 'scStreamUsable is extractable');
    if (start !== -1 && end !== -1) {
      const code = src.slice(start, end);
      const MiB = 1024 * 1024;
      const probe = (reply) => new Function('scFetchRange', 'SC_AUDIO_CHUNK', 'window', `
        ${code}
        return scStreamUsable;
      `)(async () => reply, MiB, {})('u', 5 * MiB);
      ok((await probe({ bytes: new Uint8Array(1), status: 206 })) === true, 'a stream that serves the probe is usable');
      ok((await probe({ status: 416 })) === true, 'a stream shorter than the probe point is still usable');
      ok((await probe(null)) === true, 'a probe with NO answer no longer throws the stream away');
      ok((await probe({ status: 0 })) === true, 'a probe that failed without a status is tolerated');
      ok((await probe({ status: 403 })) === false, 'a 403 past the cap still disqualifies the stream');
      ok((await probe({ status: 404 })) === false, 'a 404 still disqualifies the stream');
    }
  }

  console.log('[6] the release carries the claims');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  const head = entries && entries[0];
  ok(!!head && head.version === (src.match(/const APP_VERSION = '([^']+)'/) || [])[1], 'the head entry matches APP_VERSION');
  const rel = entries && entries.find((e) => String(e.version) === '63.1.3');
const note = rel ? (rel.items || []).find((i) => /A run starts sooner and gives up less often/.test(i)) : null;
  ok(!!note, 'the release notes say what changed');
  ok(!!note && note.startsWith('[FULL] '), 'and are marked download-only, so the Play notes never name a converter');
  ok(!/\bdownload|converter|convert\b/i.test((head ? head.items : []).join('\n')), 'the head entry carries no downloader wording');
  ok(!!note && rel.items.indexOf(note) >= 6, 'and the note sits outside the six items both channels publish');

  console.log('');
  console.log(pass + ' passed, ' + fail + ' failed  (' + path.basename(HTML) + ')');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('test-653 crashed: ' + e.stack); process.exit(1); });
