#!/usr/bin/env python3
"""SideCut 83.2.5 - the fifth card, and every card opens something that answers.

83.2.3 added UNote as a fourth card, so SideCut's shelf held FamTM, UJournal, MeasureT and UNote.
My Hub - the screen that launches all of them - was the one app missing.

Every card also pointed at a Play listing, and only SideCut's own listing exists: the other four
packages answer with Play's not-found page. 83.2.5 gives the five cards the same order, the same
one-line descriptions and the same addresses the rest of the family uses, and every card opens a page
that answers today.

    python3 dev/patch-8325.py            # apply
    python3 dev/patch-8325.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGE = "index.html"

V = "83.2.5"
OLD = "83.2.4"

CARD = """      <div style="border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:rgba(255,255,255,0.03); margin-bottom:10px;">
        <div style="font-size:14px; font-weight:600;">%s</div>
        <div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">%s</div>
        <a href="%s" target="_blank" rel="noopener" style="display:inline-block; margin-top:8px; font-size:12px; font-weight:600; color:var(--coral); text-decoration:none;">%s &rarr;</a>
      </div>
"""

CARDS_NEW = (
    CARD % ("FamTM",
            "The family tree in your pocket: everyone, their dates, their photos, and how they are related.",
            "https://github.com/AnekTheGreat/FamTM/releases/latest", "Open its page")
    + CARD % ("UJournal",
              "Keeps the days you write down, and the birthdays this family hands over.",
              "https://github.com/AnekTheGreat/Journal/releases/latest", "Open its page")
    + CARD % ("MeasureT",
              "Elevation, location, a level and a converter.",
              "https://anekthegreat.github.io/Compass-EDC/", "Open it")
    + CARD % ("My Hub",
              "One screen that launches everything here, and keeps each one up to date.",
              "https://github.com/AnekTheGreat/My-Hub/releases/latest", "Open its page")
    + CARD % ("UNote",
              "Notes that link themselves, with a Vault behind a PIN you choose.",
              "https://anekthegreat.github.io/UNote/", "Open it")
)

INTRO_OLD = '<div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-bottom:12px;">Four more, made the same way and free the same way.</div>'
INTRO_NEW = '<div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-bottom:12px;">Five more, made the same way and free the same way.</div>'

FOOT_OLD = '<div style="font-size:11px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">A link opens in the phone\'s own browser. If an app is not installed yet, its page opens where it can be installed.</div>'
FOOT_NEW = '<div style="font-size:11px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">A card opens in the phone\'s own browser, at the page or the release the app installs from. Nothing is downloaded or installed from here.</div>'

ENTRY = """{ version: '%s', date: 'November 8, 2026', title: 'My Hub is on the shelf', items: [
    'Other apps has a fifth card: My Hub, the screen that launches every app here and keeps each one up to date. It was the one app the shelf did not carry.',
    'Four of the five cards pointed at Play listings that are not up yet, so a tap answered with Play\\'s own not-found page. FamTM, UJournal and My Hub now open the release they install from, and MeasureT and UNote open their page.',
    'The cards are in the same order and carry the same one-line descriptions as the shelves in the other apps.'
  ] },
  """ % V


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def write(rel, text):
    with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="") as f:
        f.write(text)


def main():
    check = "--check" in sys.argv
    page = read(PAGE)
    touched = []

    if CARDS_NEW not in page:
        if 'id="settingsPaneOther"' not in page:
            sys.exit("the page has no Other apps pane")
        i = page.index('id="settingsPaneOther"')
        start = page.index('<div style="border:1px solid var(--line); border-radius:12px;', i)
        end = page.index('      <div style="font-size:11px;', i)
        page = page[:start] + CARDS_NEW + page[end:]
        touched.append("the cards")

    if INTRO_NEW not in page:
        if INTRO_OLD not in page:
            sys.exit("the line over the cards is neither the old one nor the new one")
        page = page.replace(INTRO_OLD, INTRO_NEW, 1)
        touched.append("the line over the cards")

    if FOOT_NEW not in page:
        if FOOT_OLD not in page:
            sys.exit("the line under the cards is neither the old one nor the new one")
        page = page.replace(FOOT_OLD, FOOT_NEW, 1)
        touched.append("the line under the cards")

    if ("const APP_VERSION = '%s';" % V) not in page:
        if ("const APP_VERSION = '%s';" % OLD) not in page:
            sys.exit("the page does not say %s" % OLD)
        page = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
        head = "{ version: '%s', date:" % OLD
        if head not in page:
            sys.exit("the changelog does not start at %s" % OLD)
        page = page.replace(head, ENTRY + head, 1)
        touched.append("APP_VERSION and the changelog")

    pane = page.split('id="settingsPaneOther"')[1].split('id="settingsPaneTheme"')[0]
    probes = [
        (CARDS_NEW in page, "the five cards are not in the pane"),
        ("My Hub" in pane, "My Hub is not on the shelf"),
        (pane.count("https://play.google.com/store/apps/details?id=") == 0,
         "a card still points at a Play listing that is not there"),
        ("github.com/AnekTheGreat/FamTM/releases/latest" in pane, "FamTM has no address"),
        ("github.com/AnekTheGreat/Journal/releases/latest" in pane, "UJournal has no address"),
        ("github.com/AnekTheGreat/My-Hub/releases/latest" in pane, "My Hub has no address"),
        ("anekthegreat.github.io/Compass-EDC/" in pane, "MeasureT has no address"),
        ("anekthegreat.github.io/UNote/" in pane, "UNote has no address"),
        (INTRO_NEW in page, "the pane still says four more"),
        (("const APP_VERSION = '%s';" % V) in page, "the page does not say %s" % V),
        (("version: '%s'" % V) in page, "the changelog has no %s entry" % V),
        ("scSongSpeed" in page, "the page lost a marker the release checks"),
    ]
    bad = [why for ok, why in probes if not ok]
    if bad:
        sys.exit("; ".join(bad))

    if check:
        print("all %d checks pass - the tree carries SideCut %s" % (len(probes), V))
        print("untouched this run" if not touched else "applied: " + ", ".join(touched))
        return

    write(PAGE, page)
    print("SideCut %s written to index.html" % V)
    print("next: release.yml rebuilds the OTA bundles from it")


if __name__ == "__main__":
    main()
