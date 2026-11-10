#!/usr/bin/env python3
"""Strip the quoted report and the named act out of the 83.2.6 memory entry.

The owner asked for the example to stop appearing in the notes. The release notes lost it
in 83.2.8; the repository memory still carried the report, quoted in full, and two bullets
that named the other act. This rewrites that one section, and nothing else: the heading of
the second bullet loses the name, the bodies say "another name that starts the same way",
and the quote is gone.

Idempotent: a second run finds nothing to change.

    python3 dev/agents-trim-8326.py
"""

import io
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
AGENTS = os.path.join(ROOT, "AGENTS.md")

START = "## 83.2.6 ("
END = "\n## 83.2.5 ("

SWAPS = [
    ("- **WHY SUKHA MANN WAS IN THE LIST.**",
     "- **WHY THE OTHER ACT'S SONGS WERE IN THE LIST.**"),
    ('a pinned "Sukha" was treated as the same artist as "Sukha Mann", "Sukha Dhaliwal" and '
     'anyone else whose name starts that way',
     'a pinned name was treated as the same artist as every other name that started the same way'),
    ('"Sukha Mann" against "Sukha" is refused; "SUKHA" against "sukha" and "The Weeknd" against '
     '"Weeknd" are accepted',
     'a name with words added is refused; the same name in another case is accepted'),
    ('a row from the Sukha Mann id and one from a rock namesake are both refused while the '
     'Punjabi one passes',
     "a row from the other act's id and one from a rock namesake are both refused while the "
     'right genre passes'),
    ("No phone has pinned Sukha.", "No phone has pinned that artist."),
]


def main():
    src = io.open(AGENTS, encoding="utf-8").read()
    if START not in src or END not in src:
        sys.exit("83.2.6 is not where it was expected in AGENTS.md")
    i = src.index(START)
    j = src.index(END, i)
    sec = src[i:j]

    kept = "\n".join(l for l in sec.split("\n") if not l.startswith("- **WHAT THE OWNER SAID.**"))
    for old, new in SWAPS:
        if old in kept:
            kept = kept.replace(old, new, 1)

    if kept == sec:
        print("already trimmed - nothing written")
    else:
        io.open(AGENTS, "w", encoding="utf-8").write(src[:i] + kept + src[j:])
        print("83.2.6 trimmed: no quote, no named act")

    check = io.open(AGENTS, encoding="utf-8").read()
    k = check.index(START)
    m = check.index(END, k)
    sect = check[k:m]
    bad = []
    if "sukha" in sect.lower():
        bad.append("the section still names the act")
    if "WHAT THE OWNER SAID" in sect:
        bad.append("the quoted report is still there")
    if "WHY THE CHECK DID NOT RUN ON ITS OWN" not in sect or "NO CONTENT" in sect:
        bad.append("the section lost a bullet that has nothing to do with this")
    if bad:
        sys.exit("; ".join(bad))
    print("the 83.2.6 entry carries no quote and no name")


if __name__ == "__main__":
    main()
