#!/usr/bin/env python3
"""
74.1.5 - the two gates that ask the head changelog entry for an OLDER release's
words now read their OWN entry instead.

WHAT WAS WRONG. dev/test-740.mjs describes 74.0 and asserts the head entry's notes
say the owner's 74.0 ask ("the skip button and the album"); dev/test-741.mjs
describes 74.1 and asserts the head names the restored play and the back roll.
Both read `entries[0]` - the HEAD. The repin moves the head pin under them in
every release, so at 74.1.5 they were asking THIS release's notes (the artist
bubble and the storage cleaner) for the LAST TWO releases' words. That is a red
gate battery, and the notes are right and the gates are wrong: a later release
must never be made to carry an older one's words. AGENTS.md lays the rule down
("a gate that describes a release must read its own entry by version") and 71.8
fixed dev/test-705.mjs exactly this way.

THE FIX. Each gate finds the entry for the release it describes by version and
asserts against that. The assertion itself is untouched: test-740 still requires
74.0's notes to name the skip and the album, test-741 still requires 74.1's to
name the back roll and the restored play. Nothing is weakened and nothing is
dropped - one new check per file proves the own entry is still in the changelog,
so a future release that drops it fails here instead of quietly passing.

It is idempotent: every edit first looks for its own output and skips when the
file already carries it.

  python3 dev/retarget-own-7415.py            # apply
  python3 dev/retarget-own-7415.py --check    # report only, exit 1 if behind
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv

PINS_NEEDLE = (
    "const VER = '74.1.5'; /* repinned by dev/repin-7415.mjs */\n"
    "const PREV = '74.1'; /* repinned by dev/repin-7415.mjs */"
)


def pins(own, why):
    return (
        "// " + own + ": THE RELEASE THIS GATE DESCRIBES, so the ask below reads " + own + "'s OWN\n"
        "// entry by version. It read the head until 74.1.5, which held only while the head was\n"
        "// still about " + why + " - see the retarget at the ask.\n"
        "const OWN = '" + own + "';\n"
        "const VER = '74.1.5'; /* repinned by dev/repin-7415.mjs; the ask below reads OWN */\n"
        "const PREV = '74.1'; /* repinned by dev/repin-7415.mjs */"
    )


EDITS = [
    (
        'dev/test-740.mjs',
        '74.0',
        [
            (PINS_NEEDLE, pins('74.0', 'the player')),
            (
                "    // The ask of THIS release, in the head: the skip button and the album.\n"
                "    ok(/skip/i.test(notes) && /next album/i.test(notes), 'and the notes say what the owner asked for');",
                "    // 74.1.5 RETARGETED THIS LINE. It asked the HEAD entry for 74.0's words, which\n"
                "    // held only while the head was still about the player; at 74.1.5 the head is the\n"
                "    // artist bubble and the storage cleaner. The question moved to the release this\n"
                "    // gate describes - the same fix 71.8 gave test-705. The bar is unchanged: 74.0's\n"
                "    // notes still have to name the skip and the album.\n"
                "    const own = entries.find((e) => String(e.version) === OWN);\n"
                "    const ownNotes = ((own && own.items) || []).join('\\n');\n"
                "    ok(!!own, 'the entry this gate describes is still in the changelog (' + OWN + ')');\n"
                "    ok(/skip/i.test(ownNotes) && /next album/i.test(ownNotes), 'and the notes say what the owner asked for');",
            ),
        ],
        'ownNotes',
    ),
    (
        'dev/test-741.mjs',
        '74.1',
        [
            (PINS_NEEDLE, pins('74.1', 'the button roll')),
            (
                "    // The two halves of the report, named in the head.\n"
                "    ok(/back/i.test(notes), 'the notes say back rolls');\n"
                "    ok(/restored|reopened/i.test(notes), 'and name the play that came back without its album');",
                "    // 74.1.5 RETARGETED THESE TWO. They asked the HEAD entry for 74.1's words, which\n"
                "    // held only until a later release took the head; at 74.1.5 the head is the artist\n"
                "    // bubble and the storage cleaner. They read the entry for the release this gate\n"
                "    // describes now - the same fix 71.8 gave test-705. Both bars are unchanged: 74.1's\n"
                "    // notes still have to name the back roll and the play that came back.\n"
                "    const own = entries.find((e) => String(e.version) === OWN);\n"
                "    const ownNotes = ((own && own.items) || []).join('\\n');\n"
                "    ok(!!own, 'the entry this gate describes is still in the changelog (' + OWN + ')');\n"
                "    ok(/back/i.test(ownNotes), 'the notes say back rolls');\n"
                "    ok(/restored|reopened/i.test(ownNotes), 'and name the play that came back without its album');",
            ),
        ],
        'ownNotes',
    ),
]

problems = []
applied = 0

for name, own, pairs, marker in EDITS:
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        problems.append('%s: missing' % name)
        continue
    src = open(path, encoding='utf-8').read()
    if marker in src:
        print('  %s: already reads its own entry (%s)' % (name, own))
        continue
    for old, new in pairs:
        if src.count(old) != 1:
            problems.append('%s: found %d copies of a needle, expected 1' % (name, src.count(old)))
            continue
        src = src.replace(old, new)
    if not CHECK:
        open(path, 'w', encoding='utf-8').write(src)
    applied += 1
    print('  %s: retargeted to %s' % (name, own))

for p in problems:
    print('  PROBLEM ' + p)
print('')
print('retarget-own-7415: %d file(s)' % applied + (' (check only)' if CHECK else ''))
sys.exit(1 if problems or (CHECK and applied) else 0)
