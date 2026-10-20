#!/usr/bin/env python3
"""80.0 - "Massive Revamp": the whole release in one idempotent patch.

WHAT THIS DOES, in order:
  1. APP_VERSION -> 80.0 and the service-worker shell cache -> v80.0, so no
     browser can keep serving the 75.1.2 shell after the update.
  2. Splices dev/revamp-800.css into a <style id="sc80Css"> before </head>.
  3. Splices dev/revamp-800.js into a <script> before </body>: the fourth
     top-level block (milestones, the Studio/Tools split, the pinned layout
     switch, the cloud layout, the glide transitions).
  4. Adds the 80.0 changelog entry, whose notes are {brief, detail} pairs.
  5. Teaches the notes renderers to draw a brief with the detail under it, and
     keeps every pre-80.0 entry a plain one-line bullet.
  6. Stops the library tab strip drawing "Unsorted" twice.

Idempotent: every step is a no-op once applied. `--check` reports instead of
writing, and exits 1 when the tree is not on 80.0 yet.

  python3 dev/patch-800.py
  python3 dev/patch-800.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv

VERSION = '80.0'
PREV = '75.1.2'
CACHE = 'sidecut-shell-v%s' % VERSION

ENTRY = """  { version: '80.0', date: 'October 20, 2026 \\u00b7 4:45 PM EDT', title: 'Massive Revamp Update', items: [
    'Hitting a streak milestone now opens the app with a celebration made for that number - 3, 7, 30, 50, 100 and up.',
    'Every milestone you have reached is saved in Studio with its date, and any of them can be replayed from there.',
    'Studio is split down a diagonal into Studio and Tools, so creative work and everything else stop sharing one list.',
    'Tools holds badges and rewards, the storage cleaner, Auto-DJ, gestures, the batch tag editor and batch on selected.',
    'The pinned artists rail glides now - a slow swipe settles on a chip edge and a fast flick is left alone.',
    'Pinned artists can be eight smaller squares in a 2 x 4 window instead of four in a row, and either one is a setting.',
    'Switching tabs glides: the pill dock highlight slides between the pills and the active library tab scrolls itself into the middle.',
    'A second layout, Cloud bubbles: round floating bubbles, the dock down the right side, and a small now bar in the top right.',
    'In Cloud the notifications, refresh and Settings buttons move onto the listening-stats bubble, and the your files no ads line is gone.',
    'The original layout is the default and is always one tap away, from Settings, More or from Studio, Tools.',
    'Unsorted no longer appears twice in the library tab strip.',
    'Computers, tablets and foldables get the room they have, and every pane keeps a readable measure.',
    'Nothing else moved: the home-screen widget, the player, the letter-by-letter lyrics and the albums are exactly where 75.1.2 left them.',
  ], details: [
    'The first start after the milestone plays a full-screen card: the number, the rings, the confetti and a line that says what the streak is. It plays once per milestone, so it is a moment rather than a nag, and the ones that matter most - 50, 100, 365 - are the ones that fill the screen.',
    'Studio, Tools, Milestones lists all sixteen milestones from 3 days to 1000, marks the ones reached, shows your best streak and puts a Replay button on every one. A preview button plays the 100-day animation before you have earned it, so you can see what is coming.',
    'The tab bar is one pill cut corner to corner from the bottom right to the top left, the same diagonal the Library pill has used since 70.0. Studio keeps DJ Mode, Crop, Edit rack, Ringtone and clip, Clean up, Slowed and reverb, Karaoke, Sampler pads, Loop recorder, Sleep timer and Practice loop. Tools takes the rest. Nothing about songs, playlists or albums changes here - this is the same Studio in two halves.',
    'Nothing was removed and nothing lost a feature: each section moved with its contents, its saved fold state and its wiring intact, and the tab you were last on is remembered on the next launch. The Look and feel switches live there too, next to the milestones.',
    'The rail had snap proximity with no scroll behaviour, so a nudge jumped instead of gliding and the snap fought a flick that crossed three artists. It scrolls smoothly, a mouse wheel over it moves the rail instead of the page, and the snap only engages once the scroll is already slowing down.',
    'Eight squares fills the width with four columns and shows two rows, scrolling for a ninth pin and beyond - nothing is capped. Four in a row is the default and is exactly what 75.1.2 shipped. The switch is in Settings, More, The new look, and again in Studio, Tools, Look and feel.',
    'The dock has one highlight layer that moves by transform, so a tab change is a single composited movement instead of four repaints, and the pill and tab colours cross-fade over 280 ms instead of cutting. On the library strip the selected tab is scrolled into view whenever the strip changes.',
    'Home bubbles become circles that drift a few pixels on a slow loop, the four tabs leave the bottom edge and float as a vertical glass dock on the right, and the player keeps the bottom while a small now bar sits in the top right with the track, the artist and play/pause.',
    'The three header buttons become small round bubbles on the stats card, in the same row as the Ask SideCut sparkle, and they forward the real clicks, so notifications, a refresh and Settings behave exactly as before. If the stats bubble is hidden they land on the greeting row instead, so Settings can never be unreachable.',
    'Classic tabs is what a fresh install gets and what an update keeps unless you choose otherwise. Both switches are live: the page changes where you stand, no restart, and every saved song, playlist and setting is untouched.',
    'The strip drew the virtual Unsorted tab and then walked the playlists object, which holds a real Unsorted entry created the first time a song had no playlist - two tabs with the same name over the same view. The stored entry is skipped by name now, so the virtual tab is the only one that renders.',
    'Breakpoints at 600, 760 and 1000 pixels put the bubble cloud three or four across and centre the panes, a landscape phone rule shrinks the right-hand dock so it does not eat the screen, and patch notes hang their detail under the sentence instead of widening the line.',
    'Studio is the same tools in two tabs, the pill dock still glides, the player, the widget, the letter-by-letter lyrics and the albums are untouched, and every saved song, playlist, setting and backup is exactly where it was. If the revamp is not for you, Classic tabs in Settings, More puts the whole app back the way 75.1.2 had it.',
  ]},
