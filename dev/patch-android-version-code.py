#!/usr/bin/env python3
"""Write the version-code section into AGENTS.md.

WHY A FIXER. AGENTS.md is 950 KB - the repository memory - and it does not fit through the
contents API in one request. So this one section travels as an insertion against the
checked-out file: the file must still start with its title, and the section must not be
there already. Nothing else is touched.

The change it records is in `.github/workflows/patch-version.py`: the Play version code is
the build's workflow run now, not the `androidVersionCode` pin package.json used to carry.
android-build.yml did not have to change for that - its step already calls the script - and
it could not have been changed from here in any case: `workflows` is not a GITHUB_TOKEN
scope, so a commit that edits a workflow file is refused at the push ("refusing to allow a
GitHub App to create or update workflow ... without `workflows` permission"), whatever the
`permissions:` block of the run says.

  python3 dev/patch-android-version-code.py
  python3 dev/patch-android-version-code.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
CHECK = '--check' in sys.argv
AGENTS = os.path.join(ROOT, 'AGENTS.md')

MARKER = '## The Android version code (October 26, 2026)'

NOTE = """## The Android version code (October 26, 2026): the bundle's number comes from the build's run

- **THE OWNER, WITH A SCREENSHOT OF PLAY.** `SideCut-5.0.55-release.aab` refused with *"Version code 512000
  has already been used. Try another version code."* The ask was one word: *"update"*.
- **WHY 512000 WAS SPENT TWICE.** The 5.0.55 bundle in the `apk-80.2.8-release` release (built 25 October, run
  566) carries `versionCode` **512000** *and* `APP_VERSION` **80.2.8** - it was uploaded, so Play owns the
  number - and the rebuild made after 80.3 / 80.3.1 carried the same 512000 because both took it from
  `package.json`'s `androidVersionCode` pin, which nothing bumps but a person. The app is built more than once
  per package.json `"version"` *precisely* because it ships over the air between Play uploads, so a
  hand-maintained number is the wrong shape for it. (Same failure as 5.0.54's 511722, one layer up.)
- **THE NUMBER IS NOW THE RUN'S.** `.github/workflows/patch-version.py` computes
  `versionCode = 512001 + 10 * (GITHUB_RUN_NUMBER - 567) + (GITHUB_RUN_ATTEMPT - 1)`. Run numbers cannot repeat
  or go backwards, a re-run only changes the attempt, ten attempts are reserved per run and the stride between
  runs is those ten, so the sequence is monotone by construction: 567/1 -> 512001, 567/2 -> 512002, 568/1 ->
  512011. **No run number is a hard failure, not a fallback to a pin.** The script exits if the gradle
  versionCode/versionName replace did not take, prints what it wrote, and `--print-code` prints the same number
  for anything that wants to check an artifact against it. `androidVersionCode` is gone from package.json.
- **A REJECTED UPLOAD STILL SPENDS ITS CODE**, so a rebuild is a NEW dispatch - "Re-run all jobs" gets a new
  number only while the attempts of that run have codes left. `dev/version-code-check.py` drives the script
  through 58 consecutive builds, both attempts of each, the spent block (566) and the missing-run case: **14/14**.
- **`workflows` IS NOT A GITHUB_TOKEN SCOPE.** The first attempt to land this from a workflow failed at the
  push - "refusing to allow a GitHub App to create or update workflow `.github/workflows/android-build.yml`
  without `workflows` permission" - and `permissions: workflows: write` is not a thing (the run does not even
  parse). A commit that edits a workflow file needs a token that carries that permission; GITHUB_TOKEN never
  does, however the `permissions:` block is written.

"""

ANCHOR = '# SideCut ' + chr(0x2014) + ' repository memory\n\n'


def main():
    agents = open(AGENTS, encoding='utf-8').read()
    if MARKER in agents:
        print('  present: AGENTS.md records why the number moved to the run')
        return 0
    if CHECK:
        print('  pending: AGENTS.md has no section for the version code')
        return 1
    if not agents.startswith(ANCHOR):
        sys.exit('patch-android-version-code: AGENTS.md does not start with its title - '
                 'nothing was written')
    open(AGENTS, 'w', encoding='utf-8').write(NOTE + agents[len(ANCHOR):])
    print('  applied: the AGENTS.md section')
    return 0


if __name__ == '__main__':
    sys.exit(main())
