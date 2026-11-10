#!/usr/bin/env python3
"""SideCut 83.2.7 - a quiet refresh: the version moves, the cache moves, no note.

The owner asked for an update that only refreshes the cache and adds nothing to the patch
notes. The version has to move for an installed copy to pick the bundle up, so 83.2.7 moves
it and the service-worker cache moves with it - and the changelog entry for it is marked
`silent`, which keeps it out of every notes surface and out of the boot popup. Without that
mark the popup would open on the previous release's notes the moment the version changed.

--check exits 1 before it is applied and 0 after it.

    python3 dev/patch-8327.py            # apply
    python3 dev/patch-8327.py --check    # verify only, writes nothing
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = "index.html"
SW = "sw.js"

V = "83.2.7"
OLD = "83.2.6"

ENTRY = "  { version: '%s', date: 'November 10, 2026', title: 'A quiet refresh', silent: true, items: [] },\n" % V


def path(p):
    return os.path.join(ROOT, p)


def read(p):
    return open(path(p), encoding="utf-8").read()


def write(p, s):
    open(path(p), "w", encoding="utf-8").write(s)


def swap(text, old, new, why):
    if text.count(old) != 1:
        sys.exit("%s (found %d, expected 1)" % (why, text.count(old)))
    return text.replace(old, new, 1)


def check():
    page = read(PAGE)
    probes = [
        (("const APP_VERSION = '%s';" % V) in page, "the page does not say %s" % V),
        (("version: '%s'" % V) in page, "%s has no changelog entry" % V),
        ("title: 'A quiet refresh', silent: true, items: []" in page, "the entry is not marked silent"),
        ("if(CHANGELOG[i] && CHANGELOG[i].silent) continue;" in page, "the notes list would show it"),
        ("const _silent = !!(CHANGELOG[0] && CHANGELOG[0].silent);" in page, "the popup would open on it"),
        ("const entry = _silent ? null : scChangelogEntries()[0];" in page, "the popup does not check the mark"),
        (("version: '%s'" % OLD) in page, "the %s notes were removed" % OLD),
        (("const APP_VERSION = '%s';" % OLD) not in page, "the page still says %s" % OLD),
        ("sidecut-shell-v%s" % V in read(SW), "the service-worker cache is not on %s" % V),
        ("function scArtistIdentity(name){" in page, "the page lost its artist identity"),
        ("setInterval(function(){ scPinnedAutoCheck(); }, 20 * 60 * 1000);" in page, "the page lost its release check"),
    ]
    bad = [why for ok, why in probes if not ok]
    if bad:
        sys.exit("; ".join(bad))


def main():
    page = read(PAGE)
    if ("const APP_VERSION = '%s';" % V) in page:
        check()
        print("already applied - nothing written")
        return

    page = swap(page, "const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V,
                "the page does not say %s" % OLD)
    page = swap(page, "{ version: '%s', date:" % OLD, ENTRY + "{ version: '%s', date:" % OLD,
                "the changelog does not start at %s" % OLD)

    # Out of the notes list and the bell...
    page = swap(page, "      if(play && !changelogItems(CHANGELOG[i]).length) continue;",
                "      // 83.2.7 - a silent entry is a refresh, not a note: it never reaches a list.\n"
                "      if(CHANGELOG[i] && CHANGELOG[i].silent) continue;\n"
                "      if(play && !changelogItems(CHANGELOG[i]).length) continue;",
                "the notes list is not where it was expected")

    # ...and out of the boot popup, which otherwise opens on the entry it finds first.
    page = swap(page, "        const entry = scChangelogEntries()[0];\n        if(entry){",
                "        // 83.2.7 - THE VERSION CAN MOVE WITHOUT A NOTE. A silent newest entry means there is\n"
                "        // nothing to read, so nothing opens and the notes for the version before it do not come\n"
                "        // back either; the baseline is simply moved to this version.\n"
                "        const _silent = !!(CHANGELOG[0] && CHANGELOG[0].silent);\n"
                "        const entry = _silent ? null : scChangelogEntries()[0];\n"
                "        if(entry){",
                "the boot popup is not where it was expected")

    write(PAGE, page)

    sw = read(SW)
    m = re.search(r"const CACHE_NAME = 'sidecut-shell-v([0-9.]+)';", sw)
    if m:
        write(SW, sw.replace(m.group(0), "const CACHE_NAME = 'sidecut-shell-v%s';" % V, 1))

    check()
    print("SideCut %s written: the version and the cache moved, no note was added" % V)


if __name__ == "__main__":
    if "--check" in sys.argv and ("const APP_VERSION = '%s';" % V) not in read(PAGE):
        sys.exit("the tree does not carry %s yet" % V)
    main()
    if "--check" in sys.argv:
        print("all checks pass - the tree carries SideCut %s" % V)
