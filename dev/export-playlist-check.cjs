// Two things the shipped build got wrong, driven through the real page.
//
// 1) The multi-select bar (Create album / Add to album / Export / Delete) had no
//    way to drop the selection into a playlist, and the playlist picker only
//    accepted a single song id.
//
// 2) Exports (and "Download to phone") produced a blank or truncated file:
//      * Capacitor's WriteFileOptions has NO `append` field, so
//        FS.writeFile({..., append: !first}) silently truncated on every chunk;
//        the saved file kept only the last chunk.
//      * streamZipToCapacitor swallowed every failed chunk write and then
//        resolved TRUE, so a 0-byte cache file went to the share sheet with an
//        "exported" toast instead of falling back to the in-memory save path.
//
// The suite fakes Capacitor with a Filesystem that behaves like the real plugin
// (writeFile truncates, appendFile appends and needs the file to exist), then
// drives the page's own helpers.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const updatesSrc = fs.readFileSync(process.env.SC_UPDATES || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

// Deterministic stand-in for the JSZip the page loads from its CDN: it only has
// to satisfy runZipExport — .file() plus an internal stream that emits real byte
// chunks. Served through the resource interceptor so the real CDN script (which
// this sandbox can reach) can never make the numbers non-deterministic.
const JSZIP_STUB_SRC = `
;(function(){
  function S(){ this._h = {}; }
  S.prototype.on = function(e, f){ (this._h[e] = this._h[e] || []).push(f); return this; };
  S.prototype.resume = function(){
    var self = this;
    setTimeout(function(){
      var chunks = [new Uint8Array(65536), new Uint8Array(65536), new Uint8Array(1234)];
      chunks[0].fill(65); chunks[1].fill(66); chunks[2].fill(67);
      for(var i = 0; i < chunks.length; i++){
        (self._h.data || []).forEach(function(f){ f(chunks[i]); });
      }
      (self._h.end || []).forEach(function(f){ f(); });
    }, 0);
    return this;
  };
  function Z(){}
  // 73.4.9 - record what goes into the archive (the gate reads manifest.json back
  // out of here). The existing byte-count checks are unaffected.
  Z.prototype.file = function(p, d){
    try{
      window.__ZIP_FILES = window.__ZIP_FILES || [];
      window.__ZIP_FILES.push(p);
      window.__ZIP_DATA = window.__ZIP_DATA || {};
      window.__ZIP_DATA[p] = d;
    }catch(e){}
    return this;
  };
  Z.prototype.generateInternalStream = function(){ return new S(); };
  window.JSZip = Z;
})();
`;

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(updatesSrc, { headers: { 'Content-Type': 'application/javascript' } });
  }
  if (/jszip/i.test(request.url)) {
    return new Response(JSZIP_STUB_SRC, { headers: { 'Content-Type': 'application/javascript' } });
  }
  return undefined;
});

function makeIDB() {
  const data = {
    tracks: new Map([
      ['t1', { id: 't1', name: 'Alpha', artist: 'Someone' }],
      ['t2', { id: 't2', name: 'Beta', artist: 'Someone' }],
      ['t3', { id: 't3', name: 'Gamma', artist: 'Someone' }],
    ]),
    meta: new Map([
      ['idCounter', { key: 'idCounter', value: 9 }],
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3'], 'Late night': ['t2'] } }],
      ['userAlbums', { key: 'userAlbums', value: {} }],
      ['theme', { key: 'theme', value: 'coral' }],
    ]),
  };
  return {
    open() {
      const req = { error: null };
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({}),
        close() {},
        transaction(store) {
          const t = { oncomplete: null, onerror: null, onabort: null, error: null };
          const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
          t.objectStore = () => ({
            put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
            get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
            getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()).filter((v) => v && (v.key !== undefined || v.id !== undefined)); q.onsuccess && q.onsuccess(); }, 0); return q; },
            delete(k) { data[store].delete(k); fire(); return {}; },
          });
          return t;
        },
      };
      setTimeout(() => {
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        req.result = db;
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
  };
}

