// 74.1.9, and this one came off the phone with the release already prepared:
//
//   "the Spotify to mp3 converter will frequently confuse songs by the same artist
//    while downloading a song and often duplicate the same song in different
//    metadata, this often happens when downloading albums, I see it about once every
//    time downloading an album and it shouldn't do that it should download the
//    correct audio"
//
// WHY IT DID IT. An album is ONE artist's whole run, so scArtistMatch cannot tell its
// tracks apart, and the length gate is +-60s - two tracks of one record routinely sit
// seconds apart. The only gate left between the tracks of an album is the TITLE one,
// and both title gates were SUBSTRING tests:
//
//   scTitleMatch('Yaar', 'Artist - Yaarian (Official Audio)', '')  ->  true
//   scTitleMatch('Pind', 'Artist - Pind Waliyan', '')              ->  true
//
// So track A accepted track B's upload, and when B's own turn came the run's claim
// ("a sibling already took this upload") refused B its own source - the same audio
// filed twice, once under B's tags by accident and once under whatever B could still
// find. That is "duplicate the same song in different metadata", once an album.
//
// WHAT THIS DRIVES. The three functions that decide it - scTitleMatch, scTitleStrong
// and scSourceClaimsSibling - are sliced out of the shipped page and run for real,
// against the pairs an album actually produces, plus the cases the older suites
// already pin so the fix cannot buy the bug back by rejecting everything.
//
// It also measures the other half of the same message - "frequent lag spikes inside
// the app while doing multiple things simultaneously" - by running the page's own
// slice logic and wake-up (scYieldToUI, extracted) over synthetic work, once on the
// frame budget the app now uses while it is on screen and once on the old 90ms one.
//
//   node dev/converter-identity-check.cjs
//   SC_HTML=/tmp/old.html node dev/converter-identity-check.cjs    # the red direction
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SC_ROOT || path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  + ' + name); }
  else { fail++; console.log('  X ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function slice(from, to) {
  const a = html.indexOf(from);
  if (a === -1) return '';
  const b = html.indexOf(to, a + from.length);
  return b === -1 ? '' : html.slice(a, b);
}

/* ------------------------------------------------ 1. the decision, where it lives */
console.log('[1] the loop still asks these three, and asks them in this order');
{
  const body = slice('  async function scSpToBuffer(meta, onStatus){', '  // Artist-name check');
  ok(body.length > 5000, 'the source resolver is where this probe expects it (' + body.length + ' chars)');
  ok(/scArtistMatch\([^)]*\) &&\s*\n\s*scTitleMatch\(title, pa\.videoTitle, cands\[ci\]\.title\)/.test(body),
    'a candidate is taken when the artist matches AND scTitleMatch accepts the title');
  ok(body.indexOf('scSourceClaimsSibling(cands[ci].title, title, myTitleKey, runSiblings)') !== -1,
    'and an upload a sibling named is skipped before it is ever played');
  ok(body.indexOf('scSourceClaimsSibling(pa.videoTitle, title, myTitleKey, runSiblings)') !== -1,
    'twice: once on the search hit, once on the player\'s own title');
  ok(/scTitleStrong\(title, pa\.videoTitle, cands\[ci\]\.title\)\);\n?/.test(body) ||
     body.indexOf('strong: scTitleStrong(title, pa.videoTitle, cands[ci].title)') !== -1,
    'and a strong title match is what ranks first, and what bends the length gate');
}

