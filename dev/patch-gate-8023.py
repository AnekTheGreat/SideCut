#!/usr/bin/env python3
"""80.2.3 - put this release's section into dev/staircase-check.cjs, and check it landed.

dev/staircase-check.cjs is the gate for the cloud layout, the flight and the bar, and
it is where 80.2's own work is answered for. This release earns the milestone card
with plays as well as with a streak, so that gate gets one more section: the ladder,
the medal, the ceremony per tier, the trigger, the record in Studio and the streak card
left as it was.

Idempotent: the marker is the section's own heading.

    python3 dev/patch-gate-8023.py
    python3 dev/patch-gate-8023.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = "console.log('[9] 80.2.3: the award card opens for plays"

ANCHOR = "console.log('');\nconsole.log(pass + ' passed, ' + fail + ' failed');"

SECTION = """console.log('[9] 80.2.3: the award card opens for plays, and every rung is a bigger card');
{
  // THE LADDER. The rungs the owner named, and the tail that keeps going past them.
  ok(src.indexOf('var PLAY_MILESTONES = [100, 200, 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000];') > 0,
    'the plays ladder names every rung asked for');
  ok(src.indexOf('var PLAY_LADDER_STEP = 5000, PLAY_LADDER_TOP = 100000;') > 0,
    'and it keeps going in steps of five thousand');
  ok(src.indexOf('function playRungs(){') > 0, 'the ladder is generated past its last named rung');
  // THE CARD. The same overlay a streak gets, with a medal and a ceremony per tier.
  ok(src.indexOf('function celebratePlays(plays, opts){') > 0, 'a plays award has its own celebration');
  ok(src.indexOf("host.querySelector('.sc80-ms-kicker').textContent = 'Award';") > 0,
    'it says Award where a streak says Milestone');
  ok(src.indexOf('medal.textContent = ') > 0 && src.indexOf('+ award.name;') > 0,
    'and it wears the medal it earned');
  ok(src.indexOf('function paintCeremony(host, tier){') > 0 &&
     src.indexOf("rings.appendChild(document.createElement('i'));") > 0,
    'the rings are painted per tier');
  ok(src.indexOf('function bitsHtml(n){') > 0 && src.indexOf('n = n || 26;') > 0,
    'so the bits take a count, and a streak keeps its own twenty-six');
  ok(src.indexOf('.sc80-ms-medal{') > 0 && src.indexOf('#sc80Milestone[data-tier=\"5\"] .sc80-ms-card{') > 0,
    'the five medals and their glows have a stylesheet');
  // THE TRIGGER. The app's own play counter, a start, and a return to the front.
  ok(src.indexOf("try{ if(window.SC80 && typeof SC80.checkPlays === 'function') SC80.checkPlays(); }catch(_eAward){}") > 0,
    'the play counter tips the card');
  ok(src.indexOf('function checkPlays(opts){') > 0 && src.indexOf('markPlaysThrough(hit);') > 0,
    'and every rung crossed is recorded, so nothing queues behind it');
  ok(src.indexOf('function bootPlays(){') > 0 && src.indexOf('try{ bootPlays(); }catch(e){}') > 0,
    'a start checks the ladder');
  ok(src.indexOf("document.addEventListener('visibilitychange', function(){") > 0,
    'and so does a return to the front');
  // THE RECORD. Studio lists the next rung and replays the ones already earned.
  ok(src.indexOf('function playsCard(){') > 0 && src.indexOf('id=\"sc80Plays\"') > 0,
    'Studio, Tools has a Plays block');
  ok(src.indexOf('data-sc80-plays=\"') > 0, 'with a Replay per rung');
  ok(src.indexOf("else if(t.hasAttribute('data-sc80-plays')) celebratePlays(Number(t.getAttribute('data-sc80-plays')), { manual: true });") > 0,
    'and a replay opens the same card');
  ok(src.indexOf("plays: 'sc80Plays'") > 0, 'the rungs are remembered on the device');
  // THE STREAK CARD is still the streak card, in what it says and in how it is painted.
  ok(src.indexOf("host.setAttribute('data-kind', 'streak');") > 0 &&
     src.indexOf("host.querySelector('.sc80-ms-kicker').textContent = 'Milestone';") > 0,
    'the streak card resets to its own word and its own rings');
}

"""

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[9] 80.2.3: the award card opens for plays", 'the gate names 80.2.3'),
    ('the plays ladder names every rung asked for', 'the ladder is pinned'),
    ('and it keeps going in steps of five thousand', 'the generated tail is pinned'),
    ('a plays award has its own celebration', 'the plays card is pinned'),
    ('it says Award where a streak says Milestone', 'the kicker is pinned'),
    ('the rings are painted per tier', 'the ceremony is pinned'),
    ('the five medals and their glows have a stylesheet', 'the tiers are pinned'),
    ('the play counter tips the card', 'the trigger is pinned'),
    ('Studio, Tools has a Plays block', 'the Studio block is pinned'),
    ('and a replay opens the same card', 'the replay wiring is pinned'),
    ('the streak card resets to its own word and its own rings', 'the streak card is pinned'),
    ("const APP_VERSION = '80.2.3';", 'the gate pins 80.2.3'),
    ('sidecut-shell-v80.2.3', 'the gate pins the 80.2.3 shell cache'),
    ("version: '80.2.3'", 'the gate pins the 80.2.3 changelog head'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8023: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: section [9] is already in the gate')
    else:
        if CHECK:
            print('patch-gate-8023 --check: section [9] is not in the gate yet')
            return 1
        if src.count(ANCHOR) != 1:
            sys.exit('patch-gate-8023: the gate is not the shape this release expects')
        src = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        open(GATE, 'w', encoding='utf-8').write(src)
        print('  applied: section [9]')
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8023: the gate is not the 80.2.3 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2.3: the ladder, the medal, the ceremony, the trigger (%d claims)' % len(CLAIMS))
    print('patch-gate-8023%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
