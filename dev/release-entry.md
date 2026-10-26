## 80.2.9 ({{STAMP}}): any picture works as a cover - HEIC from the camera roll included

- **THE OWNER ASKED FOR ONE THING.** *"for HEIC format and all formats should be
  accepted for pictures"*. Two separate defects were in the way, and both had to go
  for a HEIC photo to become a cover.
- **THE ALBUM HISTORY PICKER ASKED THE FILE FOR ITS TYPE.** `_ahFileToDataURL` refused
  anything whose `file.type` did not start with `image/`, so a picture a cloud app
  handed over with no type (or with `application/octet-stream`) came back as "Not an
  image". A phone's own HEIC photo is `image/heic` and got through - into a different
  bug: the untouched bytes were written into a `localStorage` row, 4-6 MB of base64
  against a ~5 MB quota, so the write threw and the cover silently never saved.
- **THE OTHER PICKERS KEPT WHATEVER ARRIVED.** The song cover, the album cover and the
  Studio batch-cover picker stored the picked file as-is. HEIC bytes only draw on a
  WebView with the HEVC codec (Android 8+), and HEIC bytes inside an ID3 APIC frame are
  not a cover another player can read.
- **ONE DOOR.** `window.scPicCoverFromFile(file, maxPx, quality)` decodes the picture,
  draws it to a canvas at most `maxPx` on its long edge and re-encodes it as JPEG,
  resolving `{dataUrl, blob, width, height}` or rejecting `Error('undecodable')`.
  Nothing in it reads `file.type` or the file name, so the formats accepted are
  exactly the ones the phone can decode: HEIC/HEIF, AVIF, TIFF, BMP, WebP, GIF, PNG,
  JPEG, and a MIME-less file. Five call sites go through it - song cover (1024px),
  album cover (512px), Album History cover (1024px), Studio batch cover (1024px,
  wrapped back into a `File` so the batch writer's `instanceof File` check and the
  `.jpg` label still behave), and the helper itself.
- **WHAT FAILS NOW SAYS SO.** A picture this device cannot open (HEIC on an older
  Android with no HEVC decoder, an exotic profile) reports "Could not read that
  picture on this device" instead of doing nothing, which is what the pickers used to
  do when a decode went wrong.
- **THE CHOOSER IS UNCHANGED, ON PURPOSE.** `accept="image/*"` stays. It is only the
  file-chooser filter and already reaches `image/heic` on Android 8+; adding
  extensions to it hands Android a list of "MIME types" it cannot resolve, which is how
  a picker ends up showing no files at all.
- **VERIFIED, ON THE PAGE AS IT SHIPS.** `dev/pictures-any-format-check.cjs` boots
  index.html in jsdom and drives the real door: a `File` named
  `IMG_20261026_055912.HEIC` with an EMPTY type resolves to a `data:image/jpeg` data
  URL and an `image/jpeg` blob (not zero bytes), 4032x3024 is stored as 1024x768, an
  `application/octet-stream` picture works the same way, and a decoder that fails
  rejects as `undecodable` - 15 checks, all green. The same run asserts every picker
  goes through the door and that the old `file.type.startsWith('image/')` gate is
  gone. The payload was then applied to a clean checkout of this commit and both
  `index.html` and `dev/sc70-module.js` came out byte-identical to the tree the
  checks ran on. Every inline script block parses. Not tested: the decode of a real
  HEIC file on a real phone - jsdom has no HEVC codec, so that is the platform's
  answer at runtime, which is what the rejection path exists for.
- **THE BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}} bytes, rebuilt to a true fixed point
  in the runner before this entry is written, and settled again by deploy.yml on the
  push. Both `--check`s green on the tree that ships.
