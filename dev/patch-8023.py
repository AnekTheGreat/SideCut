#!/usr/bin/env python3
"""80.2.3 - the award card plays for plays too, and it is a bigger card every time.

The owner:

  "make the like awards popup screen show up for hitting records in plays too like
   100 and 200, 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000 ect... make them
   better every time"

The card already existed: 80.0 built it for streak milestones - a full-screen
celebration with rings, confetti and a line about the number. This release earns it
with plays as well:

  1. THE LADDER. PLAY_MILESTONES is 100, 200, 500, 1,000, 2,000, 3,000, 4,000,
     5,000, 7,500 and 10,000, and past the last named rung the ladder keeps going in
     steps of 5,000 up to 100,000, so "ect..." really is open-ended.
  2. THE CARD. celebratePlays paints the same overlay a streak gets, wearing a medal
     (Bronze, Silver, Gold, Platinum, Diamond) and a ceremony that grows with it -
     more rings, more bits, a warmer glow - so every rung is a better card than the
     one before it.
  3. THE TRIGGER. The app's own commitPlay calls SC80.checkPlays() right after it
     counts a play; a start and a return to the foreground check the same rung, for a
     play counted with the screen off. The highest rung crossed gets the card and the
     ones below it are recorded quietly, so nothing ever queues nine popups.
  4. THE RECORD. Every rung earned is kept in localStorage and listed in Studio,
     Tools, Milestones - with the next rung, how far along it is, and a Replay.

The new text lives in dev/patch-8023-text.py and dev/patch-8023-text-c.py, loaded by
path: the page is one 3.5 MB file and a payload travels through an API call, so the
copy travels as small constants and this script does the cutting, with a check on
every anchor before it cuts.

Idempotent: the marker is the plays celebration itself.

    python3 dev/patch-8023.py
    python3 dev/patch-8023.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.3'
MARKER = 'function celebratePlays(plays, opts){'
TEXT = os.path.join(ROOT, 'dev', 'patch-8023-text.py')
TEXT_C = os.path.join(ROOT, 'dev', 'patch-8023-text-c.py')

# What this release has to have left in the page, once the edit has landed.
CLAIMS = [
    ("const APP_VERSION = '80.2.3';", 'the page runs 80.2.3'),
    (MARKER, 'the plays celebration is in the page'),
    ('var PLAY_MILESTONES = [100, 200, 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000];',
     'the ladder starts at a hundred and names every rung the owner asked for'),
    ('function playRungs(){', 'and it keeps going past ten thousand'),
    ('function celebratePlays(plays, opts){', 'the card is earned by plays'),
    ("host.querySelector('.sc80-ms-kicker').textContent = 'Award';", 'it says Award, not Milestone'),
    ('function paintCeremony(host, tier){', 'the ceremony is painted per tier'),
    ('function checkPlays(opts){', 'the rung check exists'),
    ('function playsCard(){', 'Studio has a Plays block'),
    ('data-sc80-plays="', 'with a Replay per rung'),
    ("try{ if(window.SC80 && typeof SC80.checkPlays === 'function') SC80.checkPlays(); }catch(_eAward){}",
     'the app play counter tips the card'),
    ('.sc80-ms-medal{', 'the medal has its stylesheet'),
    ('playMilestones: playRungs(),', 'the plays ladder is published for a gate'),
]


def load_text():
    # Two small modules, one namespace: the new text a release carries is split so
    # each part travels in its own API call.
    ns = {'__name__': 'sc_patch_8023_text'}
    for path in (TEXT, TEXT_C):
        spec = importlib.util.spec_from_file_location('sc_patch_8023_text_part', path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        ns.update({k: v for k, v in vars(mod).items() if not k.startswith('__')})
    return type('Sc8023Text', (), ns)


def cut(src, start, end, replacement, what):
    i = src.find(start)
    if i < 0:
        raise SystemExit('patch-8023: %s is not in the page (start anchor)' % what)
    j = src.find(end, i)
    if j < 0:
        raise SystemExit('patch-8023: %s is not in the page (end anchor)' % what)
    return src[:i] + replacement + src[j + len(end):]


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8023: %s appears %d times, expected once' % (what, src.count(old)))
    return src.replace(old, new, 1)


def apply_all(src):
    t = load_text()
    # 1. THE STYLESHEET for the medal and the five tiers.
    hint = '.sc80-ms-hint{ font-size: 10.5px; color: var(--ink-dim); margin-top: 10px; opacity: 0.8; }\n'
    src = swap(src, hint, hint + '\n' + t.CSS, 'the milestone stylesheet')
    # 2. THE BITS TAKE A COUNT, so a bigger award can throw more of them.
    src = swap(src, t.BITS_OLD, t.BITS_NEW, 'the falling bits')
    # 3. THE MEDAL GOES ON THE CARD, under its kicker.
    src = swap(src, t.CARD_OLD, t.CARD_NEW, 'the card markup')
    # 4. THE CELEBRATION, the plays ladder and the whole award.
    src = cut(src, '  function celebrate(days, opts){',
              '    if(!opts.manual) markCelebrated(days);\n    return true;\n  }\n',
              t.CELEBRATE_NEW, 'the celebration')
    # 5. A START CHECKS THE PLAY RUNGS TOO.
    src = swap(src, t.BOOT_OLD, t.BOOT_NEW, 'the milestone boot')
    src = swap(src, t.START_OLD, t.START_NEW, 'the start wiring')
    # 6. AND SO DOES THE STUDIO CARD.
    src = swap(src, t.CARD_INSERT_OLD, t.CARD_INSERT_NEW, 'the Studio tools pane')
    src = swap(src, t.WIRE_SEL_OLD, t.WIRE_SEL_NEW, 'the card click delegation')
    src = swap(src, t.WIRE_ELSE_OLD, t.WIRE_ELSE_NEW, 'the path replay handler')
    # 7. THE STATE, AND THE DOOR A GATE KNOCKS ON.
    src = swap(src, t.LS_OLD, t.LS_NEW, 'the stored keys')
    src = swap(src, t.EXPORT_OLD, t.EXPORT_NEW, 'the SC80 exports')
    # 8. THE APP'S OWN PLAY COUNTER TIPS THE CARD.
    src = swap(src, t.HOOK_OLD, t.HOOK_NEW, 'the play counter')
    # 9. THE RELEASE ITSELF.
    src = swap(src, "  { version: '80.2.2', date:", t.CHANGELOG_HEAD + "  { version: '80.2.2', date:",
               'the changelog head')
    src = swap(src, "  const APP_VERSION = '80.2.2';", "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src, t


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the plays awards and the page runs as ' + VERSION)
        print('patch-8023%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8023 --check: the release is pending, 15 steps to apply')
        return 1
    if 'function celebrate(days, opts){' not in page or 'sc80Milestones' not in page:
        sys.exit('patch-8023: the page is not the shape this release expects (no streak celebration to share)')
    page, _t = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8023: the page did not end up 80.2.3 (%s)' % ', '.join(missing))
    open(page_path, 'w', encoding='utf-8').write(page)
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v80.2.2'" not in sw:
        sys.exit('patch-8023: the shell cache is not the 80.2.2 one')
    open(sw_path, 'w', encoding='utf-8').write(sw.replace("'sidecut-shell-v80.2.2'", "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the ladder, the medal, the ceremony, the card, the check and the notes')
    print('patch-8023: 15 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