// A Filesystem that behaves like @capacitor/filesystem:
//   - writeFile ALWAYS truncates (WriteFileOptions has no `append`)
//   - appendFile APPENDS and fails if the file does not exist
// opts.noopWrite  -> writeFile silently writes nothing (a real "blank file" case)
// opts.failAppend -> appendFile rejects (locked file / plugin quirk)
function makeFS(opts) {
  opts = opts || {};
  // Files are held as real bytes: the plugin decodes each base64 chunk before
  // appending, so concatenating the encoded strings would be wrong (padding in
  // the middle of base64 truncates it).
  const files = new Map();
  const shares = [];
  const calls = [];
  const dec = (s) => Buffer.from(s || '', 'base64');
  return {
    shares,
    calls,
    _files: files,
    fileBytes: (p) => { const f = files.get(p); return f ? f.length : null; },
    writeFile(o) {
      calls.push('writeFile ' + o.path + ' b64=' + ((o.data || '').length) + ' bytes=' + dec(o.data).length);
      return Promise.resolve().then(() => {
        if (opts.noopWrite) return { uri: 'file://' + o.path };
        files.set(o.path, dec(o.data));
        return { uri: 'file://' + o.path };
      });
    },
    appendFile(o) {
      calls.push('appendFile ' + o.path + ' b64=' + ((o.data || '').length) + ' bytes=' + dec(o.data).length);
      return Promise.resolve().then(() => {
        if (opts.failAppend) throw new Error('appendFile failed');
        const f = files.get(o.path);
        if (!f) throw new Error('file does not exist');
        files.set(o.path, Buffer.concat([f, dec(o.data)]));
      });
    },
    stat(o) {
      return Promise.resolve().then(() => {
        const f = files.get(o.path);
        if (!f) throw new Error('not found');
        return { size: f.length, uri: 'file://' + o.path };
      });
    },
    getUri(o) { return Promise.resolve({ uri: 'file://' + o.path }); },
    readFile(o) {
      const f = files.get(o.path);
      if (!f) return Promise.reject(new Error('not found'));
      return Promise.resolve({ data: f.toString('base64') });
    },
    deleteFile(o) { files.delete(o.path); return Promise.resolve(); },
  };
}

// Minimal JSZip stand-in: it only has to satisfy runZipExport's use of it —
// .file() and an internal stream that emits a few real byte chunks.
const ZIP_BYTES = 65536 + 65536 + 1234;

async function boot({ native, fsOpts }) {
  const FS = makeFS(fsOpts);
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not load/i.test(m)) errors.push(m); });
  vc.on('warn', () => {});
  if (process.env.SC_DEBUG) vc.on('log', (...a) => console.log('    page: ' + a.join(' ')));
  vc.on('error', (...a) => errors.push(a.join(' ').split('\n')[0]));

  const plugins = {
    Filesystem: FS,
    Share: { share: (o) => { FS.shares.push(o); return Promise.resolve({}); } },
    MediaSession: { setMetadata: () => Promise.resolve({}), setPlaybackState: () => Promise.resolve({}), setPositionState: () => Promise.resolve({}), setActionHandler: () => Promise.resolve({}) },
  };

  const win0 = {};
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = makeIDB();
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      win.fetch = () => Promise.reject(new Error('offline'));
      Object.defineProperty(win.screen, 'refreshRate', { value: 120, configurable: true });
      Object.defineProperty(win.screen, 'requestFrameRate', { value: () => Promise.resolve(), configurable: true });
      win.Capacitor = {
        isNativePlatform: () => !!native,
        getPlatform: () => (native ? 'android' : 'web'),
        nativePromise: () => Promise.resolve({}),
        nativeCallback: () => Promise.resolve({}),
        Plugins: plugins,
      };
    },
  });
  await wait(3000);
  return { win: dom.window, FS, errors, dom };
}

