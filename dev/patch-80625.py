#!/usr/bin/env python3
"""80.6.25 - the rail holds still, and your downloaded songs are one tap away.

    python3 dev/patch-80625.py
    python3 dev/patch-80625.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.25'
OLD = '80.6.24'
MARKER = '80.6.25 - NO GLYPH IS REPLACED'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80625: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- 1. the pill stops blurring the page it floats over ---------------------
# A position:fixed pill with a backdrop-filter sits on a scrolling list: every
# frame the list moves, the pill's backdrop is re-sampled. On an Android WebView
# that is the judder the owner reports as the buttons moving, and it is the same
# "settled visibly" symptom 80.6.23 named. The pill is nearly opaque anyway, so
# the blur buys nothing and costs a repaint per scroll frame.
swap('the rail is a solid pill, not a blurred one',
     "      'background:color-mix(in srgb, var(--bg-raised) 84%, transparent);',\n"
     "      'border:1px solid var(--line);box-shadow:0 10px 26px rgba(0,0,0,.28);',\n"
     "      'backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2)}',\n",
     "      // 80.6.25 - NO BLUR BEHIND A FIXED PILL. A fixed layer with a\n"
     "      // backdrop-filter over a scrolling list re-samples its backdrop on every\n"
     "      // frame the list moves, and on a WebView the pill visibly judders while a\n"
     "      // thumb scrolls the songs under it. At 96% the background is the pill.\n"
     "      'background:color-mix(in srgb, var(--bg-raised) 96%, #000);',\n"
     "      'border:1px solid var(--line);box-shadow:0 10px 26px rgba(0,0,0,.28)}',\n")

# -- 2. room for two icons in one glyph -------------------------------------
swap('two icons share the switch',
     "      '#scShelfRail .scshelf-src.s-on::after{content:\"\";position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:999px;background:var(--coral)}',\n",
     "      '#scShelfRail .scshelf-src.s-on::after{content:\"\";position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:999px;background:var(--coral)}',\n"
     "      // 80.6.25 - BOTH HALVES OF THE SWITCH ARE BUILT ONCE, and one is shown. The\n"
     "      // glyph used to be re-written as innerHTML on every mark, which replaces the\n"
     "      // node the thumb is on and repaints a fixed pill from the inside out.\n"
     "      '#scShelfRail .scshelf-src > span{display:none;line-height:0}',\n"
     "      '#scShelfRail .scshelf-src > span.on{display:block}',\n")

# -- 3. the switch is built with both icons --------------------------------
swap('the switch owns both icons from birth',
     "      h += '<button type=\"button\" class=\"scshelf-tab scshelf-src\" data-src=\"1\"' +\n"
     "        ' aria-pressed=\"false\" aria-label=\"On device\" title=\"On this device\">' + scIcon('device', 17) + '</button>';\n",
     "      h += '<button type=\"button\" class=\"scshelf-tab scshelf-src\" data-src=\"1\"' +\n"
     "        ' aria-pressed=\"false\" aria-label=\"On device\" title=\"On this device\">' +\n"
     "        '<span class=\"scshelf-i scshelf-i-str\">' + scIcon('stream', 17) + '</span>' +\n"
     "        '<span class=\"scshelf-i scshelf-i-dev on\">' + scIcon('device', 17) + '</span>' +\n"
     "        '</button>';\n")

# -- 4. marking moves a class, and the icon says where a tap goes ----------
swap('the mark moves, nothing is replaced',
     "      if(b.getAttribute('data-src') === '1'){\n"
     "        var s = (scShelf.src === 's');\n"
     "        b.className = 'scshelf-tab scshelf-src' + (s ? ' s-on' : '');\n"
     "        b.innerHTML = scIcon(s ? 'stream' : 'device', 17);\n"
     "        b.setAttribute('aria-pressed', s ? 'true' : 'false');\n"
     "        b.setAttribute('aria-label', s ? 'Streaming' : 'On device');\n"
     "        b.setAttribute('title', s ? 'Streaming - tap to show what is on this device' : 'On this device - tap to stream');\n"
     "        return;\n"
     "      }\n"
     "      var on = (b.getAttribute('data-shelf') === scShelf.page);\n"
     "      b.className = 'scshelf-tab' + (on ? ' on' : '');\n"
     "      b.setAttribute('aria-pressed', on ? 'true' : 'false');\n",
     "      if(b.getAttribute('data-src') === '1'){\n"
     "        // 80.6.25 - NO GLYPH IS REPLACED. Both icons were built with the rail and\n"
     "        // this only chooses which one is drawn, so the node under the thumb keeps\n"
     "        // its identity and nothing is written into the pill when it is tapped.\n"
     "        var s = (scShelf.src === 's');\n"
     "        var swcls = 'scshelf-tab scshelf-src' + (s ? ' s-on' : '');\n"
     "        if(b.className !== swcls) b.className = swcls;\n"
     "        // 80.6.25 - THE ICON IS THE DESTINATION, NOT THE STATE. It used to show where\n"
     "        // you already were, so the arrow that means \"your downloaded songs\" was the\n"
     "        // one thing on screen when they were out of reach. On the source the switch\n"
     "        // now shows that arrow; on the device it shows the waveform the source is.\n"
     "        var dev = b.querySelector('.scshelf-i-dev'), str = b.querySelector('.scshelf-i-str');\n"
     "        if(dev){ var dcls = 'scshelf-i scshelf-i-dev' + (s ? ' on' : ''); if(dev.className !== dcls) dev.className = dcls; }\n"
     "        if(str){ var scls = 'scshelf-i scshelf-i-str' + (s ? '' : ' on'); if(str.className !== scls) str.className = scls; }\n"
     "        b.setAttribute('aria-pressed', s ? 'true' : 'false');\n"
     "        b.setAttribute('aria-label', s ? 'On this device' : 'Streaming');\n"
     "        b.setAttribute('title', s ? 'On this device - your downloaded songs' : 'Streaming - songs from the source');\n"
     "        return;\n"
     "      }\n"
     "      var on = (b.getAttribute('data-shelf') === scShelf.page);\n"
     "      var markcls = 'scshelf-tab' + (on ? ' on' : '');\n"
     "      if(b.className !== markcls) b.className = markcls;\n"
     "      b.setAttribute('aria-pressed', on ? 'true' : 'false');\n")

# -- 5. Library and Albums mean the songs on this phone --------------------
swap('Library and Albums leave the source',
     "    var page = (tab === 'albums') ? 'albums' : 'library';\n"
     "    // 80.6.23 - A PAGE THAT IS ALREADY UP IS NOT DRAWN AGAIN. Tapping the page you are\n"
     "    // on is not a request for it, and repainting it is the rest of the same flicker.\n"
     "    if(page === scShelf.page && scShelf.src === 'd' && !scShelf.open){ scShelfMark(); return; }\n"
     "    scShelf.page = page;\n"
     "    scShelfApply();\n",
     "    var page = (tab === 'albums') ? 'albums' : 'library';\n"
     "    // 80.6.23 - A PAGE THAT IS ALREADY UP IS NOT DRAWN AGAIN. Tapping the page you are\n"
     "    // on is not a request for it, and repainting it is the rest of the same flicker.\n"
     "    if(page === scShelf.page && scShelf.src === 'd' && !scShelf.open){ scShelfMark(); return; }\n"
     "    // 80.6.25 - THE PAGE GLYPHS ARE THE DEVICE'S. Library and Albums name what is on\n"
     "    // this phone, but with the switch on the source they drew the streaming set\n"
     "    // instead - so the downloaded songs could not be reached from the two glyphs that\n"
     "    // are named after them. A tap on either one now leaves the source.\n"
     "    scShelf.page = page;\n"
     "    scShelf.src = 'd';\n"
     "    scShelfApply();\n")

# -- 6. flipping back to the device lands on the songs ---------------------
swap('the device side always lands on the song list',
     "    if(scShelf.src === want){ scShelfMark(); return; }\n"
     "    scShelf.src = want;\n"
     "    scShelfApply();\n",
     "    if(scShelf.src === want){ scShelfMark(); return; }\n"
     "    scShelf.src = want;\n"
     "    // 80.6.25 - THE DEVICE SIDE IS THE SONG LIST. Flipping back kept whichever page\n"
     "    // was up, so coming from streaming albums landed on device albums and the\n"
     "    // downloaded songs were still two taps away. The source side keeps its page;\n"
     "    // the device side comes home to the songs.\n"
     "    if(want === 'd') scShelf.page = 'library';\n"
     "    scShelfApply();\n")

# -- 7. the release itself -------------------------------------------------
swap('the version moves',
     "  const APP_VERSION = '%s';" % OLD,
     "  const APP_VERSION = '%s';" % VERSION)

# 80.6.25 - THE STAMP IS COMPUTED, NOT TYPED. 80.6.24 was the release that had to
# repair twelve hand-written dates: every 80.x entry names the Eastern wall clock of
# the moment it landed, and the only clock that knows that is the one that applies
# the payload. EDT or EST comes off the date itself, so November needs no one's help.
def eastern():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.6.25 - THE RAIL HOLDS STILL, AND THE SONGS ARE ONE TAP AWAY. The owner, after\n"
    "  // 80.6.23: the side buttons keep moving, and they will not let him at his downloaded\n"
    "  // songs. Both are the rail: a fixed, blurred pill over a scrolling list, and two page\n"
    "  // glyphs that drew the streaming set while the switch was on the source.\n"
    "  { version: '80.6.25', date: '{{STAMP}}', title: 'The side rail holds still, and your songs are one tap away', items: [\n"
    "    '[FULL] Library and Albums on the side rail are your own songs again. A tap on either one leaves the source and lands on what is downloaded, so the two glyphs named after your library open your library.',\n"
    "    '[FULL] The switch says where a tap takes you - a device arrow for your downloaded songs, a waveform for the source - instead of showing where you already are.',\n"
    "    '[FULL] The rail stopped moving under your thumb: the pill no longer blurs the songs behind it, and tapping a glyph marks it by changing a colour instead of redrawing the pill.',\n"
    "    '[FULL] Coming back from streaming always lands on your songs, not on whichever page you left.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
swap('the changelog records the release',
     "  // 80.6.24 - THE PATCH NOTES CARRY THE DAY AND THE TIME.",
     ENTRY + "  // 80.6.24 - THE PATCH NOTES CARRY THE DAY AND THE TIME.", expect=1)

if failed:
    print('patch-80625: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80625: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80625: %d steps applied, page is %s' % (len(applied), VERSION))
