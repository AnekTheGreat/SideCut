## 84.0.0 ({{STAMP}}): the number after 83.9.0 is 84.0.0

83.10.0 was cut by mistake. A release here is major.minor.patch and the middle
number is a single digit, so 83.9.0 is followed by 84.0.0 and never by a
two-digit minor. The page, the service worker's cache and the release notes are
renumbered; the Mix Pad work they describe is untouched.

`dev/release-record.py` now refuses a version with a two-digit minor, and it is
the step every release runs, so the number cannot be cut that way again.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only.
