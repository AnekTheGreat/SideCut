#!/usr/bin/env python3
"""Put the shipping note at the top of AGENTS.md, once.

AGENTS.md is ~860 KB, so it can never be carried through an API call from a sandbox -
which is the very constraint the note describes. So the note is written where the rest
of the memory is written: inside a runner, by an Actions job. The marker makes a second
dispatch a no-op.

    python3 dev/agents-shipping-note.py

(Written by the 80.0.3 session, after the eighth time in a row somebody went looking for
a git token that this sandbox does not have.)
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PATH = os.path.join(ROOT, 'AGENTS.md')
MARKER = '## How a release reaches GitHub'

NOTE = """## How a release reaches GitHub

- **THE SANDBOX HAS NO WRITE CREDENTIAL. THE GITHUB APP CONNECTION IS THE CREDENTIAL.**
  Checked exhaustively while shipping 80.0.3: no `GH_TOKEN` / `GITHUB_TOKEN` / PAT in
  `env`, no `~/.git-credentials`, no `~/.netrc`, no `~/.config/gh/hosts.yml`, `gh auth
  status` says not logged in, `~/.ssh` holds only `known_hosts` (`git@github.com` ->
  *Permission denied (publickey)*), `/workspace/repo.git` is the local base repo with no
  remote, and `git push` fails with *could not read Username for
  'https://github.com'*. Read access works (`git fetch`, `git ls-remote`,
  raw.githubusercontent); write access does not. **Do not spend another session hunting
  for a token that is not there.**
- **WHAT DOES WORK: the connected GitHub app (AnekTheGreat).** A file lands as an
  ordinary commit through the app's create/update-file call - one file per commit - and
  the release workflow is started with the app's workflow-dispatch call. 80.0.3 shipped
  exactly that way: six payload commits (`dev/patch-8003.py`, its revisions diff, the
  repin, the gate block, `dev/release-entry.md`, `dev/release-gates.sh`, the proof) and
  then `release.yml` with `version=80.0.3`, which produced commit `328fa64` - patch,
  repin, gate block, OTA rebuild, battery and the release commit all inside the runner.
- **VERIFY EVERY UPLOADED FILE BY BLOB SHA, NOT BY EYE.** `git hash-object <file>` before
  the upload must equal the `content.sha` the app returns afterwards (80.0.3: patch
  `dbcf1639`, revisions `5f8b4f60`, repin `c1996bdd`, gate block `ba3b47f8`, entry
  `96cc9e2f`, battery `62465f29`, proof `5fc7a496`). A mismatch is a transcription error,
  and the workflow's proof step stops the release rather than committing a wrong page.
- **NEVER RE-EMIT `index.html` OR THIS FILE THROUGH THE APP.** `index.html` is 3.4 MB and
  this file is ~860 KB; both are larger than a tool call can carry, and that is the whole
  reason a release is a payload. `dev/patch-<N>.py` edits the page **inside the runner**;
  `dev/release-record.py` edits this file **inside the runner**. AGENTS.md changes only
  from an Actions job (a release, or a one-off note like `dev/agents-shipping-note.py`),
  never by hand from a sandbox.
- **REHEARSE FROM `git archive origin/main` BEFORE DISPATCHING.** In a throwaway
  directory: apply the patch, the repin and the gate block, then require that
  `index.html` and every `dev/test-*.mjs` / `dev/*-check.cjs` are byte-identical to the
  tested tree, and that `sh dev/release-proof.sh <version> | sha256sum` equals the hash in
  `dev/release-<N>.proof`. The workflow enforces the same two things, and a release that
  skips the rehearsal only finds out after the battery.
- **A REVISION TO A PENDING RELEASE GOES IN THE PATCH, NOT INTO THE WORKING TREE ONLY.**
  The payload is reapplied to a clean `origin/main` by the runner. When the owner changes
  their mind mid-release (80.0.3: the pill cut side by side, and the Look-and-feel card
  out of Settings), fold it into `dev/patch-<N>.py` - 80.0.3 carries the second half in
  `dev/patch-8003-revisions.py` as one unified diff applied with `patch -p1` - and update
  `dev/release-<N>.proof`. A page edited only in the sandbox is a page that never ships.

"""


def main():
    with open(PATH, encoding='utf-8') as f:
        src = f.read()
    if MARKER in src:
        print('agents-shipping-note: the note is already there')
        return 0
    # Right under the H1, above the newest release entry: the first thing any session
    # reads, because no session reads 860 KB of memory.
    cut = src.index('\n## ')
    src = src[:cut + 1] + NOTE + src[cut + 1:]
    with open(PATH, 'w', encoding='utf-8') as f:
        f.write(src)
    print('agents-shipping-note: inserted the shipping note under the title')
    return 0


if __name__ == '__main__':
    sys.exit(main())
