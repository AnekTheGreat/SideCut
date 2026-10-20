#!/usr/bin/env sh
# EVERY FILE A RELEASE OWNS, HASHED. The release tools edit files inside the
# repository - the page, the shell cache, eighty gates and one gate's block - and
# the question that matters is whether what they produced there is the tree that
# was rehearsed out here. This prints the listing; the one line in
# dev/release-<version>.proof is this listing's own hash, and the workflow compares
# the two before it runs the battery.
#
#   sh dev/release-proof.sh 74.1.6              # the listing, one line per file
#   sh dev/release-proof.sh 74.1.6 | sha256sum  # the digest dev/release-<ver>.proof carries
#
# index.html is deliberately NOT in the listing: its changelog stamp is written at
# apply time, so the page can never hash the same twice. What stands behind the page
# is patch-<version>.py --check (the version, the bubble, its stylesheet rule) and
# the battery that then runs on the bytes it wrote.
#
# The order is fixed (LC_ALL=C, one sorted line per file) because both sides hash the
# output: the SAME order here and in the runner, or the digests cannot agree.
set -u
cd "$(dirname "$0")/.."
V="${1:?usage: sh dev/release-proof.sh <version>}"
# The release's ID as its files are named: the tools drop the dots (74.1.6 -> 7416),
# the same way every patch and repin before this one is named after its release.
N=$(printf '%s' "$V" | tr -d '.')

for f in "dev/patch-$N.py" "dev/repin-$N.mjs" "dev/patch-gate-$N.py" "dev/storeinfo-$N-block.js"; do
  [ -f "$f" ] || { echo "release-proof: $f is missing" >&2; exit 1; }
done
# The page text the patch writes is split across sibling files (see the header of
# dev/patch-$N.py), so they are part of the listing too - all of them, without
# naming them, so a release that splits its text differently needs no edit here.

LC_ALL=C sha256sum \
  $(LC_ALL=C ls dev/test-*.mjs | LC_ALL=C sort) \
  $(LC_ALL=C ls dev/*-check.cjs | LC_ALL=C sort) \
  $(LC_ALL=C ls dev/patch-$N-*.py 2>/dev/null | LC_ALL=C sort) \
  "dev/patch-$N.py" \
  "dev/repin-$N.mjs" \
  "dev/patch-gate-$N.py" \
  "dev/storeinfo-$N-block.js" \
  dev/release-entry.md \
  dev/release-gates.sh \
  dev/release-record.py \
  dev/release-proof.sh \
  sw.js \
  .github/workflows/release.yml