"""

# --- the notes renderers ------------------------------------------------------
# A note is either a string (every release before 80.0) or {brief, detail}.
# changelogItems() keeps returning STRINGS so every existing caller - counts,
# the summary glance, the share text - is untouched; the two panels that can
# afford a drop-down use changelogRich() and draw scClItemHtml().
OLD_ITEMS = """  function changelogItems(entry){
    var list = (entry && entry.items) || [];
    var out = [];
    var _isPlay = scIsPlayBuild();
    for(var _ci = 0; _ci < list.length; _ci++){
      var it = list[_ci];
      if(typeof it === 'string' && it.indexOf('[FULL] ') === 0){
        if(_isPlay) continue;
        it = it.slice(7);
      }
      if(_isPlay && scHidesOnPlay(it)) continue;
      out.push(it);
    }
    return out;
  }
"""

NEW_ITEMS = """  // 80.0 - a note can be one sentence plus a longer explanation. The sentence is
  // the bullet; the explanation opens under it. A bare string still works, so
  // every entry before 80.0 renders exactly as it did.
  function scClBrief(it){
    if(it && typeof it === 'object') return String(it.brief || '');
    return String(it == null ? '' : it);
  }
  function changelogRich(entry){
    // items stays an array of STRINGS, one sentence each, because every gate and
    // every older panel reads it as strings. The longer explanation rides in a
    // parallel `details` array, index for index, so nothing that reads a note has
    // to know a drop-down exists.
    var list = (entry && entry.items) || [];
    var more = (entry && entry.details) || [];
    var out = [];
    var _isPlay = scIsPlayBuild();
    for(var _ci = 0; _ci < list.length; _ci++){
      var it = list[_ci];
      var brief = scClBrief(it);
      var detail = String(more[_ci] || '');
      if(brief.indexOf('[FULL] ') === 0){
        if(_isPlay) continue;
        brief = brief.slice(7);
      }
      if(_isPlay && scHidesOnPlay(brief)) continue;
      out.push(detail ? { brief: brief, detail: detail } : brief);
    }
    return out;
  }
  function changelogItems(entry){
    return changelogRich(entry).map(scClBrief);
  }
  // One bullet. With a detail the bullet is the summary of a <details>, so the
  // notes stay one line each until somebody asks for more.
  function scClItemHtml(it){
    var brief = scClBrief(it);
    var detail = (it && typeof it === 'object') ? String(it.detail || '') : '';
    if(!detail){
      return '<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">\\u2022</span><span>' + escapeHtml(brief) + '</span></div>';
    }
    return '<details class="sc-cl-item"><summary><span class="sc-cl-bullet">\\u2022</span><span>' + escapeHtml(brief) +
      '</span><span class="sc-cl-chev">\\u25be</span></summary><div class="sc-cl-detail">' + escapeHtml(detail) + '</div></details>';
  }
"""

OLD_WHATSNEW = """  function renderWhatsNewBody(entry){
    return changelogItems(entry).map(i => `
      <div style="display:flex; gap:8px; align-items:flex-start;">
        <span style="color:var(--coral); flex-shrink:0;">\u2022</span><span>${escapeHtml(i)}</span>
      </div>
    `).join('');
  }
