#!/usr/bin/env python3
"""80.6.2 - the notes read as words, and the settings strip glides.

The owner's ask, verbatim:

    "horizontal scroll in settings should be smooth and what the hell are these
     grater than symbols with a b then a less then symbol in the patch notes
     remove all of those form patch notes"

TWO SEPARATE BUGS, ONE RELEASE.

1. THE TAGS. Changelog notes have always been allowed to carry emphasis - 171
   of them in this page do - but every renderer escapes the note before it paints
   it (`escapeHtml(brief)` in scClItemHtml, `escapeHtml(i)` in the What's new
   summary, the glance line in the update log). So `<b>Settings</b>` reached the
   screen as the literal characters, and `&mdash;` arrived as its own name. The
   escaping is right and stays: notes are data, not markup. What was missing is a
   cleaner step in front of it. scNoteText() drops the emphasis tags and decodes
   the dozen entities the changelog actually uses, and scClBrief() runs every note
   through it - which means the bullets, the collapsed glance, the update counts
   and the What's new popup all get the same plain sentence from one place, and
   no note can leak a bracket again, old or new.

2. THE STRIP. Settings > tabs had `scroll-snap-type: x proximity` with a centred
   snap point on every tab. On a phone that is the sticky feeling: a slow drag
   trips the snap repeatedly, so the strip keeps tugging out from under the
   finger. It is `none` now - the strip glides with the momentum the platform
   gives it and stays where your finger leaves it - while the tab you OPEN still
   glides to the centre (scTabIntoView already asks for a smooth scroll, and the
   strip now has scroll-behavior: smooth for it). The children claim pan-x and
   refuse to be dragged as images or selected as text, so a drag that starts on a
   tab moves the strip instead of doing nothing.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8062.py
    python3 dev/patch-8062.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.2'
OLD_VERSION = '80.6.1'
MARKER = '80.6.2 - PLAIN NOTES AND A FREE STRIP'

# ---------------------------------------------------------------------------
# 1. The strip's own box.
# ---------------------------------------------------------------------------
STRIP_OLD = """#settingsTabStrip {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overflow-x: auto !important;
  scroll-behavior: auto;
  overscroll-behavior-x: contain;
  /* 80.4 - the drag belongs to the strip. pan-x stops the browser turning a
     sideways drag into a page scroll, proximity snap settles it on a tab instead
     of between two, and scroll-padding lets a tab sit flush at the ends. */
  touch-action: pan-x;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 10px;
}"""

STRIP_NEW = """#settingsTabStrip {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overflow-x: auto !important;
  overflow-y: hidden;
  /* 80.6.2 - SMOOTH, IN THE ONLY PLACE CSS CAN MAKE IT SO. Touch scrolling is the
     platform's own momentum either way; scroll-behavior is what the tab-centring
     scroll asks for, so opening a tab glides instead of jumping. */
  scroll-behavior: smooth;
  overscroll-behavior-x: contain;
  /* 80.4 - the drag belongs to the strip: pan-x stops the browser turning a
     sideways drag into a page scroll, and scroll-padding lets a tab sit flush at
     the ends.
     80.6.2 - THE SNAP IS GONE. Proximity snap with a centred point re-engaged
     during a slow drag, so the strip kept tugging itself out from under the
     finger - that is what "not smooth" felt like. A free strip keeps the
     platform's momentum and stays where the finger leaves it; scTabIntoView()
     still centres the tab you open, which is the part that was ever wanted. */
  touch-action: pan-x;
  scroll-snap-type: none;
  scroll-padding-inline: 10px;
}"""

# ---------------------------------------------------------------------------
# 2. A tab is a thing you drag, not an image and not a text selection.
# ---------------------------------------------------------------------------
TAB_OLD = """#settingsTabStrip > .tab{
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  scroll-snap-align: center;
  scroll-margin-inline: 10px;
}"""

TAB_NEW = """#settingsTabStrip > .tab{
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 80.6.2 - a drag that starts on a tab belongs to the strip: pan-x lets the
     gesture scroll the row, and refusing the native drag and the text selection
     stops a long press from turning the tab into a ghost image mid-swipe. */
  touch-action: pan-x;
  -webkit-user-drag: none;
  user-select: none;
}"""

# ---------------------------------------------------------------------------
# 3. The cleaner. One function, in front of the escaping every renderer already
#    does, so no panel needs to change.
# ---------------------------------------------------------------------------
BRIEF_OLD = """  function scClBrief(it){
    if(it && typeof it === 'object') return String(it.brief || '');
    return String(it == null ? '' : it);
  }"""

BRIEF_NEW = """  // 80.6.2 - A NOTE IS A SENTENCE, NOT MARKUP. Notes are allowed to carry
  // emphasis, and 171 of them in this page do - but every renderer escapes what it
  // paints (correctly: notes are data), so the tags arrived on screen as the
  // literal characters and `&mdash;` arrived as its own name.
  //
  // This strips the handful of tags the changelog uses, decodes the handful of
  // entities it uses, and leaves the escaping to the renderer that was already
  // doing it. `&amp;` is decoded LAST, so a note that legitimately says "&amp;lt;"
  // cannot end up as a tag after the pass.
  function scNoteText(s){
    var t = String(s == null ? '' : s);
    t = t.replace(/<\\s*br\\s*\\/?\\s*>/gi, ' ');
    t = t.replace(/<\\/?\\s*(?:b|strong|i|em|code|small|span)\\b[^>]*>/gi, '');
    // A note may TALK about a tag - "the seam is the <svg> inside the button".
    // Those keep their name and lose their brackets, so the sentence stays true
    // and the screen never shows markup. Only names a note is likely to mention
    // are matched, so an ordinary "5 < 6" is left alone.
    t = t.replace(/<\\/?\\s*(?:svg|div|input|audio|video|img|path|style|script)\\b[^>]*>/gi, '$1');
    // Placeholders too: a note may say lyricWords_<track> or "<Song> - Single",
    // and those brackets look like markup on screen even though the word inside
    // is the point. The word stays, the brackets go. A bare comparison ("5 < 6")
    // is left alone because it has no closing bracket to pair with.
    t = t.replace(/<\\/?\\s*([A-Za-z][\\w .#'-]{0,23})\\s*\\/?>/g, '$1');
    var ents = {
      '&mdash;': '\\u2014', '&ndash;': '\\u2013', '&rarr;': '\\u2192', '&larr;': '\\u2190',
      '&hellip;': '\\u2026', '&middot;': '\\u00b7', '&nbsp;': ' ', '&quot;': '"',
      '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>'
    };
    t = t.replace(/&(?:[a-zA-Z]+|#\\d+);/g, function(m){
      var k = m.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ents, k) ? ents[k] : m;
    });
    t = t.replace(/&amp;/gi, '&');
    return t;
  }
  function scClBrief(it){
    if(it && typeof it === 'object') return scNoteText(it.brief || '');
    return scNoteText(it == null ? '' : it);
  }"""


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'The patch notes are just words again. Some notes carried emphasis, and every panel escaped them before painting &mdash; so the tags turned up on screen as the literal characters instead of the sentence they were wrapped around. The emphatic words stay, the brackets are gone, and that holds for every note in the history, not only the new ones.',
        'The same pass decodes the handful of named characters the notes use, so a dash is a dash instead of the name of a dash.',
        'The <b>settings tabs</b> scroll properly now. The strip used to re-snap itself under your finger on a slow drag; it moves with the momentum your phone gives it and stays where you leave it, and the tab you open still glides to the centre.',
        'Nothing else moved &mdash; the widget, the glass, the dial, the player and the library are exactly as they were.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'Plain notes, and a settings strip that scrolls like paper', body))


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-8062: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', steps cleared and notes plain')
        print('patch-8062%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8062 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8062: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, STRIP_OLD, STRIP_NEW, 'the settings tab strip')
    page = swap(page, TAB_OLD, TAB_NEW, 'a tab in the strip')
    page = swap(page, BRIEF_OLD, BRIEF_NEW, 'scClBrief (the cleaner goes above it)')

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "var SC_IS_WEB = (function(){",
                "// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8062: the page did not end up 80.6.2 (%s)' % why)
    # The snap assertions are scoped to the settings strip on purpose: the dock
    # and the pinned-artists row keep their own snapping, and a global "must not
    # contain" would either fail on them or, worse, be quietly dropped.
    strip_at = page.index('#settingsTabStrip {')
    strip_block = page[strip_at:page.index('}', strip_at) + 1]
    if 'scroll-snap-type: x proximity;' in strip_block or 'scroll-snap-align' in strip_block:
        sys.exit('patch-8062: the settings strip still snaps')
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8062: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8062: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the free strip and its pan-x children, the note cleaner, the changelog head, '
          'the version and the shell cache')
    print('patch-8062: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.6.2';", 'the page runs 80.6.2'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.2', date:", 'the changelog records the release'),
    ('scroll-snap-type: none;', 'the strip no longer snaps under the finger'),
    ('scroll-behavior: smooth;', 'and its own scrolls glide'),
    ('  touch-action: pan-x;\n  -webkit-user-drag: none;', 'a tab is a drag handle, not an image'),
    ('function scNoteText(s){', 'the note cleaner is in the page'),
    ("if(it && typeof it === 'object') return scNoteText(it.brief || '');",
     'every note goes through it'),
]

GONE = [
    ("const APP_VERSION = '80.6.1';", 'the old version constant'),
]


if __name__ == '__main__':
    sys.exit(main())
