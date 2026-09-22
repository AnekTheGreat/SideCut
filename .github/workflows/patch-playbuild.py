#!/usr/bin/env python3
"""
Inject the Play build flag into the staged web bundle.

WHY: SideCut ships two builds from one codebase.

  * Play build (this script runs in android-build.yml): window.__PLAY_BUILD__
    is set before any app script runs, so index.html and dev/native-updates.js
    switch acquisition to openly-licensed catalogs (Internet Archive netlabel /
    CC collections), hide the YouTube converter card and check the ota-play/
    update channel. The AAB therefore contains no video-host extraction path —
    which is the difference between a compliant build and review evasion.
  * Sideload/OTA build: the flag is never set, behavior is byte-for-byte what
    it is today, updates come from ota/.

The marker MUST match dev/ota-bundle-play.mjs exactly (same tag, same anchor),
so the OTA zip a Play install downloads stays a Play build forever.

Idempotent: safe to run on a fresh or already-patched www/index.html.
"""
from pathlib import Path

INDEX = Path("www/index.html")
if not INDEX.exists():
    raise SystemExit("FATAL: www/index.html is missing")

MARK = '<script>window.__PLAY_BUILD__=true;</script>\n'
ANCHOR = '<script src="dev/native-updates.js"></script>'

s = INDEX.read_text(encoding="utf-8")
if MARK in s:
    print("Play build flag already present")
elif ANCHOR in s:
    # Before native-updates.js so its channel constants see the flag, and
    # before the first inline script so SC_IS_PLAY reads it too.
    s = s.replace(ANCHOR, MARK + ANCHOR, 1)
    INDEX.write_text(s, encoding="utf-8")
    print("Injected window.__PLAY_BUILD__=true before dev/native-updates.js")
else:
    raise SystemExit('FATAL: anchor <script src="dev/native-updates.js"></script> not found')
