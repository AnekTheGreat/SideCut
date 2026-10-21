#!/usr/bin/env python3
"""80.0.2 - the duck, to your taste: choose how far the music steps back.

80.0.1 shipped the duck itself (master gain, the phone's own end-of-duck answer,
the tap, the one-minute ceiling). It stepped back to one fixed level and there was
no way to say "less" or "more". This release gives that number to the listener
without touching the engine underneath it:

  1. APP_VERSION -> 80.0.2 and the service-worker shell cache -> v80.0.2.
  2. A ladder, SC_DUCK_LEVELS = [20%, 15%, 25%, 40%], with 20% first because that
     is exactly what 80.0.1 stepped to - an update sounds identical until the
     button is touched. THE ENGINE IS NOT REWRITTEN: scDuckForAssistant still
     ramps scDuckMaster through scDuckSetLevel, it just reads the chosen level
     instead of the old constant.
  3. A "Step down to" row under the Assistant duck switch, which walks the ladder
     and remembers the choice in meta (and in a backup, beside the switch).
  4. Changing the depth while a duck is held re-levels immediately, through the
     same scDuckForAssistant call, so the change is heard in the same breath and
     the duck is not dropped and re-applied.
  5. The 80.0.2 changelog entry.

Everything else about the duck - the four ways it ends, the cap, the call path,
the recording tap staying unducked - is 80.0.1's and is not touched here.

Idempotent: every edit is guarded by its own anchor, and a second run reports
"already applied". `--check` reports instead of writing.

  python3 dev/patch-8002.py
  python3 dev/patch-8002.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv

VERSION = '80.0.2'

# The entry goes on TOP of the changelog, above 80.0.1. The bell reads the list in
# order and the detail pairs are the shape 80.0 introduced.
ENTRY = """  { version: '80.0.2', date: 'October 21, 2026 \\u00b7 6:30 AM EDT', title: 'Assistant duck depth: choose how far the music steps back', items: [
    'How far the music steps back for an assistant is yours to choose now, from a nudge to a whisper.',
    'It starts at 20% - exactly where 80.0.1 left it - so an update sounds the same until you touch the button.',
    'The choice is remembered on the phone and travels in a backup, so a new phone ducks the way the old one did.',
    'Changing the depth while an assistant is still talking is heard straight away, without dropping the duck.',
    'The duck itself is unchanged: the music never pauses, and the phone still decides when the conversation is over.',
    'A tap still brings the music straight back, and a real phone call still pauses the song as it always has.',
    'The home-screen widget, the player, the letter-by-letter lyrics and the albums are exactly where 80.0.1 left them.',
  ],
    details: [
      'The Assistant duck switch says WHETHER the music steps back; this row says HOW FAR. It walks 20, 15, 25 and 40 percent, so a quiet room and a loud car can both be right, and the music is never made so quiet that the song is lost.',
      'Twenty percent is what 80.0.1 always used, so it is the first rung of the ladder and the default: updating changes nothing you can hear. Only touching the button moves the number, and it moves in the direction of the next rung, never off the ladder.',
      'It rides the same meta row the switch does and it is written into a library backup, so a phone restored from a backup arrives with the depth you had chosen rather than the default.',
      'If you change the depth while an assistant already has the music stepped back, the new level is ramped in through the same call that applies a duck - immediately, over the same short ramp, without releasing the duck first, so the music is never briefly loud in the middle of a sentence.',
      'A duck still ends the way 80.0.1 ends one: the phone says it is over, or eight seconds pass with no further signal, or you touch the screen - and never longer than a minute from the first request. A phone call is still a call and still pauses.',
      'A tap anywhere on the screen still releases the duck at once, so a conversation that ended without the phone saying so is one touch away from full volume. A phone call is still a call: the song pauses while it is up and resumes where it was when it ends, at full volume, because the duck is released with the call rather than waiting it out.',
      'The number rides the master gain that 80.0.1 put between the limiters and the speakers, which is why both decks, DJ Mode and the Studio chain all move together and the element volume the crossfade owns is untouched. A recording still captures the unducked signal, and the widget, the player, the lyrics and the albums are where 80.0.1 left them.',
    ]},
