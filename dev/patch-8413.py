#!/usr/bin/env python3
"""SideCut 84.1.3 - the version, the cache and the notes move to 84.1.3.

A version-only release, the same shape as 84.0.0 when it only renumbered 83.10.0:
the page, the service worker's cache and the release notes all say 84.1.3, and
nothing a user can see changes. It exists so the number the app reports, the cache
it installs offline and the notes it shows are the same number, and so the OTA
bundles carry it.

    python3 dev/patch-8413.py            # apply
    python3 dev/patch-8413.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")

V = "84.1.3"
OLD = "84.1.2"
DATE = "November 16, 2026"

ENTRY = """      { version: '84.1.3', date: 'November 16, 2026', title: 'The version, the cache and the notes move to 84.1.3', items: [
    'The version is 84.1.3. A release here is numbered major.minor.patch, so 84.1.2 is followed by 84.1.3, and the page, the cache and these notes all say it together. Nothing else in this release has changed.',
    'The cache name moves with it, so the offline copy of the page is replaced on the next launch instead of being served from the old build.',
    'The update bundles carry 84.1.3 too, so a phone updating by bundle and a phone updating by page agree on the number they are on.'
  ] },
"""

ANCHOR = """      { version: '84.1.2', date: 'November 13, 2026', title: 'The music does not stop when you leave the app', items: [
"""

NOTES = [
    "The version is 84.1.3. A release here is numbered major.minor.patch, so 84.1.2 is followed by 84.1.3, and the page, the cache and these notes all say it together. Nothing else in this release has changed.",
    "The cache name moves with it, so the offline copy of the page is replaced on the next launch instead of being served from the old build.",
    "The update bundles carry 84.1.3 too, so a phone updating by bundle and a phone updating by page agree on the number they are on.",
]


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8413: %s appears %d times, expected exactly 1" % (what, n))


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()

    out = page
    if ("const APP_VERSION = '%s';" % V) not in page:
        once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
        once(page, ANCHOR, "the 84.1.2 notes entry")
        out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
        out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)

    sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V)

    up_new = up
    if json.loads(up).get("version") != V:
        data = json.loads(up)
        data["version"] = V
        data["notes"] = NOTES
        data["date"] = DATE
        up_new = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        if up.endswith("\n"):
            up_new += "\n"

    if out == page and sw_new == sw and up_new == up:
        print("already on the page")
        return 0
    if check:
        print("not applied yet")
        return 1

    once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    io.open(UPDATES, "w", encoding="utf-8").write(up_new)
    print("page at %s, cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