"""

NEW_WHATSNEW = """  function renderWhatsNewBody(entry){
    return changelogRich(entry).map(scClItemHtml).join('');
  }
"""

OLD_ITEM_HTML = ('${changelogItems(entry).map(i => `<div style="display:flex; gap:8px;">'
                 '<span style="color:var(--coral); flex-shrink:0;">\u2022</span>'
                 '<span>${escapeHtml(i)}</span></div>`).join(\'\')}')
NEW_ITEM_HTML = '${changelogRich(entry).map(scClItemHtml).join(\'\')}'

# --- 6. the duplicate Unsorted tab -------------------------------------------
OLD_TAB_LOOP = """    Object.keys(playlists).forEach(name => {
      if(hiddenPlaylists.has(name) && name !== activePlaylist) return;
"""
NEW_TAB_LOOP = """    Object.keys(playlists).forEach(name => {
      // 80.0 - "Unsorted" is a real key in playlists (the bucket a song with no
      // playlist lands in) AND a virtual tab drawn below, right after All Songs.
      // Walking the object drew the stored one as well, so the strip showed two
      // tabs called Unsorted over the same view. The stored key is storage, not
      // a tab: skip it here and let the virtual one be the only one.
      if(name === 'Unsorted') return;
      if(hiddenPlaylists.has(name) && name !== activePlaylist) return;
"""


def read(name):
    return open(os.path.join(ROOT, name), encoding='utf-8').read()


def write(name, text):
    open(os.path.join(ROOT, name), 'w', encoding='utf-8').write(text)


def patch_index(src):
    css = read(os.path.join('dev', 'revamp-800.css'))
    js = read(os.path.join('dev', 'revamp-800.js'))

    src = src.replace("const APP_VERSION = '%s';" % PREV,
                      "const APP_VERSION = '%s';" % VERSION, 1)

    # The CSS and the module are spliced in from their own files, and RE-spliced
    # when those files change: the file is the source of truth, so iterating on a
    # rule means editing dev/revamp-800.css and running this again, never editing
    # index.html by hand and letting the two drift.
    def splice(src, open_tag, close_tag, body, where_close):
        if open_tag in src:
            a = src.index(open_tag) + len(open_tag)
            b = src.index(close_tag, a)
            if src[a:b].strip() != body.strip():
                return src[:a] + '\n' + body + '\n' + src[b:]
            return src
        if where_close not in src:
            raise SystemExit('patch-800: no %s in index.html' % where_close)
        return src.replace(where_close, open_tag + '\n' + body + '\n' + close_tag + '\n' + where_close, 1)

    src = splice(src, '<style id="sc80Css">', '</style>', css, '</head>')
    src = splice(src, '<script id="sc80Module">', '</script>', js, '</body>')

    if "{ version: '%s'" % VERSION not in src:
        needle = "  { version: '%s', date:" % PREV
        if needle not in src:
            raise SystemExit('patch-800: the %s changelog entry is missing' % PREV)
        src = src.replace(needle, ENTRY + needle, 1)

    if 'function changelogRich(' not in src:
        if OLD_ITEMS not in src:
            raise SystemExit('patch-800: changelogItems is not the expected text')
        src = src.replace(OLD_ITEMS, NEW_ITEMS, 1)

    if OLD_WHATSNEW in src:
        src = src.replace(OLD_WHATSNEW, NEW_WHATSNEW, 1)

    if OLD_ITEM_HTML in src:
        src = src.replace(OLD_ITEM_HTML, NEW_ITEM_HTML)

    if "if(name === 'Unsorted') return;" not in src:
        if OLD_TAB_LOOP not in src:
            raise SystemExit('patch-800: the tab loop is not the expected text')
        src = src.replace(OLD_TAB_LOOP, NEW_TAB_LOOP, 1)

    return src


def patch_sw(src):
    return src.replace("const CACHE_NAME = 'sidecut-shell-v%s';" % PREV,
                       "const CACHE_NAME = '%s';" % CACHE, 1)


def main():
    changed = []
    for name, fn in (('index.html', patch_index), ('sw.js', patch_sw)):
        before = read(name)
        after = fn(before)
        if after != before:
            changed.append(name)
            if not CHECK:
                write(name, after)

    if CHECK:
        if changed:
            print('patch-800 --check: not applied (' + ', '.join(changed) + ')')
            return 1
        print('patch-800 --check: the page is on %s' % VERSION)
        return 0

    print('patch-800: %s' % ('edited ' + ', '.join(changed) if changed else 'already applied'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