/* --------------------- 2. the gates themselves, extracted from the page and driven */
console.log('[2] a title is matched as whole words (the bug), and the old pins still hold');
let gates = null;
{
  const body = slice('  function scTitleMatch(expectedTitle, videoTitle, candTitle){',
    '  function scDurationOk(expectedSec, actualSec){');
  ok(body.indexOf('function scSourceClaimsSibling(') !== -1,
    'the whole title/claim block is sliced out in one piece (' + body.length + ' chars)');
  ok((body.match(/function hasRun\(blob, phrase\)\{/g) || []).length === 2,
    'both title gates test containment as a run of whole words');
  try {
    gates = new Function(body + '\nreturn { t: scTitleMatch, s: scTitleStrong, '
      + 'claim: scSourceClaimsSibling, key: scTrackTitleKey };')();
  } catch (e) { ok(false, 'the sliced block runs', e.message); }
}
if (gates) {
  const t = gates.t, s = gates.s, claim = gates.claim;
  // THE BUG: one album, shares a word, well inside the length gate.
  ok(t('Yaar', 'Artist - Yaarian (Official Audio)', '') === false,
    'a track called "Yaar" refuses the "Yaarian" upload');
  ok(t('Yaar', 'Yaarian', '') === false, 'and refuses it from the candidate title too');
  // A SHARED WHOLE WORD IS NOT PROOF, and pretending otherwise would reject real
  // uploads: "Pind" IS a word of "Pind Waliyan", so the title gate still accepts it.
  // What stops it is the run's own claim below - the longer title claims the upload,
  // so the short track never gets it. Two different guards, and the pair is what an
  // album needs: the substring test could not tell them apart at all.
  ok(claim('Artist - Pind Waliyan', 'Pind', 'pind', { pind: 1, 'pind waliyan': 1 }) === true,
    'an upload whose title carries a shared word whole is claimed by the longer title');
  ok(t('Yaar Nahi', 'Artist - Yaarian Nahi (Lyrical)', '') === false,
    'and a two-word title is not answered by a longer word carrying one of them');
  ok(s('Yaar', 'Artist - Yaarian (Official Audio)', '') === false,
    'the exact-title bar refuses it as well, so it cannot rank first or bend the length gate');
  ok(claim('Artist - Yaarian (Official Audio)', 'Yaar', 'yaar', { yaarian: 1 }) === true,
    'and the run now sees that upload as the SIBLING\'s, so it is skipped rather than claimed');
  // THE OTHER DIRECTION: the uploads that must keep working, or the fix trades one
  // album\'s duplicate for every album\'s "no source found".
  ok(t('Yaarian', 'Artist - Yaarian (Official Audio)', '') === true,
    'the track that owns that upload still accepts it');
  ok(t('Pind Waliyan', 'Artist - Pind Waliyan (Official Video)', '') === true,
    'and so does the track with the longer title');
  ok(t('As It Was', 'Harry Styles - As It Was (Live)', '') === true,
    'a live suffix around the title still passes (60%/containment, pinned since 60.4.6)');
  ok(t('Shape of You', 'Ed Sheeran - Shape of You (Official Music Video)', '') === true,
    'and so does an upload that wraps the title in extra words');
  ok(t('Golden Hour', 'Someone Else - Cover Medley', '') === false,
    'an unrelated upload is still refused');
  ok(t('Hello', 'Completely Different Song', '') === false,
    'and so is a different song outright');
  ok(s('As It Was', 'Harry Styles - As It Was (Live)', '') === true,
    'the exact-title bar keeps its own old answer');
  ok(claim('Someone Else - Cover Medley', 'Yaar', 'yaar', { yaarian: 1 }) === false,
    'and a candidate that belongs to nobody is not stolen by the sibling rule');
  ok(gates.key('Yaarian (Official Audio)') === 'yaarian official audio',
    'the run\'s title keys are unchanged, so the claims of an album still line up');
}

/* ------------------------------------- 3. the slice the UI gets back, and measured */
console.log('[3] the encoder hands the thread back within a frame while it is on screen');
// The one part of this probe that has to await, so it is the part that is async:
// a .cjs file has no top-level await.
(async () => {
  const cnt = (n) => html.split(n).length - 1;
  const visible = 'document.hidden ? SC_ENCODE_SLICE_MS * scBackSliceMul() : SC_ENCODE_FRAME_MS';
  ok(cnt(visible) === 2, 'both encoder loops read the frame budget while the page is visible');
  const frame = Number((html.match(/var SC_ENCODE_FRAME_MS = (\d+);/) || [])[1]);
  ok(frame > 0 && frame <= 24, 'and that budget is a frame, not a guess (' + frame + 'ms)');
  ok(html.indexOf('var SC_ENCODE_SLICE_MS = 90;') !== -1,
    'the 90ms slice the background lane uses is untouched');
  ok(cnt('scYieldToUI()') >= 4, 'every cooperative loop still yields through the one helper');
  ok(html.indexOf("_scYieldCh.port2.postMessage(0)") !== -1,
    'and the wake-up is a macrotask now, with the timer kept as the fallback');
  ok(html.indexOf('return new Promise(function(res){ setTimeout(res, 0); });') !== -1,
    'the fallback is still there for anything without MessageChannel');

  // The yield itself, from the page.
  const yBody = slice('  function scYieldToUI(){', '  // Work per slice');
  let yieldToUI = null, usedChannel = null;
  try {
    yieldToUI = new Function('MessageChannel', 'setTimeout',
      // Every read of a name this release adds goes through a guard: on the page
      // BEFORE the fix the whole probe still has to print its result, which is what
      // makes the red direction readable rather than a stack trace.
      yBody + '\nreturn { y: scYieldToUI, ch: function(){ return typeof _scYieldCh !== "undefined" && !!_scYieldCh; } };')(MessageChannel, setTimeout);
  } catch (e) { ok(false, 'the page\'s own wake-up runs', e.message); }
  if (yieldToUI) {
    // Synthetic work in the shape of the encoder: a unit of CPU, then the page's own
    // slice test, then the page's own wake-up. The unit is CALIBRATED first - a loop
    // whose result nobody reads is deleted by the JIT and would measure nothing.
    let sink = 0;
    const burn = (n) => { for (let i = 0; i < n; i++) sink += Math.sqrt(i) * Math.sin(i); };
    let perBlock = 0;
    for (let n = 20000; n <= 4e7; n *= 2) {
      burn(5000);                                  // warm the JIT before timing it
      const a = Date.now();
      for (let r = 0; r < 3; r++) burn(n);
      if (Date.now() - a >= 9) { perBlock = n; break; }   // ~3ms of work per block
    }
    ok(perBlock > 0, 'the synthetic work really burns the thread (' + perBlock + ' iterations ~3ms)');
    // What is measured is the number that matters to a finger on the glass: the
    // longest UNBROKEN block of work the loop holds the main thread for, which is
    // how long a scroll or a tap waits. Then the wall clock of the same work, since
    // a smaller slice wakes up more often and a wake-up is not free.
    const run = async (budget) => {
      let sliceStart = Date.now(), maxSlice = 0, yields = 0;
      const start = Date.now();
      for (let b = 0; b < 300; b++) {
        burn(perBlock);
        const held = Date.now() - sliceStart;
        if (held > maxSlice) maxSlice = held;
        if (held >= budget) { sliceStart = Date.now(); yields++; await yieldToUI.y(); }
      }
      return { total: Date.now() - start, maxSlice, yields };
    };
    const old = await run(90), now = await run(frame);
    ok(sink !== 0, 'and the work was not optimised away (' + Math.round(sink) + ')');
    ok(old.maxSlice >= 80, 'at 90ms one unbroken slice held the thread for ' + old.maxSlice + 'ms');
    ok(now.maxSlice <= 30, 'the frame budget holds it for ' + now.maxSlice + 'ms, inside a frame');
    ok(now.yields > old.yields * 3,
      'by handing the thread back far more often: ' + old.yields + ' slices -> ' + now.yields);
    ok(now.total < old.total * 1.6,
      'and the same work does not cost much more wall clock (' + now.total + 'ms vs ' + old.total + 'ms, '
      + Math.round((now.total / old.total - 1) * 100) + '% up, on a wake-up that is no longer a timer)');
    ok(yieldToUI.ch(), 'the page\'s helper built its macrotask channel on the first wake-up');
  }
  /* ---------------------------------------------------------- 4. the release bump */
  console.log('[4] the release these rules ship in');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ver = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(/^\d+(\.\d+)*$/.test(String(ver)), 'APP_VERSION = ' + ver);
  ok(sw.indexOf('sidecut-shell-v' + ver) !== -1, 'and the shell cache is that version too (' + ver + ')');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
