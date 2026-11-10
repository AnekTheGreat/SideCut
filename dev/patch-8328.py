#!/usr/bin/env python3
"""SideCut 83.2.8 - the example comes out of the notes.

An older release note explained a fix by naming a real act beside the one that had been
pinned. The owner asked for that example to go. 83.2.8 rewrites the line so it says what
changed without naming anyone, and it arrives the way 83.2.7 did: the version and the
service-worker cache move, and the changelog entry for this release is marked `silent`,
so no notes surface opens.

--check exits 1 before it is applied and 0 after it.

    python3 dev/patch-8328.py            # apply
    python3 dev/patch-8328.py --check    # verify only, writes nothing
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = "index.html"
SW = "sw.js"

V = "83.2.8"
OLD = "83.2.7"

ENTRY = "  { version: '%s', date: 'November 10, 2026', title: 'The example comes out', silent: true, items: [] },\n" % V

WITH_EXAMPLE = ("A song by a different act whose name merely begins with yours - "
                "Sukha Mann beside Sukha - was landing in New releases; names are compared exactly now.")
WITHOUT_EXAMPLE = ("A song by a different act whose name merely begins with yours was landing "
                   "in New releases; names are compared exactly now.")


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
        ("title: 'The example comes out', silent: true, items: []" in page, "the entry is not marked silent"),
        ("if(CHANGELOG[i] && CHANGELOG[i].silent) continue;" in page, "the notes list would show it"),
        ("const _silent = !!(CHANGELOG[0] && CHANGELOG[0].silent);" in page, "the popup would open on it"),
        ("const entry = _silent ? null : scChangelogEntries()[0];" in page, "the popup does not check the mark"),
        (WITHOUT_EXAMPLE in page, "the example was not rewritten"),
        (WITH_EXAMPLE not in page, "the named example is still in the notes"),
        (("version: '%s'" % OLD) in page, "the %s entry was removed" % OLD),
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
    page = swap(page, "  { version: '%s', date:" % OLD, ENTRY + "  { version: '%s', date:" % OLD,
                "the changelog does not start at %s" % OLD)
    page = swap(page, WITH_EXAMPLE, WITHOUT_EXAMPLE,
                "the named example is not where it was expected")

    write(PAGE, page)

    sw = read(SW)
    m = re.search(r"const CACHE_NAME = 'sidecut-shell-v([0-9.]+)';", sw)
    if m:
        write(SW, sw.replace(m.group(0), "const CACHE_NAME = 'sidecut-shell-v%s';" % V, 1))

    check()
    print("SideCut %s written: the example is out of the notes, the version and the cache moved" % V)


if __name__ == "__main__":
    if "--check" in sys.argv and ("const APP_VERSION = '%s';" % V) not in read(PAGE):
        sys.exit("the tree does not carry %s yet" % V)
    main()
    if "--check" in sys.argv:
        print("all checks pass - the tree carries SideCut %s" % V)
