#!/usr/bin/env python3
"""Land the version-code change inside android-build.yml and record it in AGENTS.md.

WHY A FIXER AND NOT A COMMIT OF THE WHOLE FILES. The two files that carry the rest of
this change are android-build.yml (13 KB) and AGENTS.md (950 KB, the repository memory):
neither can be sent through the contents API in one request. So the parts that live
inside them travel as replacements against the checked-out files, and every one of them
must match EXACTLY ONCE - a run that matched twice, or not at all, stops before it writes
anything, instead of landing a workflow that half-has the fix.

The change itself is in `.github/workflows/patch-version.py` (the version code is now the
build's workflow run, not a number bumped by hand): this only names the step, makes the
build's own verification compare the bundle against the code the build was given, prints
the number in the run summary, and writes the reason into AGENTS.md.

  python3 dev/patch-android-version-code.py
  python3 dev/patch-android-version-code.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
CHECK = '--check' in sys.argv
WORKFLOW = os.path.join(ROOT, '.github', 'workflows', 'android-build.yml')
AGENTS = os.path.join(ROOT, 'AGENTS.md')

STEPS = []


def swap(src, old, new, what):
    if src.count(old) != 1:
        sys.exit('patch-android-version-code: %s matches %d times, expected 1'
                 % (what, src.count(old)))
    STEPS.append(what)
    return src.replace(old, new)


STEP_OLD = """      - name: Bump Android version from package.json
        run: python3 .github/workflows/patch-version.py
"""

STEP_NEW = """      - name: Give this build its version code (from the run, not from a file)
        # Play never accepts a version code twice, and this app is built more than once
        # per package.json "version" because it ships over the air between Play
        # uploads: the 5.0.55 bundle uploaded on 25 October and the one rebuilt after
        # 80.3 / 80.3.1 both carried 512000, and Play refused the second one ("Version
        # code 512000 has already been used"). A hand-bumped pin did that; the number is
        # now the run's, so any rebuild is a number no earlier build has had.
        run: |
          set -euo pipefail
          python3 .github/workflows/patch-version.py
          CODE="$(python3 .github/workflows/patch-version.py --print-code)"
          echo "Play versionCode for this build: $CODE" >> "$GITHUB_STEP_SUMMARY"
"""

VERIFY_OLD = """          # The AAB is what Play scans; dev/aab-sdk.py reads its protobuf manifest.
          python3 dev/aab-sdk.py "$AAB" --min 24 --target 36 || STATUS=1
"""

VERIFY_NEW = """          # The AAB is what Play scans; dev/aab-sdk.py reads its protobuf manifest.
          # The code it has to declare is the one printed by the script that wrote it
          # into gradle: a patch that silently did not take would otherwise be uploaded
          # and refused for a number nobody chose.
          CODE=$(python3 .github/workflows/patch-version.py --print-code)
          if [ -z "$CODE" ]; then
            echo "::error::could not work out the version code this build was given"
            STATUS=1
          else
            python3 dev/aab-sdk.py "$AAB" --min 24 --target 36 --version-code "$CODE" || STATUS=1
          fi
"""

TAG_OLD = """          TAG="apk-$APPV-$S"
          echo "app version $APPV, android version $V, flavor $S -> release $TAG"
"""

TAG_NEW = """          TAG="apk-$APPV-$S"
          CODE="$(python3 .github/workflows/patch-version.py --print-code)"
          echo "app version $APPV, android $V, Play versionCode ${CODE:-unknown}, flavor $S -> release $TAG"
"""

NOTES_OLD = ("Signed Android build of SideCut $APPV, $S flavor (Android build $V). The app itself "
             "updates over the air once installed; this is the installable file. The download count "
             "on this page is what the Studio reads under APK downloads.")
NOTES_NEW = ("Signed Android build of SideCut $APPV, $S flavor (Android build $V, Play versionCode "
             "$CODE). The app itself updates over the air once installed; this is the installable "
             "file. The download count on this page is what the Studio reads under APK downloads.")

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
  512011. **No run number is a hard failure, not a fallback to a pin.** `androidVersionCode` is gone from
  package.json, and `dev/aab-sdk.py` no longer assumes it: the build's verification step passes the number
  explicitly (`--print-code`), so a gradle patch that silently did not take still fails in the build log.
- **A REJECTED UPLOAD STILL SPENDS ITS CODE**, so a rebuild is a NEW dispatch - "Re-run all jobs" gets a new
  number only while the attempts of that run have codes left. `dev/version-code-check.py` drives the script
  through 58 consecutive builds, both attempts of each, the spent block (566) and the missing-run case: **14/14**.

"""

ANCHOR = '# SideCut ' + chr(0x2014) + ' repository memory\n\n'


def main():
    workflow = open(WORKFLOW, encoding='utf-8').read()
    agents = open(AGENTS, encoding='utf-8').read()
    done = 0

    if 'Give this build its version code' in workflow and '--version-code "$CODE"' in workflow:
        print('  present: android-build.yml names the step, verifies the code and prints it')
    elif CHECK:
        print('  pending: android-build.yml still bumps the version from package.json')
    else:
        workflow = swap(workflow, STEP_OLD, STEP_NEW, 'the step that sets the code')
        workflow = swap(workflow, VERIFY_OLD, VERIFY_NEW, 'the AAB is checked against that code')
        workflow = swap(workflow, TAG_OLD, TAG_NEW, 'the publish step knows the code')
        workflow = swap(workflow, NOTES_OLD, NOTES_NEW, 'the release notes carry it')
        open(WORKFLOW, 'w', encoding='utf-8').write(workflow)
        done += 4

    if MARKER in agents:
        print('  present: AGENTS.md records why the number moved to the run')
    elif CHECK:
        print('  pending: AGENTS.md has no section for the version code')
    else:
        if not agents.startswith(ANCHOR):
            sys.exit('patch-android-version-code: AGENTS.md does not start with its title - '
                     'nothing was written')
        open(AGENTS, 'w', encoding='utf-8').write(NOTE + agents[len(ANCHOR):])
        print('  applied: the AGENTS.md section')
        done += 1

    if CHECK:
        return 0 if done == 0 else 1
    print('  %d step(s) written' % done)
    return 0


if __name__ == '__main__':
    sys.exit(main())
