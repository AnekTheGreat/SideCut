#!/usr/bin/env python3
"""80.3.4 - the tabs come back where you left them, the downloader keeps the link
and picks an interrupted run back up, and the store build carries no downloader at
all (app or notes).

Like 80.3.2 and 80.3.3, the edits themselves live in modules beside this file:

    patch_8034_scroll.py    Discover/Studio/Tools remember their position (and the
                            two "start at the top" resets that pinned Discover go)
    patch_8034_job.py       the run is written down: link, format, song list, what
                            landed - plus the resume, and the library-write hook
    patch_8034_runners.py   the YouTube playlist run becomes a function the
                            downloader can start again; both runners mark their slots
    patch_8034_play.py      the store build: the tools leave the document, and the
                            notes (in the app and in the published channel) stop
                            mentioning a downloader
    patch_8034_copy.py      the copy that promised too little

THE OWNER'S ASK, VERBATIM (two messages, one release):

    "discover studio and tools should all autoscroll to where you were last, even
     if you refresh, the link should save in the downloader and it should
     automatically resume downloading"

    "in play version of app remove any parts even related to downloaders or
     converter from the app and it's patch notes"

Idempotent: the marker is this release's page comment, and it is in the page it wrote.

    python3 dev/patch-8034.py
    python3 dev/patch-8034.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.3.4'
OLD_VERSION = '80.3.3'
MARKER = '80.3.4 - THE TABS COME BACK WHERE YOU LEFT THEM'

sys.path.insert(0, HERE)

import patch_8034_copy      # noqa: E402
import patch_8034_job       # noqa: E402
import patch_8034_play      # noqa: E402
import patch_8034_runners   # noqa: E402
import patch_8034_scroll    # noqa: E402


def one(src, marker, what):
    n = src.count(marker)
    if n != 1:
        raise SystemExit('patch-8034: %s appears %d times, expected 1 (marker: %s)'
                         % (what, n, marker[:70].replace('\n', '\\n')))
    return src.index(marker)


def swap(src, old, new, what):
    n = src.count(old)
    if n != 1:
        raise SystemExit('patch-8034: %s appears %d times, expected 1 (marker: %s)'
                         % (what, n, old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def swap_all(src, old, new, what, expect):
    n = src.count(old)
    if n != expect:
        raise SystemExit('patch-8034: %s appears %d times, expected %d (marker: %s)'
                         % (what, n, expect, old[:70].replace('\n', '\\n')))
    return src.replace(old, new)


def span(src, start, end, new, what, drop_end=False):
    """Replace start..end with `new`. With drop_end the end marker goes too (a whole
    statement being taken out); without it the marker is the next thing kept."""
    i = one(src, start, what + ' (start)')
    j = src.index(end, i)
    if j < 0:
        raise SystemExit('patch-8034: %s has no end marker' % what)
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
        'Discover, Studio and Tools come back where you left them. Scroll down the search results, open a tool, go and play something, come back \u2014 each tab is where you left it, and it still is after a refresh, because the position is kept on the device rather than for the session.',
        'The downloader keeps your link. Paste an album, start it, and the link stays in the box \u2014 if the app is reloaded while it runs (an update, a crash, the system closing it), the downloader starts that album again on its own, straight away.',
        '[FULL] An interrupted run resumes the songs that never landed, not the whole album: the run writes down the song list it is working through and which of them are in your library, so nothing is downloaded twice and nothing is silently dropped.',
        '[FULL] A song that cannot be found is tried twice on the next starts and then left to you: the link stays in the box and one tap starts it again by hand, so a song nobody can source never begins a download on every single launch.',
        '[FULL] Cancel means gone: stopping a download clears what was written down, so the next start never quietly begins the run you stopped.',
        'The build that only takes the files you already own has no downloader and no converter in it at all now \u2014 the tools are removed from the app rather than hidden away \u2014 and the update notes it shows never mention one.',
        'Nothing about a conversion itself changed: the same song makes the same tagged file, with the same cover, the same name and the same format menu as the last release.',
        'Nothing moved in the player, the library, the albums, the lyrics, the equaliser or the widget.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'") for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'The tabs come back where you left them, the downloader keeps the link and resumes an interrupted album, and the store build carries no downloader',
               body))


def edit_sister(path, old, new, what):
    full = os.path.join(ROOT, path)
    src = open(full, encoding='utf-8').read()
    n = src.count(old)
    if n != 1:
        raise SystemExit('patch-8034: %s in %s appears %d times, expected 1' % (what, path, n))
    open(full, 'w', encoding='utf-8').write(src.replace(old, new, 1))
    print('  edited %s (%s)' % (path, what))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the tabs remember, the downloader resumes')
        print('patch-8034%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8034 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8034: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)

    # 1. Discover stops being pinned to the top (both lines), and the memory block
    #    goes in at the end of the page.
    page = swap(page, patch_8034_scroll.DISCOVER_RESET_OLD, patch_8034_scroll.DISCOVER_RESET_NEW,
                'the Discover reset in showDiscover')
    page = swap(page, patch_8034_scroll.NAVIGATE_RESET_OLD, patch_8034_scroll.NAVIGATE_RESET_NEW,
                'the Discover reset in navigate')
    page = swap(page, patch_8034_scroll.TAIL_ANCHOR,
                patch_8034_scroll.TAIL_ANCHOR.replace('</body>', patch_8034_scroll.SCROLL_BLOCK + '</body>'),
                'the scroll-memory block')
    # 2. the run is written down
    page = swap(page, patch_8034_job.HOLD_END_ANCHOR, patch_8034_job.JOB_BLOCK + patch_8034_job.HOLD_END_ANCHOR,
                'the job record')
    page = swap(page, patch_8034_job.ADD_HOOK_OLD, patch_8034_job.ADD_HOOK_NEW,
                'the landed-song hook')
    page = swap(page, patch_8034_job.CANCEL_OLD, patch_8034_job.CANCEL_NEW,
                'Cancel clears the record')
    page = swap(page, patch_8034_job.SP_SINGLE_OLD, patch_8034_job.SP_SINGLE_NEW,
                'the Spotify single records its link')
    page = swap(page, patch_8034_job.YT_SINGLE_OLD, patch_8034_job.YT_SINGLE_NEW,
                'the YouTube single records its link')
    # 3. the runners
    page = swap(page, patch_8034_runners.YT_FN_ANCHOR, patch_8034_runners.YT_RUN_FN + patch_8034_runners.YT_FN_ANCHOR,
                'the YouTube run as a function')
    page = span(page, patch_8034_runners.YT_SPAN_START, patch_8034_runners.YT_SPAN_END,
                patch_8034_runners.YT_SPAN_NEW, 'the YouTube click handler', drop_end=True)
    page = swap(page, patch_8034_runners.SP_HEAD_OLD, patch_8034_runners.SP_HEAD_NEW,
                'the Spotify batch records itself')
    page = swap(page, patch_8034_runners.SP_SUB_OLD, patch_8034_runners.SP_SUB_NEW,
                'the resume words')
    page = swap(page, patch_8034_runners.SP_TAKE_OLD, patch_8034_runners.SP_TAKE_NEW,
                'the Spotify slot marks')
    # 4. the store build
    page = swap(page, patch_8034_play.CONV_ID_OLD, patch_8034_play.CONV_ID_NEW,
                'the tools section gets its name')
    page = swap(page, patch_8034_play.PLAY_CARDS_OLD, patch_8034_play.PLAY_CARDS_NEW,
                'the store build removes the section')
    page = swap(page, patch_8034_play.PLAY_SP_OLD, patch_8034_play.PLAY_SP_NEW,
                'the leftover hide call')
    page = swap(page, patch_8034_play.PLAY_SIBLING_OLD, patch_8034_play.PLAY_SIBLING_NEW,
                'the store build removes the tools beside the how-to')
    page = swap(page, patch_8034_play.PLAY_SUM_OLD, patch_8034_play.PLAY_SUM_NEW,
                'the store build stops renaming tools it does not have')
    page = swap(page, patch_8034_play.NOTES_FN_OLD, patch_8034_play.NOTES_FN_NEW,
                'the store notes filter')
    for old, new, what in patch_8034_play.NOTES_SITES:
        if what == 'the update-log panel (both of its modes)':
            page = swap_all(page, old, new, what, 2)
        else:
            page = swap(page, old, new, what)
    # 5. the copy
    for old, new, what in patch_8034_copy.COPY_SWAPS:
        page = swap(page, old, new, what)
    # 6. the changelog head and the version
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8034: the page did not end up 80.3.4 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8034: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 7. the shell cache
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8034: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    # 8. THE PUBLISHED PLAY NOTES. The store build's own notes are filtered where
    #    they are written (the app) and where they are published (this script), so
    #    the two can never disagree about what that build offers.
    edit_sister('dev/ota-bundle-play.mjs', patch_8034_play.OTAPLAY_FN_OLD, patch_8034_play.OTAPLAY_FN_NEW,
                'the store channel filters its notes the way the app does')
    edit_sister('dev/ota-bundle-play.mjs', patch_8034_play.OTAPLAY_NOTES_OLD, patch_8034_play.OTAPLAY_NOTES_NEW,
                'the store channel drops downloader notes')

    print('  applied: the tab memories, the job record and its resume, the YouTube run as a function, '
          'both slot marks, the store build ts cleanup, the notes filters, the copy, the changelog head '
          'and the shell cache')
    print('patch-8034: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.3.4';", 'the page runs 80.3.4'),
    (MARKER, 'the release comment is in the scroll memory'),
    ("{ version: '80.3.4', date:", 'the changelog records the release'),
    ("window.__scScrollKeys = KEYS;", 'the scroll memory is in the page'),
    ("sidecut_scroll_discover", 'Discover has its own position'),
    ("sidecut_scroll_studio", 'Studio has its own position'),
    ("sidecut_scroll_tools", 'Tools has its own position'),
    ("function scDlJobBegin(kind, url, fmt, mode, title, plan, chosen, single){", 'a run writes itself down'),
    ("async function scDlResume(){", 'the resume is there'),
    ("if((rec.attempts || 0) >= 2) return;", 'the automatic resumes are bounded'),
    ("scDlJobItems('spotify', originalUrl, fmt, saveMode,", 'the Spotify batch records its run'),
    ("scDlJobItems('youtube', url, fmt, 'library',", 'the YouTube playlist records its run'),
    ("scDlJobTake(i);", 'a finished song comes off the queue by slot'),
    ("try{ scDlJobTake(-1, title); }catch(_tk){}", 'a landed song comes off the queue at the library write'),
    ("scDlJobBegin('spotify', url, (presetFmt", 'the Spotify single keeps its link'),
    ("scDlJobBegin('youtube', url, (presetFmt", 'the YouTube single keeps its link'),
    ("async function scYtRunChosen(pl, chosen, fmt, box, btnEl, url){", 'the playlist run is startable again'),
    ("scYtRunChosen(pl, chosen, fmt, box, btnEl, url).catch(", 'the Convert button starts it'),
    ("scDlHead() + runDone + ' of ' + chosen.length", 'a resumed run says so'),
    ("id=\"convToolsCard\"", 'the tools section can be named'),
    ("['convToolsCard', 'spCardDisc', 'ytCardDisc', 'spCardSettings', 'ytCardSettings'].forEach(", 'the store build removes them'),
    ("function scChangelogEntries(){", 'the store notes filter is there'),
    ("scChangelogEntries().map(entry =>", 'the update log goes through it'),
    ("const entry = scChangelogEntries()[0];", "the What's New popup goes through it"),
    ("const latest = scChangelogEntries()[0];", 'the sheet summary goes through it'),
    ("html += scChangelogEntries().map((entry, idx) => {", 'the sheet list goes through it'),
    ("'[FULL] '", 'the store-only notes are marked'),
]

GONE = [
    ("const APP_VERSION = '80.3.3';", 'the old version constant'),
    ("var _dv = $('discoverView'); if(_dv) _dv.scrollTop = 0;", 'the Discover reset'),
    ("['ytCardDisc'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });",
     'the store build hides the YouTube card instead of removing it'),
    ("['spCardDisc'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });",
     'the store build hides the Spotify card instead of removing it'),
    ("if(/Spotify/.test(_sumTxt) && /MP4/.test(_sumTxt)) _sums[_si].textContent = 'MP4 \u00b7 Expand URL';",
     'the store build renames tools it no longer has'),
    ("          (async function(){\n            var okCount = 0, failed = 0, failedNames = [];",
     'the playlist run inside the click handler'),
    ("body.innerHTML = CHANGELOG.map(entry => `", 'the update log reading the whole array'),
]

if __name__ == '__main__':
    sys.exit(main())
