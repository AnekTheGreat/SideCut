#!/usr/bin/env python3
"""80.2.9 - any picture, any format, HEIC included.

Owner's words: "HEIC format and all formats should be accepted for pictures".

`_ahFileToDataURL` (Album History's cover picker) refused anything whose `file.type`
did not start with `image/`, so a picture a cloud app handed over with no type came
back as "Not an image"; a file that did get through was written into a localStorage
row untouched (4-6 MB of base64 against a ~5 MB quota, so the write threw and the
cover silently never saved). The song cover, album cover and Studio batch-cover
pickers kept the picked file as-is, and HEIC bytes only draw on a WebView with the
HEVC codec (Android 8+).

One door now: `window.scPicCoverFromFile(file, maxPx, quality)` decodes the picture,
shrinks it to `maxPx` on its long edge and re-encodes it as JPEG, rejecting
`Error('undecodable')` when the platform cannot open the file. Nothing there reads
`file.type` or the file name, so the formats accepted are the ones the phone can
decode. Five call sites: song cover (1024), album cover (512), Album History cover
(1024), Studio batch cover (1024, wrapped back into a File), and the helper itself.

`accept="image/*"` is left alone on the inputs: it is only the chooser filter and
already reaches image/heic on Android 8+; extensions there are handed to Android as
MIME types, which is how a picker ends up showing no files.

Also in this diff, because a release is one page: APP_VERSION 80.2.9, the CHANGELOG
entry, and the shell cache name in sw.js.

Verified in the session that wrote it (dev/pictures-any-format-check.cjs, 15 checks
on this page), and the payload applied to a clean checkout of its base commit comes
out byte-identical to the tree those checks ran on.

Idempotent: the marker is scPicCoverFromFile in the page. A second run says so and
changes nothing.

    python3 dev/patch-8029.py
    python3 dev/patch-8029.py --check
"""
import io
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.9'
MARKER = 'window.scPicCoverFromFile'

HELPER_ANCHOR = "  // One picture in, one small cover out. Whatever was picked - a camera photo or"

HELPER = u"""  // ANY picture, any format. Phones hand a camera photo over as HEIC/HEIF by
  // default, and a pick from a gallery or a cloud app can arrive as AVIF, as TIFF
  // or with no MIME type at all (application/octet-stream, or an empty type). So
  // nothing here reads `file.type` or the file name: the only question is whether
  // this device can decode it. The file is drawn to a canvas at most `maxPx` on
  // its long edge and re-encoded as JPEG, which is the form every place a cover
  // lands can read - IndexedDB art, the localStorage rows album covers live in (a
  // full phone photo does not fit there), an ID3 APIC frame, and an <img> on any
  // WebView.
  //
  // The pickers' own accept="image/*" stays the only format filter, and it reaches
  // image/heic on Android 8 and newer. Rejects with Error('undecodable') when the
  // decoder will not open the file (HEIC on Android 7, or a profile the platform
  // codec does not know), so the caller can say so instead of doing nothing.
  window.scPicCoverFromFile = function(file, maxPx, quality){
    return new Promise(function(resolve, reject){
      if(!file){ reject(new Error('undecodable')); return; }
      var max = maxPx || 1024;
      var q = quality || 0.82;
      var url = '';
      var img = new Image();
      var settled = false;
      function end(fn, value){
        if(settled) return;
        settled = true;
        try{ if(url) URL.revokeObjectURL(url); }catch(_e){}
        fn(value);
      }
      img.onload = function(){
        try{
          var w0 = img.naturalWidth || img.width || 0;
          var h0 = img.naturalHeight || img.height || 0;
          if(!w0 || !h0) throw new Error('undecodable');
          var s = Math.min(1, max / Math.max(w0, h0));
          var w = Math.max(1, Math.round(w0 * s));
          var h = Math.max(1, Math.round(h0 * s));
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          var out = cv.toDataURL('image/jpeg', q);
          if(!out || out.length < 64) throw new Error('undecodable');
          var bin = atob(out.slice(out.indexOf(',') + 1) || '');
          var buf = new Uint8Array(bin.length);
          for(var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          end(resolve, { dataUrl: out, blob: new Blob([buf], { type: 'image/jpeg' }), width: w, height: h });
        }catch(e){ end(reject, new Error('undecodable')); }
      };
      img.onerror = function(){ end(reject, new Error('undecodable')); };
      try{
        url = URL.createObjectURL(file);
        img.src = url;
      }catch(e){ end(reject, new Error('undecodable')); }
    });
  };

"""

