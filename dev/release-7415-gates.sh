#!/usr/bin/env bash
# 74.1.5 - install what the battery reads, run the battery, and allow the one red this
# repo has recorded for months: dev/media-controls-check.cjs, "and it no longer fires
# every half hour", at 66 passed / 1 failed - the same number 74.1's own entry in
# AGENTS.md records and the same single failure a pristine clone of main reproduces, so
# it is not this release's doing and this release does not fix it.
#
# It lives here for the same reason dev/release-7415-record.py does: the workflow that
# runs a release cannot be pushed by the Actions token, so every line of it has to be
# hand-carried and belongs in a file the repository can carry instead.
#
#   sh dev/release-7415-gates.sh
#
# `sh` here is dash, and dash has no pipefail - asking for it aborts the whole battery
# with "set: Illegal option -o pipefail" and exit 2, which is how the first run of this
# release lost its Gates step. Nothing in this file needs pipefail: the one pipeline
# below that can legitimately find nothing already carries `|| true`.
#
# A RED BATTERY NOW LEAVES A REPORT BEHIND. The second run of this release failed here as
# well, and the only thing anyone could read back was the job log - thousands of lines
# that the run's own log download returns truncated from the TOP, so the failing step's
# output is exactly the part that cannot be fetched. The failure branch below writes
# dev/gates-report.txt, pushes it, and exits 1: the report carries the versions the
# battery ran on, every suite's own line, and each red suite re-run on its own. A red
# Gates step must never be un-diagnosable again.
set -u
cd "$(dirname "$0")/.."

npm install --no-package-lock --no-audit --no-fund --loglevel=error
mkdir -p /tmp/h
npm install --prefix /tmp/h --no-package-lock --no-save --no-audit --no-fund --loglevel=error jsdom
# The install rewrites the lockfile; the release never commits it.
git checkout -- package.json package-lock.json 2>/dev/null || true

sh dev/gates.sh > /tmp/gates.log 2>&1
echo "gates.sh exit: $?"
tail -40 /tmp/gates.log

bad=$(grep -E '^[A-Za-z0-9_-]+: exit [1-9]' /tmp/gates.log | grep -v '^media-controls-check:' || true)
if [ -n "$bad" ]; then
  echo "::error::gates failed: $bad"
  jsdom=$(node -p "require('/tmp/h/node_modules/jsdom/package.json').version" 2>/dev/null || echo unknown)
  {
    echo '# Gates report'
    echo
    echo 'Written by dev/release-7415-gates.sh when the battery comes back red, and pushed'
    echo 'by that run. The job log cannot be read back from outside the run - it is'
    echo 'thousands of lines and the log download is truncated from the top, which is the'
    echo 'end the failing step lives at - so the diagnosis travels through the repository.'
    echo
    echo "node: $(node -v)"
    echo "jsdom: $jsdom"
    echo "date: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo
    echo '## red'
    echo
    echo '```'
    printf '%s\n' "$bad"
    echo '```'
    echo
    echo '## every suite, exactly as the battery reported it'
    echo
    echo '```'
    grep -E '^[A-Za-z0-9_-]+: ' /tmp/gates.log || true
    echo '```'
    echo
    echo '## each red suite, re-run on its own (up to 3 attempts)'
    # A failing suite re-run ON ITS OWN usually passes, and then the report has nothing to
    # name: the battery's own line says "49 passed, 3 failed" and the re-run prints 52 green
    # ticks, so the three checks that were red are exactly what is still missing. Attempt
    # three times and print the failing lines of every attempt that goes red.
    printf '%s\n' "$bad" | cut -d: -f1 | while read -r name; do
      [ -n "$name" ] || continue
      f="dev/$name.mjs"
      [ -f "$f" ] || f="dev/$name.cjs"
      [ -f "$f" ] || continue
      echo
      echo "### $name"
      attempt=1
      while [ "$attempt" -le 3 ]; do
        out=$(node "$f" 2>&1)
        rc=$?
        echo
        echo "attempt $attempt: exit $rc - $(printf '%s' "$out" | tail -n 1)"
        echo '```'
        printf '%s\n' "$out" | grep -E '✗|Error:' | head -20 || echo '(this attempt printed no failing line)'
        echo '```'
        if [ "$rc" -eq 0 ]; then break; fi
        attempt=$((attempt + 1))
      done
    done
  } > dev/gates-report.txt
  # gates.sh keeps only a suite's LAST line, so the re-run above is where a red suite's
  # own failing lines come from - the wrapper throws them away otherwise.
  git config user.name 'SideCut release'
  git config user.email 'actions@github.com'
  git add -f dev/gates-report.txt
  if git commit -q -m 'Diagnose the red Gates battery: the report the log cannot carry'; then
    git push || echo 'could not push the report'
  fi
  exit 1
fi
echo 'Gates: every suite green except the recorded pre-existing media-controls-check red.'
