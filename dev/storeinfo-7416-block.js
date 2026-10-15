  console.log('[6b] a cleaner row opens its own bubble: the whole artist, the exact size');
  {
    // 74.1.6, from the owner's phone: "I should be able to click on the name of the
    // song and the bubble for it pops up showing the mb and full artist name." A
    // cleaner row clips BOTH of those on purpose (24 rows have to fit one screen
    // beside a button), so the bubble is the only place they can be read whole.
    // That makes two things worth driving for real: the tap opens it, and what it
    // shows is not the clipped version - text AND stylesheet, because jsdom has no
    // layout and an ellipsis rule is invisible to a textContent check.
    const css = (sel) => {
      const i = html.indexOf(sel + '{');
      return i === -1 ? '' : html.slice(i, html.indexOf('}', i) + 1);
    };
    const all = win.__scGetAllTracks().filter((t) => t.file && t.file.size);
    const victim = all.slice().sort((a, b) => b.file.size - a.file.size)[0];
    const other = all.filter((t) => t.id !== victim.id)[0];
    const oldArtist = victim.artist, oldFile = victim.file, oldDuration = victim.duration;
    // A credit the way a real one arrives - six names, longer than any row can
    // show - and a file big enough that the re-encode estimate has something to
    // say. Both are put back before the block ends.
    const LONG = 'Karan Aujla, Mxrci, Seshnolan, Gminxr, Yeah Proof, Ikky';
    victim.artist = LONG;
    victim.file = new win.Blob([new win.Uint8Array(4194304)], { type: 'audio/mpeg' });
    victim.duration = 157;

    win.SC70.renderStudio();
    const rows = Array.from(doc.querySelectorAll('#studioView .sc-store-row'));
    ok(rows.length > 0, 'the cleaner is on the page with rows to tap (' + rows.length + ')');
    const victimRow = rows.filter((r) => r.querySelector('.sc-store-hit[data-id="' + victim.id + '"]'))[0];
    ok(!!victimRow, 'the song that was made big has a row of its own');
    const hit = victimRow.querySelector('.sc-store-hit');
    ok(hit.tagName === 'BUTTON', 'the left of the row is the tap target, as a real button (' + hit.tagName + ')');
    ok(hit.getAttribute('data-act') === 'storeinfo', 'and it asks for the song bubble');
    ok(doc.querySelectorAll('#studioView .sc-store-hit').length === rows.length,
      'one on every row, none without');
    ok(doc.querySelectorAll('#studioView [data-reenc]').length === rows.length,
      'with the Re-encode button still on every row beside it');
    ok(victimRow.querySelector('[data-reenc]').getAttribute('data-reenc') === victim.id,
      'and that button still belongs to the same song');
    ok(hit.getAttribute('aria-expanded') === 'false', 'a closed row says its bubble is closed');
    ok(doc.querySelectorAll('#studioView .sc-info').length === 0, 'and nothing is open yet');

    hit.click();
    ok(doc.querySelectorAll('#studioView .sc-info').length === 1, 'tapping the song opens one bubble');
    const info = doc.querySelector('#studioView .sc-info');
    ok(!!info && info.getAttribute('data-info') === victim.id, 'it belongs to the song that was tapped');
    const openedRow = doc.querySelector('#studioView .sc-store-row.open');
    // The bubble is the row's immediate next sibling in the cleaner's list, so it
    // reads as hanging under that row and not under some other one.
    ok(!!openedRow && !!openedRow.nextElementSibling && openedRow.nextElementSibling === info,
      'and it opens under its own row');
    ok(doc.querySelectorAll('#studioView .sc-store-hit[aria-expanded="true"]').length === 1,
      'the row it belongs to is the one that says it is open');

    const lines = Array.from(info.querySelectorAll('.sc-info-line'));
    const valueOf = (label) => {
      const l = lines.filter((d) => d.querySelector('span').textContent === label)[0];
      return l ? l.querySelector('b').textContent : '';
    };
    ok(info.querySelector('.sc-info-artist').textContent === LONG,
      'the WHOLE artist credit, not the clipped one (' + info.querySelector('.sc-info-artist').textContent + ')');
    ok(info.querySelector('.sc-info-name').textContent === victim.name,
      'and the whole song name (' + info.querySelector('.sc-info-name').textContent + ')');
    // The size is the file's own bytes, formatted by the test - not read back from
    // the app's formatter, which would only prove the formatter agrees with itself.
    ok(valueOf('Size on this phone') === (4194304 / 1048576).toFixed(1) + ' MB',
      'the exact size in MB (' + valueOf('Size on this phone') + ')');
    ok(valueOf('Length') === '2:37', 'the length of the song (' + valueOf('Length') + ')');
    ok(valueOf('The file reads') === 'about ' + Math.round((4194304 * 8) / 157 / 1000) + ' kbps',
      'and how the file sizes up (' + valueOf('The file reads') + ')');
    const rateLine = lines.filter((d) => /^Re-encode at \d+ kbps$/.test(d.querySelector('span').textContent))[0];
    ok(!!rateLine, 'it answers what the button beside it would win, at the chosen rate');
    if (rateLine) {
      const rate = parseInt(rateLine.querySelector('span').textContent.match(/(\d+) kbps/)[1], 10);
      const win = Math.max(0, 4194304 - Math.round(157 * rate * 125));
      ok(rateLine.querySelector('b').textContent === (win ? 'wins back ' + (win / 1048576).toFixed(1) + ' MB' : 'nothing to win'),
        'and that number is the arithmetic, in MB (' + rateLine.querySelector('b').textContent + ' at ' + rate + ' kbps)');
    }
    // The row still clips and the bubble never does - the one pair of rules that
    // makes the bubble worth opening, checked on the stylesheet.
    ok(/text-overflow: ellipsis/.test(css('.sc-store-sub')), 'the row line really is clipped');
    ok(/white-space: normal/.test(css('.sc-info-name')) && !/ellipsis/.test(css('.sc-info-name')),
      'the name in the bubble is not');
    ok(/white-space: normal/.test(css('.sc-info-artist')) && !/ellipsis/.test(css('.sc-info-artist')),
      'and neither is the artist credit');

    // Closing, and moving to another song: one bubble at a time, never a list.
    doc.querySelector('#studioView .sc-store-hit[data-id="' + victim.id + '"]').click();
    ok(doc.querySelectorAll('#studioView .sc-info').length === 0, 'tapping the same row again closes it');
    ok(doc.querySelector('#studioView .sc-store-hit[data-id="' + victim.id + '"]').getAttribute('aria-expanded') === 'false',
      'and the row drops back to closed');
    doc.querySelector('#studioView .sc-store-hit[data-id="' + other.id + '"]').click();
    ok(doc.querySelectorAll('#studioView .sc-info').length === 1, 'tapping another row opens exactly one bubble');
    ok(doc.querySelector('#studioView .sc-info').getAttribute('data-info') === other.id, 'on that song');

    // The tap target must never swallow the button beside it.
    const realEncode2 = win.__scEncodeMp3;
    win.__scEncodeMp3 = () => Promise.resolve(new win.Blob([new win.Uint8Array(2000)], { type: 'audio/mpeg' }));
    win.SC70.renderStudio();
    doc.querySelector('#studioView [data-reenc="' + victim.id + '"]').click();
    await wait(1400);
    ok(victim.reencoded === true, 'the Re-encode button still re-encodes its own song');
    win.SC70.undoReencode(victim.id);
    win.__scEncodeMp3 = realEncode2;

    victim.artist = oldArtist;
    victim.file = oldFile;
    victim.duration = oldDuration;
    win.SC70.renderStudio();
  }