ALBUM_OLD = u"""        input.addEventListener('change', function(){
          try{
            if(input.files && input.files[0]){
              const file = input.files[0];
              const reader = new FileReader();
              reader.onload = function(){ albumCoverFromImage(name, String(reader.result || ''), ''); };
              reader.onerror = function(){ toast('Could not read that picture.', 3000); };
              reader.readAsDataURL(file);
            } else if(input.parentNode) input.parentNode.removeChild(input);
          }catch(_eCF){ }
        });"""

ALBUM_NEW = u"""        input.addEventListener('change', function(){
          try{
            if(input.files && input.files[0]){
              const file = input.files[0];
              // Any picture, any format: decoded and shrunk first, so a HEIC
              // straight off a camera is accepted here instead of failing on a
              // decoder this WebView does not have.
              window.scPicCoverFromFile(file, 512, 0.78).then(function(pic){
                albumCoverFromImage(name, pic.dataUrl, '');
              }).catch(function(){
                toast('Could not read that picture on this device.', 3200);
              });
            } else if(input.parentNode) input.parentNode.removeChild(input);
          }catch(_eCF){ }
        });"""

SONG_OLD = u"""    try{
      if(t.artUrl){ try{ URL.revokeObjectURL(t.artUrl); }catch(e){} }
      t.artBlob = file;
      t.artUrl = URL.createObjectURL(file);
      persistTrackMeta(t);"""

SONG_NEW = u"""    try{
      // Any picture, any format. It is decoded and shrunk to a JPEG before it is
      // stored: a HEIC straight from a camera does not draw on a WebView without
      // the HEVC codec and is far too big for the meta row this cover lives in.
      const pic = await window.scPicCoverFromFile(file, 1024, 0.85);
      if(t.artUrl){ try{ URL.revokeObjectURL(t.artUrl); }catch(e){} }
      t.artBlob = pic.blob;
      t.artUrl = URL.createObjectURL(pic.blob);
      persistTrackMeta(t);"""

SONG_TOAST_OLD = u"""    }catch(e){
      toast('Failed to set cover');
    }"""

SONG_TOAST_NEW = u"""    }catch(e){
      toast('Could not read that picture on this device.', 3200);
    }"""

AH_OLD = u"""  function _ahFileToDataURL(file){
    return new Promise(function(resolve, reject){
      if(!file || !file.type.startsWith('image/')){ reject('Not an image'); return; }
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = function(){ reject('Read failed'); };
      reader.readAsDataURL(file);
    });
  }"""

AH_NEW = u"""  function _ahFileToDataURL(file){
    return new Promise(function(resolve, reject){
      if(!file){ reject('No picture'); return; }
      // Any picture, any format. This used to refuse anything whose type did not
      // start with 'image/', which threw away HEIC photos from a phone camera and
      // every file a cloud app handed over with no MIME type. The picture is
      // decoded, shrunk and stored as a small JPEG now rather than being kept as
      // it came: a full-size photo does not fit in the localStorage row these
      // covers live in, and HEIC bytes do not draw on an older WebView.
      if(typeof window.scPicCoverFromFile === 'function'){
        window.scPicCoverFromFile(file, 1024, 0.8).then(function(pic){ resolve(pic.dataUrl); },
          function(){ reject('Could not read that picture'); });
        return;
      }
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = function(){ reject('Read failed'); };
      reader.readAsDataURL(file);
    });
  }"""

BATCH_OLD = u"""    if(cf) cf.addEventListener('change', function(){
      var f = cf.files && cf.files[0];
      if(!f) return;
      batch.cover = f;
      var l = $('scBatchCoverLbl');
      if(l) l.textContent = f.name.length > 26 ? f.name.slice(0, 23) + '\\u2026' : f.name;
    });"""

BATCH_NEW = u"""    if(cf) cf.addEventListener('change', function(){
      var f = cf.files && cf.files[0];
      if(!f) return;
      var l = $('scBatchCoverLbl');
      // Any picture, any format. The picked file is shrunk to a JPEG before it is
      // offered, so a HEIC photo works and the APIC frame written into the ID3 tag
      // is one every other player can read.
      window.scPicCoverFromFile(f, 1024, 0.85).then(function(pic){
        try{ f = new File([pic.blob], String(f.name || 'cover').replace(/\\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }); }
        catch(_eF){ f = pic.blob; }
        batch.cover = f;
        var nm = String(f.name || 'cover');
        if(l) l.textContent = nm.length > 26 ? nm.slice(0, 23) + '\\u2026' : nm;
      }).catch(function(){
        if(l) l.textContent = 'Could not read that picture';
      });
    });"""

CHANGELOG_ANCHOR = u"""  const CHANGELOG = [
"""

