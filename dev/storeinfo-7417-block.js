  console.log('[6c] a cleaner row never lets a song name out of it');
  {
    // 74.1.7. The owner's screenshot: the cleaner's rows had the song name and the
    // artist painted straight across the Re-encode button and off the right of the
    // screen. 74.1.6 had turned the left of the row into a <button>, and a button may
    // only hold phrasing content, so both lines became <span>s - and a span lays out
    // INLINE, where `overflow: hidden` and `text-overflow: ellipsis` do nothing at
    // all. jsdom has no layout engine, so the fault itself cannot be photographed
    // here; what CAN be read is every box's computed display, and an inline box is
    // exactly the fault. This block fails on the 74.1.6 page for that reason.
    const rows = Array.from(doc.querySelectorAll('#studioView .sc-store-row'));
    ok(rows.length > 0, 'the cleaner has rows to check (' + rows.length + ')');
    const inline = [];
    rows.forEach((r) => {
      ['.sc-store-txt', '.sc-store-name', '.sc-store-sub'].forEach((sel) => {
        const el = r.querySelector(sel);
        if (!el) { inline.push('no ' + sel); return; }
        const d = win.getComputedStyle(el).display;
        if (d === 'inline' || d === '') inline.push(sel + ':' + (d || 'nothing'));
      });
    });
    ok(inline.length === 0,
      'no part of a row text block lays out inline, so the ellipsis really clips (' + (inline.slice(0, 3).join(', ') || 'none') + ')');
    const nameRule = (html.match(/\.sc-store-name\{[^}]*\}/) || [''])[0];
    ok(/display:\s*block/.test(nameRule) && /text-overflow:\s*ellipsis/.test(nameRule),
      'the row name is a block and still clips (' + nameRule.slice(0, 60) + ')');
    const subRule = (html.match(/\.sc-store-sub\{[^}]*\}/) || [''])[0];
    ok(/display:\s*block/.test(subRule) && /text-overflow:\s*ellipsis/.test(subRule),
      'and so is the line under it (' + subRule.slice(0, 60) + ')');
    const hitRule = (html.match(/\.sc-store-hit\{[^}]*\}/) || [''])[0];
    ok(/overflow:\s*hidden/.test(hitRule), 'and the row itself clips as a last resort');
    // The row is still one tap target and the button beside it still its own - the
    // rules above must not have cost the row its shape.
    ok(doc.querySelectorAll('#studioView .sc-store-hit').length === rows.length,
      'each row is still a door with one hit target');
  }

  console.log('[6d] the Re-encode button asks which rate, up to a higher quality');
  {
    // 74.1.7. "have an option to re encode to a higher quality various options should
    // appear". The button used to encode at once at the rate set at the bottom of the
    // cleaner; it opens the rates now - 96 to 320 kbps - and every rate says what it
    // would do to that song in MB. A rate above what the file reads is offered and
    // named for what it is: a bigger file.
    const rateSrc = (html.match(/var REENCODE_RATES = \[([^\]]*)\]/) || [])[1];
    ok(rateSrc === '96, 128, 160, 192, 256, 320',
      'the app offers six rates, 96 up to 320 kbps (' + rateSrc + ')');
    ok(win.SC70.rates().join(',') === '96,128,160,192,256,320', 'and the studio hands out that same list');

    const all = win.__scGetAllTracks().filter((t) => t.file && t.file.size && t.duration);
    const victim = all.slice().sort((a, b) => b.file.size - a.file.size)[0];
    const oldFile = victim.file, oldDuration = victim.duration;
    // A 4 MB file that says it is 2:37: 214 kbps, so 128 wins space back and 320
    // grows the file. Both numbers below are the test's own arithmetic.
    victim.file = new win.Blob([new win.Uint8Array(4194304)], { type: 'audio/mpeg' });
    victim.duration = 157;
    win.SC70.renderStudio();

    const rowBtn = doc.querySelector('#studioView [data-reenc="' + victim.id + '"]');
    ok(!!rowBtn && rowBtn.textContent === 'Re-encode', 'the row carries its Re-encode button');
    rowBtn.click();
    await wait(60);
    const pick = doc.querySelector('#studioView .sc-reen[data-reen="' + victim.id + '"]');
    ok(!!pick, 'tapping it opens the rates for that song');
    const pickRow = doc.querySelector('#studioView .sc-store-row.open');
    ok(!!pickRow && pickRow.nextElementSibling === pick &&
       !!pickRow.querySelector('.sc-store-hit[data-id="' + victim.id + '"]'),
      'and the rate sheet hangs under its own row, like the bubble');
    ok(!!pickRow && pickRow.getAttribute('aria-expanded') === null &&
       pickRow.querySelector('.sc-store-hit').getAttribute('aria-expanded') === 'false',
      'the row is highlighted for the sheet, and its own button still reports the bubble');
    ok(doc.querySelectorAll('#studioView .sc-info').length === 1,
      'one panel at a time - the bubble is not open behind it');
    const buttons = Array.from(pick.querySelectorAll('[data-reencgo]'));
    ok(buttons.length === 6, 'six rates to choose from (' + buttons.length + ')');
    const at = (k) => buttons.filter((b) => b.getAttribute('data-rate') === String(k))[0];
    ok(buttons.every((b) => b.getAttribute('data-reencgo') === victim.id),
      'every one of them is for the song whose button was tapped');
    // 128 kbps: the file is 4194304 bytes and 157s at 128 kbps is 2512000 bytes.
    const win128 = 4194304 - Math.round(157 * 128 * 125);
    ok(at(128).querySelector('.sc-reen-what').textContent === 'wins back ' + (win128 / 1048576).toFixed(1) + ' MB',
      'the rate that shrinks says what it wins, in MB (' + at(128).querySelector('.sc-reen-what').textContent + ')');
    const grow320 = Math.round(157 * 320 * 125) - 4194304;
    ok(at(320).querySelector('.sc-reen-what').textContent === 'grows the file by ' + (grow320 / 1048576).toFixed(1) + ' MB',
      'and the rate above what the file reads is named for what it is (' + at(320).querySelector('.sc-reen-what').textContent + ')');
    ok(/grows/.test(at(320).className), 'and marked as a rate that grows the file');
    ok(/above what the file reads/.test(at(320).textContent),
      'with the reason on the row, not buried in a note');
    ok(/cannot put back detail/.test(pick.textContent),
      'and the sheet says plainly why a higher rate is not an upgrade');
    ok(/the rate set below/.test(at(win.SC70.target()).textContent),
      'the rate chosen at the bottom of the cleaner is marked as the one set there');

    // Tapping the button again closes it, and the bubble takes over if it is opened.
    rowBtn.click();
    await wait(40);
    ok(doc.querySelectorAll('#studioView .sc-reen').length === 0, 'tapping the button again closes the sheet');
    doc.querySelector('#studioView [data-reenc="' + victim.id + '"]').click();
    await wait(40);
    doc.querySelector('#studioView .sc-store-hit[data-id="' + victim.id + '"]').click();
    await wait(40);
    ok(doc.querySelectorAll('#studioView .sc-reen').length === 0 && doc.querySelectorAll('#studioView .sc-info').length === 1,
      'and opening the bubble closes the sheet');

    // 320 really runs: the encoder is asked for 320, not for the cleaner's rate.
    const realEncode = win.__scEncodeMp3;
    let askedRate = 0;
    win.__scEncodeMp3 = (buf, kbps) => {
      askedRate = kbps;
      return Promise.resolve(new win.Blob([new win.Uint8Array(2000)], { type: 'audio/mpeg' }));
    };
    win.SC70.openRates(victim.id);
    await wait(40);
    doc.querySelector('#studioView [data-reencgo="' + victim.id + '"][data-rate="320"]').click();
    await wait(1600);
    ok(askedRate === 320, 'a rate above the file is really encoded at, not quietly lowered (' + askedRate + ')');
    ok(victim.reencoded === true, 'and the song is re-encoded');
    win.SC70.undoReencode(victim.id);
    win.__scEncodeMp3 = realEncode;
    victim.file = oldFile;
    victim.duration = oldDuration;
    win.SC70.renderStudio();
  }

  console.log('[6e] the playlists can be reordered from Manage playlists');
  {
    // 74.1.7. "you should be able to reorder playlists in manage playlists". The
    // panel lists the playlists in the library's order - the order of the Library
    // tabs, which the tab strip already drags - so reorder mode moves that one order.
    const c = boot('apk', {
      playlists: { 'All Songs': TRACKS.map((t) => t.id), Favorites: ['t3', 't4'], 'Road Trip': ['t1', 't2', 't3'], Spare: ['t5'], 'Late Night': ['t4'] },
    });
    await wait(1600);
    const cwin = c.win;
    const cdoc = cwin.document;
    const panel = () => cdoc.getElementById('managePlaylistsList');
    const names = () => Array.from(panel().querySelectorAll('div[data-playlist]')).map((r) => r.dataset.playlist);
    const tabs = () => Array.from(cdoc.querySelectorAll('#tabs .tab[data-playlist-name]')).map((t) => t.dataset.playlistName);

    cdoc.querySelector('#libraryBtn').click();
    await wait(200);
    cdoc.getElementById('listMoreBtn').click();
    await wait(80);
    const menu = cdoc.getElementById('songActionsList');
    const manage = Array.from(menu.querySelectorAll('button')).find((b) => /Manage playlists/.test(b.textContent || ''));
    ok(!!manage, 'the list menu still offers Manage playlists');
    if (manage) manage.click();
    await wait(80);
    ok(cdoc.getElementById('managePlaylistsBackdrop').style.display === 'flex', 'which opens the panel');
    ok(!!cdoc.getElementById('manageReorderBtn') && cdoc.getElementById('manageReorderBtn').textContent === 'Reorder',
      'the panel offers a Reorder mode');
    ok(panel().querySelectorAll('[data-move]').length === 0, 'and nothing moves until it is turned on');

    cdoc.getElementById('manageReorderBtn').click();
    await wait(80);
    ok(cdoc.getElementById('manageReorderBtn').textContent === 'Done', 'tapping it turns reorder mode on');
    const movable = Object.keys(cwin.__scGetPlaylists()).filter((n) => n !== 'All Songs' && n !== 'Favorites');
    ok(panel().querySelectorAll('[data-move]').length === movable.length * 2,
      'two arrows on each playlist that can move (' + panel().querySelectorAll('[data-move]').length + ' for ' + movable.length + ')');
    ok(names().indexOf('Road Trip') !== -1 && names().indexOf('Spare') !== -1,
      'the panel lists the playlists (' + names().join(', ') + ')');
    const allSongsRow = panel().querySelector('div[data-playlist="All Songs"]');
    ok(!allSongsRow.querySelector('[data-move]') && /always first/.test(allSongsRow.textContent),
      'Library is not offered a move, and says why');
    const favRow = panel().querySelector('div[data-playlist="Favorites"]');
    ok(!favRow.querySelector('[data-move]') && /always first/.test(favRow.textContent), 'neither is Favorites');
    // Library and Favorites are pinned to the front by every path in the app, so the
    // first playlist after them cannot be moved above them either - the arrow is
    // there and it is honestly disabled, rather than silently doing nothing.
    ok(panel().querySelector('[data-move="up"][data-playlist="Road Trip"]').disabled,
      'the first playlist after the two pinned ones has nowhere to go up to');
    ok(!panel().querySelector('[data-move="down"][data-playlist="Road Trip"]').disabled,
      'but it can move down');
    ok(panel().querySelectorAll('[data-move="up"]').length === movable.length &&
       Array.from(panel().querySelectorAll('[data-move="up"]')).filter((b) => b.disabled).length === 1,
      'and only the first of the movable ones has nowhere to go up to');

    const before = names();
    ok(before.indexOf('Road Trip') < before.indexOf('Spare'), 'Road Trip sits before Spare to begin with');
    ok(tabs().indexOf('Road Trip') < tabs().indexOf('Spare'), 'and so does its Library tab');
    panel().querySelector('[data-move="down"][data-playlist="Road Trip"]').click();
    await wait(120);
    const after = names();
    ok(after.indexOf('Spare') < after.indexOf('Road Trip'),
      'the down arrow moves it a place (' + after.join(', ') + ')');
    ok(tabs().indexOf('Spare') < tabs().indexOf('Road Trip'),
      'and the Library tabs follow the order you set (' + tabs().join(', ') + ')');
    const keys = Object.keys(cwin.__scGetPlaylists());
    ok(keys.indexOf('Spare') < keys.indexOf('Road Trip'),
      'because it is the app\u2019s own order, not a list the panel keeps');
    ok(cdoc.querySelector('#tabs .tab.active'), 'and the tab that was open is still the open one');
    panel().querySelector('[data-move="up"][data-playlist="Road Trip"]').click();
    await wait(120);
    ok(names().join(',') === before.join(','), 'up puts it back exactly where it was');

    // The end of the list: the last playlist that can move has nowhere left to go.
    {
      const last = movable[movable.length - 1];
      const down = panel().querySelector('[data-move="down"][data-playlist="' + last + '"]');
      ok(!!down, 'the last movable playlist has its own arrow (' + last + ')');
      if (down) {
        ok(down.disabled, 'and it is disabled - there is nothing under it to move past');
        const beforeLast = names().join(',');
        down.click();
        await wait(80);
        ok(names().join(',') === beforeLast, 'and clicking it changes nothing');
      }
    }
    cdoc.getElementById('manageReorderBtn').click();
    await wait(80);
    ok(cdoc.getElementById('manageReorderBtn').textContent === 'Reorder' &&
       panel().querySelectorAll('[data-move]').length === 0,
      'Done leaves reorder mode');
    ok(panel().querySelectorAll('button[title="Delete playlist"]').length >= 1,
      'and the ordinary rows are back, bins and all');
  }

  console.log('[6f] a compress that carries on when you leave the app');
  {
    // 74.1.7. "it should be able to re encode in the background". What a machine with
    // no phone can prove: the job takes a Web Lock for its whole life (the exemption
    // from the browser's background freeze) and holds it while it works, the slice
    // budget triples while the page is hidden, the run is written down before its
    // first byte and cleared when it ends, and a run the phone killed says so.
    ok(typeof win.SC70.backSliceMul === 'function', 'the page publishes the hidden-slice rule');
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => false });
    ok(win.SC70.backSliceMul() === 1, 'visible, a slice is the 90ms the screen cannot tell apart');
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => true });
    ok(win.SC70.backSliceMul() === 3, 'hidden, one wake-up does three slices of work');
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => false });
    // The two sliced writers - the mp3 block loop and the wav sample loop. The AIFF
    // and FLAC writers yield on a fixed stride of their own and are not slice-based.
    ok((html.match(/SC_ENCODE_SLICE_MS \* scBackSliceMul\(\)/g) || []).length === 2,
      'and both sliced encoders read it at their own slice boundary (' +
      ((html.match(/SC_ENCODE_SLICE_MS \* scBackSliceMul\(\)/g) || []).length) + ')');

    // A Web Lock stub: what was asked for, and when it was let go.
    const locks = [];
    Object.defineProperty(win.navigator, 'locks', {
      configurable: true,
      value: {
        request(name, opts, fn) {
          locks.push('ask:' + name + (opts && opts.mode ? ':' + opts.mode : ''));
          return Promise.resolve(fn()).then(
            (v) => { locks.push('release:' + name); return v; },
            (e) => { locks.push('release:' + name); throw e; });
        },
      },
    });
    const all = win.__scGetAllTracks().filter((t) => t.file && t.file.size && t.duration);
    const victim = all.slice().sort((a, b) => b.file.size - a.file.size)[0];
    const oldFile = victim.file, oldDuration = victim.duration;
    victim.file = new win.Blob([new win.Uint8Array(2097152)], { type: 'audio/mpeg' });
    victim.duration = 157;
    const realEncode = win.__scEncodeMp3;
    let release = null;
    win.__scEncodeMp3 = () => new Promise((res) => {
      release = () => res(new win.Blob([new win.Uint8Array(2000)], { type: 'audio/mpeg' }));
    });
    win.SC70.renderStudio();
    const started = win.SC70.pickRate(victim.id, 128);
    // The decode runs first, so the encoder is not asked for bytes immediately.
    for (let i = 0; i < 60 && !release; i++) await wait(50);
    ok(!!release, 'the encoder is really running, so what follows is a real job');
    ok(locks.indexOf('ask:sidecut-reencode:exclusive') !== -1,
      'the job takes a Web Lock before it encodes (' + locks.join(' | ') + ')');
    ok(locks.filter((l) => /^release:/.test(l)).length === 0, 'and holds it while it works');
    const recorded = win.localStorage.getItem('sidecut_encodeJob');
    ok(!!recorded && recorded.indexOf(victim.id) !== -1,
      'the run is written down before the first byte (' + String(recorded).slice(0, 60) + ')');
    const job = win.SC70.encodeJob();
    ok(!!job && job.id === victim.id && job.kbps === 128, 'the page knows which song and rate is running');
    win.SC70.jobProgress(0.5);
    await wait(40);
    win.SC70.renderStudio();
    const strip = doc.querySelector('#studioView [data-job]');
    ok(!!strip, 'the cleaner carries a strip for the running job');
    ok(!!strip && /carries on if you leave the app/.test(strip.textContent),
      'and it says the compress carries on when you leave');
    ok(!!strip && /50%/.test(strip.querySelector('[data-job-txt]').textContent),
      'with the percentage the encoder reported (' + (strip ? strip.querySelector('[data-job-txt]').textContent : 'no strip') + ')');
    const busyRow = doc.querySelector('#studioView [data-reenc="' + victim.id + '"]');
    ok(!!busyRow && busyRow.disabled, 'and the row it belongs to cannot be started twice');
    ok(!!busyRow && /Encoding/.test(busyRow.textContent), 'it reads Encoding, not Re-encode (' +
      (busyRow ? busyRow.textContent : 'no row') + ')');
    ok(!!strip && !!strip.querySelector('[data-job-bar]') && /width:\s*50%/.test(strip.querySelector('[data-job-bar]').getAttribute('style') || ''),
      'and the bar is half way, like the job');

    if (release) release();
    await started.catch(() => {});
    await wait(200);
    ok(locks.filter((l) => /^release:sidecut-reencode/.test(l)).length === 1, 'the lock is let go when the run ends');
    ok(!win.SC70.encodeJob(), 'and the page knows the job is over');
    ok(String(win.localStorage.getItem('sidecut_encodeJob')) === 'null',
      'and the record is cleared (' + String(win.localStorage.getItem('sidecut_encodeJob')) + ')');
    ok(victim.reencoded === true, 'the song landed');
    win.SC70.renderStudio();
    ok(!doc.querySelector('#studioView [data-job]'), 'and the strip is gone with it');

    // A run the phone killed instead of finishing: the song is untouched, and the
    // cleaner says what happened - once.
    win.SC70.undoReencode(victim.id);
    win.localStorage.setItem('sidecut_encodeJob', JSON.stringify({ id: victim.id, name: victim.name, kbps: 160, frac: 0.4, startedAt: Date.now() - 60000 }));
    win.SC70.renderStudio();
    const stopped = doc.querySelector('#studioView .sc-stopped');
    ok(!!stopped, 'a run that was killed outright is reported, not hidden');
    ok(!!stopped && stopped.textContent.indexOf(victim.name) !== -1, 'it names the song');
    ok(!!stopped && /untouched/.test(stopped.textContent), 'and says the song itself was never touched');
    const again = stopped ? stopped.querySelector('[data-reencgo]') : null;
    ok(!!again && again.getAttribute('data-rate') === '160',
      'with a button to start it again at the rate it was running');
    ok(String(win.localStorage.getItem('sidecut_encodeJob')) === 'null', 'and the record is read once, not kept as a banner');
    win.SC70.renderStudio();
    ok(!doc.querySelector('#studioView .sc-stopped'), 'so the next render is clean');

    delete win.navigator.locks;
    win.__scEncodeMp3 = realEncode;
    victim.file = oldFile;
    victim.duration = oldDuration;
    win.SC70.renderStudio();
  }