(async () => {
  console.log('\n\u2014 multi-select \u2192 Add to playlist \u2014');
  {
    const { win } = await boot({ native: false, fsOpts: {} });
    const doc = win.document;
    ok('the selection bar exists to enter', typeof win.__scEnterSelectMode === 'function');
    if (typeof win.__scEnterSelectMode === 'function') {
      win.__scEnterSelectMode(['t1', 't3']);
      await wait(120);
      const btn = doc.getElementById('selectPlaylistAddBtn');
      ok('an Add-to-playlist action is in the multi-select bar', !!btn);

      if (btn) {
        btn.click();
        await wait(120);
        const backdrop = doc.getElementById('addToPlaylistBackdrop');
        ok('the playlist picker opens from the selection bar',
           !!backdrop && backdrop.style.display === 'flex');
        const picks = Array.from(doc.querySelectorAll('#addToPlaylistButtons .playlist-pick-btn'));
        ok('it offers the user\u2019s playlists (not All Songs)',
           picks.some((p) => /Late night/.test(p.textContent)) &&
           !picks.some((p) => /All Songs/.test(p.textContent)),
           picks.map((p) => p.textContent).join(' | '));
        ok('the title says how many songs are being added',
           /2 songs/.test((backdrop.querySelector('h3') || {}).textContent || ''),
           (backdrop.querySelector('h3') || {}).textContent);

        const late = picks.find((p) => /Late night/.test(p.textContent));
        if (late) {
          late.click();
          await wait(120);
          // ask where to put them -> "at the end"
          const end = doc.getElementById('insertPosEnd');
          ok('it still asks where in the playlist they should go', !!end);
          if (end) end.click();
          await wait(200);
          const pls = win.__scGetPlaylists ? win.__scGetPlaylists() : {};
          const late2 = pls['Late night'] || [];
          ok('both selected songs land in the playlist',
             late2.includes('t1') && late2.includes('t3'), JSON.stringify(late2));
          ok('a song already in the playlist is not duplicated',
             late2.filter((id) => id === 't2').length === 1, JSON.stringify(late2));
          ok('selection mode ends after adding', !doc.getElementById('selectPlaylistAddBtn'));
        }
      }
    }
  }

  // Healthy native: both the multi-chunk write and a full export.
  console.log('\n\u2014 a multi-chunk write must not truncate to the last chunk \u2014');
  {
    const { win, FS } = await boot({ native: true, fsOpts: {} });
    const probe = win.__scExportProbe;
    ok('the export helpers are reachable', !!probe && typeof probe.writeBlobToCache === 'function');
    if (probe) {
      const bytes = new Uint8Array(700 * 1024);
      for (let i = 0; i < bytes.length; i++) bytes[i] = i & 255;
      const blob = new win.Blob([bytes]);
      let threw = null;
      try { await probe.writeBlobToCache(blob, 'probe.bin'); } catch (e) { threw = e; }
      const got = FS.fileBytes('probe.bin');
      ok('the whole file is written, not just the final chunk',
         got === bytes.length, 'wrote ' + got + ' of ' + bytes.length + (threw ? ' (threw: ' + threw.message + ')' : ''));

      console.log('\n\u2014 a real export writes a real file \u2014');
      console.log('    JSZip stub: ' + typeof win.JSZip + '  injectedCdnScripts: ' + win.document.querySelectorAll('script[src*="jszip"]').length);
      let exportDone = false, exportErr = null;
      await Promise.race([
        probe.doExportTracks(['t1', 't2', 't3'], 'sidecut-selection-3', { 'Late night': ['t1', 't2', 't3'] }, 'selection', null)
          .then(() => { exportDone = true; }, (e) => { exportErr = e; }),
        wait(20000).then(() => { throw new Error('doExportTracks did not finish in 20s'); }),
      ]).catch((e) => { exportErr = exportErr || e; });
      if (exportErr) console.log('    export error: ' + (exportErr && exportErr.message) + '  (calls: ' + JSON.stringify(FS.calls) + ')');
      await wait(400);
      const names = Array.from(FS._files.keys());
      const zipName = names.find((n) => /\.zip$/.test(n));
      ok('a .zip lands in the app cache', !!zipName, names.join(','));
      ok('and it holds every byte of the archive',
         !!zipName && FS.fileBytes(zipName) === ZIP_BYTES,
         zipName ? FS.fileBytes(zipName) + ' vs ' + ZIP_BYTES : 'no file');
      ok('the share sheet is offered the finished file', FS.shares.length === 1, 'shares=' + FS.shares.length);
    } else {
      ok('the whole file is written, not just the final chunk', false, 'no probe');
      ok('a .zip lands in the app cache', false, 'no probe');
      ok('and it holds every byte of the archive', false, 'no probe');
      ok('the share sheet is offered the finished file', false, 'no probe');
    }
  }

  // Writes that cannot succeed: nothing may be announced as a finished export.
  console.log('\n\u2014 a failed write must never be shared as a blank "export" \u2014');
  {
    const { win, FS } = await boot({ native: true, fsOpts: { noopWrite: true, failAppend: true } });
    const probe = win.__scExportProbe;
    if (probe) {
      let rejected = null;
      const chunks = [new Uint8Array(65536).fill(1), new Uint8Array(65536).fill(2), new Uint8Array(2048).fill(3)];
      const handlers = {};
      const stream = {
        on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return this; },
        resume() {
          setTimeout(() => {
            chunks.forEach((c) => (handlers.data || []).forEach((f) => { try { f(c); } catch (e) {} }));
            (handlers.end || []).forEach((f) => { try { f(); } catch (e) {} });
          }, 0);
          return this;
        },
      };
      await probe.streamZipToCapacitor(stream, 'broken.zip').then(() => {}, (e) => { rejected = e; });
      ok('a broken native write rejects instead of resolving true',
         !!rejected, rejected ? ('rejected: ' + rejected.message) : 'resolved true');

      await probe.doExportTracks(['t1'], 'sidecut-selection-1', undefined, 'selection', null);
      await wait(600);
      const zeroByte = Array.from(FS._files.keys()).filter((p) => FS.fileBytes(p) === 0);
      ok('no 0-byte file is shared with the user', FS.shares.length === 0 && zeroByte.length === 0,
         'shares=' + FS.shares.length + ' zeroByte=' + zeroByte.join(','));
    } else {
      ok('a broken native write rejects instead of resolving true', false, 'no probe');
      ok('no 0-byte file is shared with the user', false, 'no probe');
    }
  }

  // ------------------------------------------------------------------
  // 73.4.9 - EXPORT ONE THING, NOT THE WHOLE TAB.
  // "Export playlist" only ever exported the playlist that happened to be open and
  // "Export albums" zipped every album at once. A single playlist and a single
  // album can now be exported on their own, with the audio, the tags and the
  // covers plus the grouping itself, so the zip imports back as exactly that
  // playlist or that album.
  console.log('\n\u2014 one playlist exports on its own, with its own grouping \u2014');
  {
    const { win, FS } = await boot({ native: true, fsOpts: {} });
    const doc = win.document;
    const probe = win.__scExportProbe;
    ok('the per-playlist export is reachable', !!probe && typeof probe.exportOnePlaylist === 'function');
    if (probe && typeof probe.exportOnePlaylist === 'function') {
      win.__ZIP_FILES = [];
      win.__ZIP_DATA = {};
      win.localStorage.removeItem('sidecut_playback_stops');
      await probe.exportOnePlaylist('Late night');
      await wait(120);
      const backdrop = doc.getElementById('exportConfirmBackdrop');
      ok('it asks before writing anything', !!backdrop && backdrop.style.display === 'flex');
      ok('the question names the playlist and how many songs',
         /Late night/.test(doc.getElementById('exportConfirmBody').innerHTML) &&
         /1 song/.test(doc.getElementById('exportConfirmBody').innerHTML),
         doc.getElementById('exportConfirmBody').innerHTML.slice(0, 160));
      doc.getElementById('exportConfirmOk').click();
      await wait(1200);
      const names = Array.from(FS._files.keys());
      ok('a zip named for that playlist lands in the cache',
         names.some((n) => /Late_night\.zip$/.test(n)), names.join(','));
      let man = null;
      try { man = JSON.parse(win.__ZIP_DATA['manifest.json']); } catch (e) {}
      ok('and it holds the playlist\u2019s own songs, not the whole library',
         !!man && Array.isArray(man.tracks) &&
         JSON.stringify(man.tracks.map((t) => t.id)) === JSON.stringify(['t2']),
         man && man.tracks ? JSON.stringify(man.tracks.map((t) => t.id)) : 'no manifest');
      ok('the manifest carries that playlist grouping for the import',
         !!man && !!man.playlists && JSON.stringify(man.playlists['Late night']) === JSON.stringify(['t2']),
         man ? JSON.stringify(man.playlists) : 'no manifest');

      // Cancelling must write nothing at all.
      win.__ZIP_FILES = [];
      const before = FS.shares.length;
      await probe.exportOnePlaylist('Late night');
      await wait(80);
      doc.getElementById('exportConfirmCancel').click();
      await wait(400);
      ok('cancelling exports nothing', FS.shares.length === before && !win.__ZIP_FILES.length,
         'shares=' + FS.shares.length + ' files=' + JSON.stringify(win.__ZIP_FILES));
    } else {
      ['it asks before writing anything', 'the question names the playlist and how many songs',
       'a zip named for that playlist lands in the cache', 'and it holds the playlist\u2019s own songs, not the whole library',
       'the manifest carries that playlist grouping for the import', 'cancelling exports nothing']
        .forEach((n) => ok(n, false, 'no probe'));
    }
  }

  console.log('\n\u2014 one album exports on its own, as an ALBUM \u2014');
  {
    const { win, FS } = await boot({ native: true, fsOpts: {} });
    const doc = win.document;
    const probe = win.__scExportProbe;
    ok('the per-album export is reachable', !!probe && typeof probe.exportOneAlbum === 'function');
    if (probe && typeof probe.exportOneAlbum === 'function') {
      const ua = win.__scUserAlbums();
      ua['My Album'] = { artist: 'Someone', trackIds: ['t1', 't3'], createdAt: Date.now(), manual: true };
      win.__ZIP_FILES = [];
      win.__ZIP_DATA = {};
      await probe.exportOneAlbum('My Album');
      await wait(120);
      ok('it asks before writing anything',
         doc.getElementById('exportConfirmBackdrop').style.display === 'flex');
      doc.getElementById('exportConfirmOk').click();
      await wait(1200);
      const names = Array.from(FS._files.keys());
      ok('a zip named for that album lands in the cache',
         names.some((n) => /sidecut-album-My_Album\.zip$/.test(n)), names.join(','));
      let man = null;
      try { man = JSON.parse(win.__ZIP_DATA['manifest.json']); } catch (e) {}
      ok('it holds only that album\u2019s songs',
         !!man && Array.isArray(man.tracks) &&
         JSON.stringify(man.tracks.map((t) => t.id)) === JSON.stringify(['t1', 't3']),
         man && man.tracks ? JSON.stringify(man.tracks.map((t) => t.id)) : 'no manifest');
      ok('it is an ALBUM zip, not a playlist one', !!man && man.kind === 'albums', man ? String(man.kind) : 'no manifest');
      ok('the manifest carries that one album for the import',
         !!man && !!man.settings && JSON.stringify(man.settings.userAlbums['My Album'].trackIds) === JSON.stringify(['t1', 't3']),
         man ? JSON.stringify(man.settings && man.settings.userAlbums) : 'no manifest');
      ok('and it carries no playlist at all',
         !!man && man.playlists && Object.keys(man.playlists).length === 0,
         man ? JSON.stringify(man.playlists) : 'no manifest');
    } else {
      ['it asks before writing anything', 'a zip named for that album lands in the cache',
       'it holds only that album\u2019s songs', 'it is an ALBUM zip, not a playlist one',
       'the manifest carries that one album for the import', 'and it carries no playlist at all']
        .forEach((n) => ok(n, false, 'no probe'));
    }
  }

  console.log('\n\u2014 the per-item exports are really in the UI \u2014');
  {
    const src = html;
    // 73.6.1 - the per-album export button moved OFF the Albums tab's cards and
    // INTO Manage albums, so this pins the new home (and that the card button is
    // really gone).
    ok('each album row in Manage albums carries its own export button',
       /class="mgr-alb-export"/.test(src) && /exportOneAlbum\(name\)/.test(src));
    ok('and the album cards no longer carry a button of their own',
       !/_albExpBtn/.test(src) && !/exportOneAlbum\(aName\)/.test(src));
    ok('each playlist row in Manage playlists carries its own export button',
       /expBtn/.test(src) && /exportOnePlaylist\(name\)/.test(src));
    ok('the album card button sets its own title so it is findable',
       /Export this album \u2014 audio, tags and covers/.test(src));
    ok('and the playlist row button likewise',
       /Export this playlist \u2014 audio, tags and covers/.test(src));
    ok('the path that opens the picker only ever exports the OPEN playlist through the shared helper',
       /async function exportPlaylist\(\)\{\s*await exportOnePlaylist\(activePlaylist\);/.test(src));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