CHANGELOG_ENTRY = u"""  { version: '80.2.9', date: 'October 26, 2026 \\u00b7 6:20 AM EDT', title: 'Any picture, any format - a HEIC photo from the camera roll works as a cover', items: [
    'A photo from the camera roll now works as a cover whatever format it is in: HEIC from an iPhone, Samsung or Pixel camera, AVIF, TIFF, BMP, or a file that arrives with no file type at all.',
    'The song cover, the album cover, the Album History cover and the Studio batch editor all take the picture the same way, so none of them refuses what another one accepts.',
    'The picked picture is shrunk and saved as a JPEG, so a 6 MB camera photo no longer runs out of room and leaves a cover that disappears the next time the app opens.',
    'If the phone itself cannot open a picture - an older Android with no HEIC decoder - the app says so instead of doing nothing at all.',
    'Covers are capped at 1024px (512px for an album), so a cover does not depend on how big the file you picked was.',
    'The audio, the player, the library list, the lyrics and the OTA bundle are untouched.',
  ],
    details: [
      'Album History\\'s cover picker refused any file whose MIME type did not start with image/, which turned a HEIC photo from a phone camera - and any picture a cloud app handed over with no type at all - into \\"Not an image\\". The other pickers kept the picked file exactly as it arrived: HEIC bytes only draw on a WebView with the HEVC codec, and HEIC bytes in an ID3 APIC frame are not a cover another player can read.',
      'There is one door now, scPicCoverFromFile: the picture is decoded, drawn to a canvas at most 1024px on its long edge and re-encoded as a JPEG. That is the form IndexedDB art, the localStorage rows album covers live in, an ID3 APIC frame and an <img> on any WebView can read - and it is why the question \\"which formats are accepted\\" now has one answer: whichever ones this phone can decode.',
      'The pickers keep accept=\\"image/*\\", which is only the chooser filter and already reaches image/heic on Android 8 and newer. Extensions are deliberately not added to it: Android receives those as MIME types, which is how a file chooser ends up showing nothing.',
      'A photo that used to be stored whole was the other half of the bug: a 4-6 MB HEIC written into a localStorage row exceeds the ~5 MB quota, the write throws, and the cover silently never saved. Shrinking first is what makes the save stick.',
    ],
  },
"""

EDITS = [
    ('index.html', HELPER_ANCHOR, HELPER + HELPER_ANCHOR),
    ('index.html', ALBUM_OLD, ALBUM_NEW),
    ('index.html', SONG_OLD, SONG_NEW),
    ('index.html', SONG_TOAST_OLD, SONG_TOAST_NEW),
    ('index.html', AH_OLD, AH_NEW),
    ('index.html', BATCH_OLD, BATCH_NEW),
    ('index.html', "const APP_VERSION = '80.2.8';", "const APP_VERSION = '80.2.9';"),
    ('index.html', CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + CHANGELOG_ENTRY),
    ('dev/sc70-module.js', BATCH_OLD, BATCH_NEW),
    ('sw.js', "const CACHE_NAME = 'sidecut-shell-v80.2.8';", "const CACHE_NAME = 'sidecut-shell-v80.2.9';"),
]


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def write(rel, text):
    with io.open(os.path.join(ROOT, rel), 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def main():
    page = read('index.html')
    mod = read('dev/sc70-module.js')
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in mod:
        print('  present: any picture format accepted, and the page runs as ' + VERSION)
        print('patch-8029%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0

    # Every anchor has to be there exactly once, or this patch is aimed at a page it
    # was not written for. That runs on --check too: a dry run that cannot find its
    # anchors is a payload for some other tree, not a pending release.
    for rel, old, new in EDITS:
        src = page if rel == 'index.html' else (mod if rel == 'dev/sc70-module.js' else read(rel))
        n = src.count(old)
        if n != 1:
            sys.exit('patch-8029: %s - anchor found %d times, expected exactly once' % (rel, n))

    if CHECK:
        # A DRY RUN THAT SUCCEEDS MEANS THIS RELEASE IS STILL PENDING, and the exit
        # status has to say so: release.yml reads it to decide whether anything is
        # left to do.
        print('patch-8029 --check: the release is pending, 1 step to apply')
        return 1

    changed = set()
    for rel, old, new in EDITS:
        src = page if rel == 'index.html' else (mod if rel == 'dev/sc70-module.js' else read(rel))
        src = src.replace(old, new, 1)
        if rel == 'index.html':
            page = src
        elif rel == 'dev/sc70-module.js':
            mod = src
        else:
            write(rel, src)
        changed.add(rel)
    if 'index.html' in changed:
        write('index.html', page)
    if 'dev/sc70-module.js' in changed:
        write('dev/sc70-module.js', mod)

    check = read('index.html')
    if MARKER not in check or ("const APP_VERSION = '%s';" % VERSION) not in check:
        sys.exit('patch-8029: the page did not take the patch')
    print('  applied: the picture door, its five call sites, the version and the notes')
    print('patch-8029: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
