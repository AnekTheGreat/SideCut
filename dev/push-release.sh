#!/bin/sh
# Push the prepared release commit to GitHub.
#
# WHY THIS EXISTS. The cloud sandbox that builds a release has no git identity:
# no token in the environment, no ~/.git-credentials, no credential helper, no
# SSH agent. `git push` reports "could not read Username for 'https://github.com'"
# and stops. The token cannot be baked into this repo (it would be a public
# secret), so it arrives in the environment for one command:
#
#   GITHUB_TOKEN=github_pat_xxx sh dev/push-release.sh
#
# The helper is passed through `git -c credential.helper=...` rather than a URL
# with the token inside it, so the secret never lands in .git/config, in argv
# (visible in `ps`), or in the shell history of the remote config.
#
# After the push it prints the remote tip so the caller can see the commit that
# landed, and reminds about the OTA checks the deploy workflow runs.
set -eu

REPO=${REPO:-AnekTheGreat/SideCut}
BRANCH=${BRANCH:-main}
EXPECT=$(git rev-parse HEAD)
TOKEN=${GITHUB_TOKEN:-${GH_TOKEN:-}}

if [ -z "$TOKEN" ]; then
  echo "push-release: no GITHUB_TOKEN (or GH_TOKEN) in the environment" >&2
  echo "push-release: run as: GITHUB_TOKEN=... sh dev/push-release.sh" >&2
  exit 2
fi

# The helper answers exactly two prompts; `$1` is git's verb (get/store/erase).
HELPER='!f() { if [ "$1" = get ]; then echo username=x-access-token; echo "password=$GITHUB_TOKEN"; fi; }; f'

echo "push-release: pushing $EXPECT -> $REPO $BRANCH"
git -c credential.helper= -c credential.helper="$HELPER" \
    push "https://github.com/$REPO.git" "HEAD:refs/heads/$BRANCH"

TIP=$(git ls-remote "https://github.com/$REPO.git" "refs/heads/$BRANCH" | cut -f1)
echo "push-release: remote $BRANCH is now $TIP"
if [ "$TIP" = "$EXPECT" ]; then
  echo "push-release: OK - the release commit is on $BRANCH"
  echo "push-release: GitHub Actions will deploy Pages and rebuild both OTA channels."
else
  echo "push-release: MISMATCH - expected $EXPECT" >&2
  exit 1
fi
