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
  exit 1
fi
echo 'Gates: every suite green except the recorded pre-existing media-controls-check red.'
