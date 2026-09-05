#!/usr/bin/env python3
"""Follow-up fixes for the album/playlist batch converter in index.html.

1. Batch saves now go through Capacitor Filesystem + the Android share sheet on
   native (an <a download> click writes a 0-byte file in the WebView — the
   "doesn't download" bug). Browsers keep the anchor path.
2. A failed row shows WHY it failed (no source found / encode failed / …).
3. "Retry failed" no longer renumbers files starting at 01 again.

Every edit is anchored to a unique string and asserted before writing.
"""
import shutil
import time

PATH = 'index.html'
BACKUP = 'dev/index.html.pre-spfixed.' + time.strftime('%Y%m%d-%H%M%S')

with open(PATH, 'r', encoding='utf-8') as f:
    src = f.read()

orig_len = len(src)
edits = []


def replace_once(name, old, new):
    global src
    n = src.count(old)
    if n != 1:
        raise SystemExit('ANCHOR FAIL [%s]: %d occurrences (expected 1)' % (name, n))
    src = src.replace(old, new, 1)
    edits.append(name)


# ---------------------------------------------------------------------------
# F1 — native save helper inserted above scDownloadBlob.
# ---------------------------------------------------------------------------
OLD_F1 = """  function scDownloadBlob(blob, fName){"""
NEW_F1 = """  // Save a converted file to the Android share sheet via Capacitor Filesystem.
  // The bundled app's WebView cannot download blob: URLs — an <a download> click
  // writes a 0-byte file (this is why album conversions used to "download
  // nothing"). Same Filesystem+Share pattern as saveExportFile(); the anchor
  // fallback in scDownloadBlob stays for plain browsers.
  async function scNativeSaveBlob(blob, fName){
    try{
      const cap = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
      const FS = cap ? cap.Filesystem : null;
      const Share = cap ? cap.Share : null;
      if(!(FS && Share && typeof FS.writeFile === 'function' && typeof Share.share === 'function')) return false;
      const data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] || '');
        r.onerror = () => rej(r.error || new Error('could not read converted audio'));
        r.readAsDataURL(blob);
      });
      const w = await FS.writeFile({ path: fName, data, directory: 'CACHE', recursive: true });
      const uri = w && w.uri;
      if(!uri) return false;
      await Share.share({ title: fName, files: [uri], dialogTitle: 'Save your SideCut conversion' });
      return true;
    }catch(e){ console.warn('Native save unavailable, falling back to download anchor', e); return false; }
  }
  function scDownloadBlob(blob, fName){"""
replace_once('F1-native-save-helper', OLD_F1, NEW_F1)

# ---------------------------------------------------------------------------
# F2 — the batch loop uses the native save and shows per-row save state.
# ---------------------------------------------------------------------------
OLD_F2 = """      tracksDone[i] = !!(out && out.ok);
      if(out && out.ok){
        scDownloadBlob(out.blob, out.fName);
        okCount++;
        if(stateEl){ stateEl.textContent = '✓ saved'; stateEl.style.color = 'var(--coral)'; }
      } else {
        failCount++;
        failedNames.push((meta.title || 'Untitled') + ((out && out.reason) ? ' (' + out.reason + ')' : ''));
        if(stateEl){ stateEl.textContent = '✗'; stateEl.style.color = '#f87171'; }
      }"""
NEW_F2 = """      tracksDone[i] = !!(out && out.ok);
      if(out && out.ok){
        var savedOk = false;
        try{ savedOk = await scNativeSaveBlob(out.blob, out.fName); }catch(_se){}
        if(!savedOk) scDownloadBlob(out.blob, out.fName);
        okCount++;
        if(stateEl){ stateEl.textContent = '✓ saved'; stateEl.style.color = 'var(--coral)'; }
      } else {
        failCount++;
        failedNames.push((meta.title || 'Untitled') + ((out && out.reason) ? ' (' + out.reason + ')' : ''));
        if(stateEl){ stateEl.textContent = '✗ ' + ((out && out.reason) ? out.reason : 'failed'); stateEl.style.color = '#f87171'; }
      }"""
replace_once('F2-batch-native-save', OLD_F2, NEW_F2)

# ---------------------------------------------------------------------------
# F3 — retry keeps album order: renumber positions from 1 instead of the
# original track numbers, so retried songs don't save as 03/07/12 when they
# land first.
# ---------------------------------------------------------------------------
OLD_F3 = """      var retryBtn = actEl.querySelector('.sp-batch-retry');
      if(retryBtn) retryBtn.addEventListener('click', function(){
        var retryPlan = Object.assign({}, plan, { tracks: tracks.filter(function(t, k){ return !tracksDone[k]; }) });
        scRunBatchConvert(retryPlan, fmt, resultEl, btnEl, originalUrl);
      });"""
NEW_F3 = """      var retryBtn = actEl.querySelector('.sp-batch-retry');
      if(retryBtn) retryBtn.addEventListener('click', function(){
        var retryTracks = tracks.filter(function(t, k){ return !tracksDone[k]; })
          .map(function(t, j){ var r = Object.assign({}, t); r.position = j + 1; return r; });
        var retryPlan = Object.assign({}, plan, { tracks: retryTracks });
        scRunBatchConvert(retryPlan, fmt, resultEl, btnEl, originalUrl);
      });"""
replace_once('F3-retry-renumber', OLD_F3, NEW_F3)

shutil.copyfile(PATH, BACKUP)
with open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)

print('Applied edits:', ', '.join(edits))
print('Size: %d -> %d bytes (+%d)' % (orig_len, len(src), len(src) - orig_len))
print('Backup:', BACKUP)
