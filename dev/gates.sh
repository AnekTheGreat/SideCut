#!/usr/bin/env bash
# One command for the whole gate battery. Usage:
#   sh dev/gates.sh          # everything (core tests, album suites, ota trio, audit, dom)
#   sh dev/gates.sh quick    # core tests + ota trio only (release-tooling-only turns)
# Prints one line per suite: name + exit status + last output line. Exits 1 if any suite fails.
set -u
cd "$(dirname "$0")/.."
export NODE_PATH=/tmp/h/node_modules

CORE="test-612 test-6136 test-6137 test-6138 test-6139 test-619 test-651 test-662 test-713 test-714 test-725 test-7251 test-728 test-7281 test-7316 test-7317 test-play-copy test-735 test-736 test-7361 test-7362 test-737 test-738 test-739 test-740 test-741"
EXTRA="crossfade-pause-check compress-library-check export-playlist-check refresh-pin-check studio-70-check media-controls-check widget-resume-check background-playback-check audio-focus-check librarytools-6424-check notifgroup-6424-check album-follow-dock-check beat-repeat-check undo-delete-check home-bubble-size-check ai-button-check converter-identity-check lyrics-timing-check"
ALBUM="albums-manual-check album-isolation-check albums-menu-isolation-check album-rename-check album-hold-check ah-album-edit-check ah-album-reorder-check album-play-order-check"
OTA="ota-guard-check ota-update-check ota-bootapply-check"

run() { # run <name> <file...>
  local name="$1"; shift
  local out rc file
  for file in "$@"; do [ -f "$file" ] && break; done
  if [ ! -f "$file" ]; then echo "$name: MISSING ($*)"; return 2; fi
  out=$(node "$file" 2>&1); rc=$?
  line=$(printf '%s' "$out" | tail -n 1 | head -c 90)
  if [ "$rc" -ne 0 ]; then
    # A RED SUITE HAS TO COME BACK SAYING WHICH CHECKS WERE RED. The suite's own output is
    # the only place its failing checks are named, and this function is the only place that
    # output exists: it is captured and then dropped, so the line below used to say
    # "49 passed, 3 failed" and nothing else. The release report can only read this line
    # back (dev/release-7415-gates.sh greps it out of the log), so it kept arriving with the
    # count and not the names - twice, on the 74.1.5 release. Carry the first few failing
    # checks on the same line, which is the line the report already keeps.
    reds=$(printf '%s\n' "$out" | grep -E '✗' | head -3 | tr '\n' ';' | cut -c1-400)
    [ -n "$reds" ] && line="$line >> $reds"
  fi
  echo "$name: exit $rc ($line)"
  return $rc
}

FAIL=0
for t in $CORE; do
  f="dev/$t.mjs"; [ -f "$f" ] || f="dev/$t.cjs"
  run "$t" "$f" || FAIL=1
done

if [ "${1:-full}" != "quick" ]; then
  for t in $ALBUM; do run "$t" "dev/$t.cjs" || FAIL=1; done
  for t in $EXTRA; do run "$t" "dev/$t.cjs" || FAIL=1; done
  run audit-calls dev/audit-calls.mjs || FAIL=1
  run check-dom dev/check-dom.mjs || FAIL=1
fi

for t in $OTA; do run "$t" "dev/$t.cjs" || FAIL=1; done

if [ "$FAIL" -eq 0 ]; then echo "GATES: ALL GREEN"; else echo "GATES: FAILURES ABOVE"; fi
exit $FAIL