"""

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"

# (label, relative path, the 80.0.1 text, the 80.0.2 text)
EDITS = [
    (
        'page version',
        'index.html',
        "  const APP_VERSION = '80.0.1';",
        "  const APP_VERSION = '%s';" % VERSION,
    ),
    (
        'shell cache',
        'sw.js',
        "const CACHE_NAME = 'sidecut-shell-v80.0.1';",
        "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION,
    ),
    # ---- the setting, in Settings - More - Playback and sound -----------------
    (
        'the depth row',
        'index.html',
        "      <div style=\"font-size:11px; color:var(--ink-dim); margin-top:4px;\">While an assistant is listening - the power-button one, or any app that takes the audio for a moment - the music drops to a low level instead of stopping, and comes back up when it is done. A phone call still pauses the song. Off keeps the old behaviour: the music holds its full level through everything but a call.</div>\n    </div>",
        "      <div style=\"font-size:11px; color:var(--ink-dim); margin-top:4px;\">While an assistant is listening - the power-button one, or any app that takes the audio for a moment - the music drops to a low level instead of stopping, and comes back up when it is done. A phone call still pauses the song. Off keeps the old behaviour: the music holds its full level through everything but a call.</div>\n"
        "      <div style=\"margin-top:10px; display:flex; justify-content:space-between; align-items:center;\">\n"
        "        <span style=\"font-size:13px; color:var(--ink-dim);\">Step down to</span>\n"
        "        <button class=\"tab\" id=\"assistantDuckLevel\" style=\"padding:5px 12px; font-size:12px;\">20%</button>\n"
        "      </div>\n"
        "      <div style=\"font-size:11px; color:var(--ink-dim); margin-top:4px;\">How far the music steps back while it ducks. 20% is where 80.0.1 stepped to; the button walks 20, 15, 25 and 40 percent.</div>\n"
        "    </div>",
    ),
    # ---- the ladder and the chosen level, declared with the switch ------------
    (
        'the ladder',
        'index.html',
        "    let assistantDuckOn = true;\n",
        "    let assistantDuckOn = true;\n"
        "    // 80.0.2 - HOW FAR it steps back. The ladder starts at 20 percent, which is\n"
        "    // exactly the level 80.0.1 shipped, so an update sounds identical until the\n"
        "    // button is touched. Declared here rather than beside the engine because the\n"
        "    // switch, the boot restore and the backup all reach for it by name.\n"
        "    const SC_DUCK_LEVELS = [0.2, 0.15, 0.25, 0.4];\n"
        "    let assistantDuckLevel = SC_DUCK_LEVELS[0];\n"
        "    function setAssistantDuckLevel(level){\n"
        "      // Anything off the ladder (a hand-edited meta row, an old backup) falls back\n"
        "      // to the first rung rather than a level the engine would have to guess at.\n"
        "      assistantDuckLevel = SC_DUCK_LEVELS.indexOf(level) === -1 ? SC_DUCK_LEVELS[0] : level;\n"
        "      const b = $('assistantDuckLevel');\n"
        "      if(b) b.textContent = Math.round(assistantDuckLevel * 100) + '%';\n"
        "      dbPut('meta', { key: 'assistantDuckLevel', value: assistantDuckLevel });\n"
        "    }\n"
        "    function cycleAssistantDuckLevel(){\n"
        "      const i = SC_DUCK_LEVELS.indexOf(assistantDuckLevel);\n"
        "      setAssistantDuckLevel(SC_DUCK_LEVELS[(i + 1) % SC_DUCK_LEVELS.length]);\n"
        "      // Already ducked: take the new depth now, through the same call that applies\n"
        "      // a duck, so the change is heard in the same breath and the music is never\n"
        "      // briefly loud in the middle of a sentence.\n"
        "      try{ if(scDuckHeld()) scDuckForAssistant('you changed the depth'); }catch(_e){}\n"
        "    }\n",
    ),
    (
        'the depth button',
        'index.html',
        "    $('assistantDuckToggle').addEventListener('click', () => setAssistantDuck(!assistantDuckOn));\n",
        "    $('assistantDuckToggle').addEventListener('click', () => setAssistantDuck(!assistantDuckOn));\n"
        "    // 80.0.2 - the depth button. Guarded, so a page from an older shell that has\n"
        "    // the switch but not this row cannot throw on boot.\n"
        "    if($('assistantDuckLevel')) $('assistantDuckLevel').addEventListener('click', cycleAssistantDuckLevel);\n",
    ),
    # ---- the engine reads the chosen level instead of the constant ------------
    (
        'the engine reads the level',
        'index.html',
        "  const SC_DUCK_LEVEL = 0.2;      // how far the music steps back (about -14 dB)\n",
        "  // 80.0.2 - the level is no longer a constant here: assistantDuckLevel and its\n"
        "  // ladder are declared with the switch above, so the settings row, the backup and\n"
        "  // the engine all read the same number.\n",
    ),
    (
        'the ramp target',
        'index.html',
        "    const ok = scDuckSetLevel(SC_DUCK_LEVEL, true);",
        "    const ok = scDuckSetLevel(assistantDuckLevel, true);",
    ),
    # ---- boot, backup out, backup in ------------------------------------------
    (
        'boot restore',
        'index.html',
        "      setAssistantDuck(assistantDuckRow ? !!assistantDuckRow.value : true);\n",
        "      setAssistantDuck(assistantDuckRow ? !!assistantDuckRow.value : true);\n"
        "      // 80.0.2 - and how far it steps back. An untouched library gets the first\n"
        "      // rung, which is the level 80.0.1 used.\n"
        "      const assistantDuckLevelRow = metaRows.find(r => r.key === 'assistantDuckLevel');\n"
        "      setAssistantDuckLevel(assistantDuckLevelRow && typeof assistantDuckLevelRow.value === 'number' ? assistantDuckLevelRow.value : SC_DUCK_LEVELS[0]);\n",
    ),
    (
        'backup export',
        'index.html',
        "            assistantDuck: assistantDuckOn,\n",
        "            assistantDuck: assistantDuckOn,\n"
        "            assistantDuckLevel: assistantDuckLevel,\n",
    ),
    (
        'backup import',
        'index.html',
        "        if(manifest.settings.assistantDuck !== undefined){\n          setAssistantDuck(manifest.settings.assistantDuck);\n        }\n",
        "        if(manifest.settings.assistantDuck !== undefined){\n          setAssistantDuck(manifest.settings.assistantDuck);\n        }\n"
        "        // 80.0.2 - the depth rides the backup beside the switch.\n"
        "        if(typeof manifest.settings.assistantDuckLevel === 'number'){\n"
        "          setAssistantDuckLevel(manifest.settings.assistantDuckLevel);\n"
        "        }\n",
    ),
    # ---- what a gate can read -------------------------------------------------
    (
        'the published state',
        'index.html',
        "  window.__scAssistantDuckOn = function(){ return assistantDuckOn; };\n",
        "  window.__scAssistantDuckOn = function(){ return assistantDuckOn; };\n"
        "  // 80.0.2 - the depth, and the ladder it walks, so a gate can read the real\n"
        "  // setting instead of assuming which number the ramp used.\n"
        "  window.__scAssistantDuckLevel = function(){ return assistantDuckLevel; };\n"
        "  window.__scDuckLadder = function(){ return SC_DUCK_LEVELS.slice(); };\n",
    ),
]


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def write(rel, src):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        f.write(src)


def apply_edits():
    """Every anchor must appear exactly once, or nothing is written for it."""
    applied, present, missing = 0, 0, []
    for label, rel, old, new in EDITS:
        src = read(rel)
        if new in src:
            present += 1
            continue
        if src.count(old) != 1:
            missing.append('%s (%s: anchor found %d times)' % (label, rel, src.count(old)))
            continue
        if not CHECK:
            write(rel, src.replace(old, new, 1))
        applied += 1
        print('  applied: ' + label)
    return applied, present, missing


def patch_index(src):
    """The changelog entry, on top of 80.0.1. Idempotent by its own version."""
    if "{ version: '%s'," % VERSION in src:
        return src, False
    if src.count(CHANGELOG_ANCHOR) != 1:
        raise SystemExit('patch-8002: the CHANGELOG anchor appears %d times'
                         % src.count(CHANGELOG_ANCHOR))
    return src.replace(CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + ENTRY, 1), True


def main():
    applied, present, missing = apply_edits()

    src = read('index.html')
    after, changed = patch_index(src)
    if changed:
        if not CHECK:
            write('index.html', after)
        applied += 1
        print('  applied: the 80.0.2 changelog entry')
    else:
        present += 1

    if missing:
        for m in missing:
            print('  MISSING ANCHOR: ' + m)
    if CHECK:
        print('patch-8002 --check: %d to apply, %d already in place, %d anchors missing'
              % (applied, present, len(missing)))
        return 1 if (applied or missing) else 0
    if missing:
        sys.exit('patch-8002: %d anchor(s) not found - nothing was written for them'
                 % len(missing))
    print('patch-8002: %d applied, %d already in place' % (applied, present))
    return 0


if __name__ == '__main__':
    sys.exit(main())
