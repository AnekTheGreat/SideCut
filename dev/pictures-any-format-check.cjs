// 80.2.9 — "HEIC format and all formats should be accepted for pictures".
//
// Two defects, one shape. The Album History cover picker refused any file whose
// MIME type did not start with `image/`, so a HEIC photo (or a file a cloud app
// handed over with no type at all) came back as "Not an image". The other
// pickers kept whatever bytes arrived, which only draw on a WebView with the HEVC
// codec and do not belong in an ID3 APIC frame.
//
// What this proves:
//   1. the shared door (scPicCoverFromFile) turns a picture of ANY type - no MIME,
//      a HEIC name, an oversized camera frame - into a JPEG data URL and blob;
//   2. a picture this device cannot decode is reported, not silently dropped;
//   3. every picture picker in the app goes through that door, and the old
//      type-based rejection is gone.
//
// It stubs the decoder (jsdom has no canvas and no HEVC codec), so it proves the
// plumbing: what is fed a file gets back, shrunk, as JPEG. Whether a particular
// phone's codec opens a particular HEIC is the platform's answer, and that is
// what the rejection path is for.
//
//   NODE_PATH=/tmp/h/node_modules node dev/pictures-any-format-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const modSource = fs.readFileSync(path.join(ROOT, 'dev', 'sc70-module.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
}

// A 3 KB JPEG-ish payload: enough that the helper's "shorter than 64 chars" guard
// reads it as a real picture, and enough for atob to produce a non-empty blob.
const JPEG_BYTES = Buffer.alloc(3000, 0x41);
const JPEG_URL = 'data:image/jpeg;base64,' + JPEG_BYTES.toString('base64');

const vc = new VirtualConsole();
vc.on('jsdomError', () => {});

// A camera HEIC: 4032x3024, no MIME type at all (the shape that used to be
// rejected, and the shape that used to blow the localStorage row with 5 MB of
// base64).
let nextImageFails = false;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, {
      get(t, p) {
        if (p === 'canvas') return { width: 1, height: 1 };
        if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
        return undefined;
      },
      set(t, p, v) { t[p] = v; return true; },
    }); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return JPEG_URL; };
    class FakeImage {
      constructor() { this.naturalWidth = 0; this.naturalHeight = 0; }
      set src(v) {
        this._src = v;
        setTimeout(() => {
          if (nextImageFails) { if (this.onerror) this.onerror(new win.Error('decode')); return; }
          this.naturalWidth = 4032; this.naturalHeight = 3024;
          if (this.onload) this.onload();
        }, 0);
      }
      get src() { return this._src; }
    }
    win.Image = FakeImage;
    win.URL.createObjectURL = () => 'blob:stub';
    win.URL.revokeObjectURL = () => {};
    win.indexedDB = { open() { const req = {}; setTimeout(() => { req.onsuccess && req.onsuccess({ target: req }); }, 0); return req; } };
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

const win = dom.window;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('the shared picture door');
  ok('scPicCoverFromFile is published on window', typeof win.scPicCoverFromFile === 'function');

  const heic = new win.File([Buffer.from([0x00, 0x00, 0x00, 0x18])], 'IMG_20261026_055912.HEIC', { type: '' });
  const pic = await win.scPicCoverFromFile(heic, 1024, 0.85).catch((e) => ({ err: e }));
  ok('a HEIC with no MIME type is accepted', !pic.err, pic.err && pic.err.message);
  ok('it comes back as a JPEG data URL', !!pic.dataUrl && pic.dataUrl.indexOf('data:image/jpeg') === 0, (pic.dataUrl || '').slice(0, 24));
  ok('it comes back as a JPEG blob', !!pic.blob && pic.blob.type === 'image/jpeg', pic.blob && pic.blob.type);
  ok('the blob carries the picture, not zero bytes', !!pic.blob && pic.blob.size > 1000, pic.blob && pic.blob.size);
  ok('the long edge is shrunk to the cap', pic.width === 1024 && pic.height === 768, pic.width + 'x' + pic.height);

  const noType = new win.File([Buffer.from([0xff, 0xd8])], 'download', { type: 'application/octet-stream' });
  const pic2 = await win.scPicCoverFromFile(noType, 512, 0.78).catch((e) => ({ err: e }));
  ok('an octet-stream picture is accepted too', !pic2.err && pic2.blob.type === 'image/jpeg');

  nextImageFails = true;
  const dead = await win.scPicCoverFromFile(heic, 1024, 0.85).then(() => null, (e) => e);
  ok('a picture this device cannot decode rejects as undecodable', !!dead && dead.message === 'undecodable', dead && dead.message);
  nextImageFails = false;

  console.log('every picture picker goes through it');
  const calls = (html.match(/window\.scPicCoverFromFile/g) || []).length;
  ok('index.html has the definition plus five call sites', calls === 6, 'found ' + calls);
  ok('the Album History picker no longer gates on file.type',
    html.indexOf("!file.type.startsWith('image/')") === -1);
  ok('it decodes instead of storing the raw bytes',
    /scPicCoverFromFile\(file, 1024, 0\.8\)\.then\(function\(pic\)\{ resolve\(pic\.dataUrl\)/.test(html));
  ok('the song cover stores the normalised blob, not the picked file',
    html.indexOf('t.artBlob = pic.blob;') !== -1 && html.indexOf('t.artBlob = file;') === -1);
  ok('the album cover picker decodes first',
    html.indexOf('window.scPicCoverFromFile(file, 512, 0.78)') !== -1);
  ok('the Studio batch cover decodes first',
    html.indexOf('window.scPicCoverFromFile(f, 1024, 0.85)') !== -1);
  ok('the Studio module copy matches the spliced block',
    modSource.indexOf('window.scPicCoverFromFile(f, 1024, 0.85)') !== -1);

  await wait(20);
  console.log('');
  console.log(fail === 0 ? 'ALL ' + pass + ' CHECKS PASSED' : pass + ' passed, ' + fail + ' FAILED');
  process.exit(fail === 0 ? 0 : 1);
})();
