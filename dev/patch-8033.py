#!/usr/bin/env python3
"""80.3.3 - the converters use the whole device: songs convert several at a time, a
stream is pulled in parallel ranges, each encoder runs on its own thread, and a run
keeps going while the app is behind something else.

Like 80.3.2, the edits themselves live in modules beside this file, one per thing the
release changes:

    patch_8033_ranges.py    the bounded-range reader goes out through lanes, plus the pool
    patch_8033_workers.py   the encoders move to worker threads; their samples, the mirrors
    patch_8033_claims.py    the claim before the download; a failure reason per song
    patch_8033_hold.py      the run's own lifetime: the lock, the notification, the plugin
    patch_8033_runners.py   the two batch runners: rows up front, songs in flight
    patch_8033_copy.py      the copy that still said "one by one, in order"

WHAT WAS ACTUALLY SLOW (measured, not guessed - dev/_dl8033-measure.cjs runs the
page's own encoders over a 3.5-minute stereo track):

    FLAC            ~7.0-9.1 s of solid CPU
    MP3 at 192k     ~11.7 s of solid CPU

A 32-song album is about two hours of audio, so it was 220-370 seconds of encoding
on ONE thread - the app's own thread - before a single byte of network is counted.
On top of that, every song was fetched as 10-15 bounded 1 MiB ranges (googlevideo
refuses a wider request) paid one after another, and every song waited for the one
before it to finish entirely. That is the hour.

WHAT THIS RELEASE DOES, and why each part:

1. THE RANGES GO OUT TOGETHER (scFetchBytes). Same bounded ranges, four in flight,
   stitched back in order - the file is byte-for-byte what the sequential reader
   produced, only the waiting overlaps. A 200 (the server ignoring Range and sending
   the whole file) is now taken as the whole stream instead of being appended to the
   first range, and a short read or a refusal still ends the file exactly where it
   did before, with the same size gate rejecting a truncated stream.

2. SEVERAL SONGS IN FLIGHT (scRunPool + both batch runners). Every leg of a
   conversion waits on something else, and one song at a time added those waits up
   instead of overlapping them. The lane count is a memory budget, not a network
   one: a lane holds one song's decoded audio (~74 MB for 3.5 minutes of stereo),
   so it is 2 on a small device, 3 on a normal one and 4 on a roomy one, and
   window.__scDlTracks overrides it for a test.

3. THE ENCODERS GET THREADS (scEncoderSource/scEncodeInPool). This is the part that
   makes five minutes possible at all: 220-370 s of CPU cannot be hidden by any
   amount of parallelism on one thread. The pool runs THE PAGE'S OWN ENCODER SOURCE
   (Function.prototype.toString) inside workers, so there is still exactly one
   implementation of every format - the worker is a place to run it, not a second
   copy of it - and a worker keeps its speed while the page is hidden, which the
   page's own timers do not. MP3 keeps its samples in the page (the CDN encoder is
   the one thing a worker may not be able to reach), so an mp3 that fails in a
   worker still falls back to encoding here; the formats whose encoder is in the
   page hand their samples over, and a failure there is reported as a failed song
   rather than silently writing silence.

4. A RUN IS NOT A WINDOW. A batch holds a Web Lock for its whole length (the one
   signal every platform honours about work that must not be frozen, the same
   mechanism the re-encode job already uses) and reports into the system
   notification. On Android it also calls the SideCutJob plugin the Android build
   injects (patch-joblock.py: a partial wake lock plus a dataSync foreground
   service), because an app with the screen off is suspended by the OS and a
   suspended app does not download. Absent the plugin - a browser, or an APK older
   than this release - every call is a no-op and the run is exactly as it was.

5. ONE SOURCE, ONE SONG, STILL. The claim on an upload moved to before the download
   (scSourceClaim): with several songs in flight, writing the ledger after the
   decode let two siblings pick the same upload while neither had recorded it yet.
   Per-song failures got their own sink (scFail/ctx.reason) for the same reason -
   window.__scSourceFail is one slot and three songs were overwriting it.

Idempotent: the marker is this release's page comment, and it is in the page it wrote.

    python3 dev/patch-8033.py
    python3 dev/patch-8033.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.3.3'
OLD_VERSION = '80.3.2'
MARKER = '80.3.3 - THE RANGES GO OUT TOGETHER'

sys.path.insert(0, HERE)

import patch_8033_claims   # noqa: E402
import patch_8033_copy     # noqa: E402
import patch_8033_hold     # noqa: E402
import patch_8033_ranges   # noqa: E402
import patch_8033_runners  # noqa: E402
import patch_8033_workers  # noqa: E402


def one(src, marker, what):
    n = src.count(marker)
    if n != 1:
        raise SystemExit('patch-8033: %s appears %d times, expected 1 (marker: %s)'
                         % (what, n, marker[:70].replace('\n', '\\n')))
    return src.index(marker)


def swap(src, old, new, what):
    n = src.count(old)
    if n != 1:
        raise SystemExit('patch-8033: %s appears %d times, expected 1 (marker: %s)'
                         % (what, n, old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def span(src, start, end, new, what, drop_end=False):
    """Replace start..end with `new`. With drop_end the end marker goes too (a whole
    statement being taken out); without it the marker is the next thing kept."""
    i = one(src, start, what + ' (start)')
    j = src.index(end, i)
    if j < 0:
        raise SystemExit('patch-8033: %s has no end marker' % what)
    if drop_end:
        j += len(end)
    return src[:i] + new + src[j:]


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'An album converts in minutes instead of an hour. Three things were slow and all three are fixed: a song\u2019s audio is now pulled four ranges at a time instead of one after another, several songs convert at once instead of one waiting for the last, and the encoders run on their own threads instead of on the one thread every tap has to get through.',
        'The encoders moved off the app\u2019s thread. FLAC and MP3 are seconds of solid arithmetic per song \u2014 about two hours of it across a 32-song album \u2014 and running that where the interface lives is why a long run felt like the app had stopped. The work now runs in worker threads, by the same encoders: the files are the same files, byte for byte.',
        '<b>A run keeps going in the background.</b> Start an album, leave the app, put the phone down: the run holds itself open (the same Web Lock the compressor uses), keeps its progress in the notification, and the songs are in your library when you come back.',
        'On Android the app also keeps the device awake for the length of a run and hands it straight back when the last song lands \u2014 a locked screen no longer stops a download. (That part ships with the next app build; the release itself uses the lock the browser honours.)',
        'The lane count follows the device: two songs at a time on a small phone, three on a normal one, four on a roomy one \u2014 a song\u2019s decoded audio is ~74 MB, so this is a memory number, and memory is what a phone runs out of first.',
        'Two songs of one album can no longer be handed the same upload. The claim on a source is taken before the download rather than after it, which is what a run of several songs at once needs to stay honest.',
        'A song that fails in a run says why in its own row. The reason used to live in one shared slot, so with several songs in flight one song\u2019s error could be reported against another.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'") for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'An album converts in minutes, the run keeps going in the background, and a failed song says why',
               body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the ranges overlap and the pool is in it')
        print('patch-8033%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8033 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8033: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)

    # 1. the ranges
    page = span(page, patch_8033_ranges.RANGES_OLD_START, patch_8033_ranges.RANGES_END, patch_8033_ranges.RANGES_NEW, 'the range reader')
    # 2. the encoders' own threads (and the pool helpers, which sit with the reader)
    page = swap(page, patch_8033_workers.ENCODE_OLD, patch_8033_workers.ENCODE_NEW, 'the cooperative encoder head')
    for old, new, what in patch_8033_workers.KEEP_SAMPLES:
        page = swap(page, old, new, what)
    # 3. claims before the download
    page = swap(page, """  async function scSpToBuffer(meta, onStatus){""",
                patch_8033_claims.CLAIM_FN + """  async function scSpToBuffer(meta, onStatus){""", 'the claim helper')
    for old, new, what in patch_8033_claims.CLAIM_SITES:
        page = swap(page, old, new, what)
    # 4. per-song failure reasons
    page = swap(page, """  // One video, end to end: resolve its audio, read its real metadata, decode and""",
                patch_8033_claims.FAIL_FN + """  // One video, end to end: resolve its audio, read its real metadata, decode and""", 'the fail sink')
    for old, new, what in patch_8033_claims.FAIL_SITES:
        page = swap(page, old, new, what)
    page = swap(page, patch_8033_claims.CONVERT_ONE_OLD, patch_8033_claims.CONVERT_ONE_NEW, 'the single-track converter')
    # 5. the run's own lifetime
    page = swap(page, """  function scConvertPillResetCancel(){ scConvertPillState.cancelRequested = false; }""",
                """  function scConvertPillResetCancel(){ scConvertPillState.cancelRequested = false; }\n""" + patch_8033_hold.HOLD_FN,
                'the run hold')
    # 6. the two batch runners
    page = span(page, patch_8033_runners.YT_OLD_START, patch_8033_runners.YT_OLD_END, patch_8033_runners.YT_NEW, 'the YouTube playlist runner', drop_end=True)
    page = span(page, patch_8033_runners.SP_OLD_START, patch_8033_runners.SP_OLD_END, patch_8033_runners.SP_NEW, 'the Spotify batch runner', drop_end=True)
    # 7. the mp3 mirror list, shared with the workers
    page = swap(page, patch_8033_workers.LAME_OLD, patch_8033_workers.LAME_NEW, 'the lamejs mirror list')
    page = swap(page, """  window.__scEnsureLamejs = (function(){""",
                patch_8033_workers.LAME_CONST + """  window.__scEnsureLamejs = (function(){""", 'the lamejs mirrors')
    # 8. copy that is no longer true
    for old, new, what in patch_8033_copy.COPY_SWAPS:
        page = swap(page, old, new, what)
    # 9. the changelog head, the version, the shell cache
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(), 'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8033: the page did not end up 80.3.3 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8033: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8033: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the parallel ranges, the song pool, the encoder workers, the source claims, '
          'the per-song reasons, the run hold, both batch runners, the changelog head and the shell cache')
    print('patch-8033: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.3.3';", 'the page runs 80.3.3'),
    (MARKER, 'the release comment is in the range reader'),
    ("{ version: '80.3.3', date:", 'the changelog records the release'),
    ('async function scFetchBytes(url, expectedSize, onProgress){', 'the range reader is there'),
    ('var lanes = Math.max(1, Math.min(scDlLanes(), plan - 1));', 'the ranges overlap'),
    ('function scDlLanes(){', 'the lane count is published'),
    ('async function scRunPool(items, lanes, work){', 'the run pool is there'),
    ('function scEncoderSource(){', 'the worker source is built from the page'),
    ("'function scYieldToUI(){ return Promise.resolve(); }',", 'the worker source shims what a worker lacks'),
    ('async function scEncodeInPool(buf, fmt, meta, onSlice, kbps, keepSamples){', 'the encode pool is there'),
    ('async function scEncodeAudioCooperative(buf, fmt, meta, onSlice, keepSamples){', 'the cooperative encoder takes the pool first'),
    ('scEncodeAudioCooperative(rendered, cropFmt, null, null, true);', 'the crop preview keeps its samples'),
    ('scEncodeAudioCooperative(slice, cropFmt, meta, null, true);', 'the crop save keeps its samples'),
    ('function scSourceClaim(used, videoId, titleKey){', 'the claim is a function'),
    ('scSourceClaim(runUsed, entry.vid, myTitleKey)', 'the verified candidate is claimed before the read'),
    ('var fbClaimed = !(runUsed && fallbackCand', 'the fallback is claimed too'),
    ('function scFail(ctx, msg){', 'a song has its own failure sink'),
    ('scFail(runCtx, ', 'the reasons go through it'),
    ('var ctx = { used: runCtx.used, titles: runCtx.titles, reason: ', 'a song carries its own context'),
    ('function scRunJobStart(title, sub){', 'the run holds itself open'),
    ("navigator.locks.request('sidecut-download'", 'the run holds a Web Lock'),
    ('function scRunJobNote(sub, pct){', 'the notification follows the run'),
    ('await scRunPool(chosen, scDownloadLanes(), async function(tr, i){', 'the YouTube playlist runs the pool'),
    ('await scRunPool(tracks, scDownloadLanes(), async function(track, i){', 'the Spotify batch runs the pool'),
    ('var SC_LAME_MIRRORS = [', 'the lamejs list is shared'),
    ('var mirrors = SC_LAME_MIRRORS;', 'the page loader reads it'),
    ('several at a time, with title/artist', 'the copy says what happens'),
]

GONE = [
    ("const APP_VERSION = '80.3.2';", 'the old version constant'),
    ('for(var i = 0; i < chosen.length; i++){\n              if(window.__scCancelDl) break;', 'the sequential YouTube playlist loop'),
    ('for(var i = 0; i < tracks.length; i++){\n      var meta = Object.assign({}, tracks[i]);', 'the sequential Spotify batch loop'),
    ('              if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 200); });\n            }', 'the between-songs pause (YouTube playlist)'),
    ('      if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 200); });\n    }', 'the between-songs pause (Spotify batch)'),
    ('async function scEncodeAudioCooperative(buf, fmt, meta, onSlice){\n', 'the thread-bound encoder signature'),
    ('window.__scSourceFail = \'no source found — the Play build', 'the shared failure slot in the search path'),
]

if __name__ == '__main__':
    sys.exit(main())
