# -- 5. the album reorder sheet: two seconds, and it opens on the held song ----
once('the row hold is two seconds',
     "      if(wasMoved || held < 2800) return;",
     "      if(wasMoved || held < 1800) return;")

once('the row hold timer is two seconds',
     "      // Three seconds (matching the delegated handler): long enough that a press\n"
     "      // cannot open the reorder sheet by accident.\n",
     "      // 80.7 - Two seconds (matching the delegated handler): long enough that\n"
     "      // a press cannot open the reorder sheet by accident, short enough that the\n"
     "      // sheet does not feel like a refused gesture.\n")

once('the row hold timer fires at two seconds',
     "      }, 3000);\n      addTracking();",
     "      }, 2000);\n      addTracking();")

once('the row hold hands the song to the sheet',
     "        if(typeof window.showAlbumReorderPopup === 'function') window.showAlbumReorderPopup(albumName);",
     "        if(typeof window.showAlbumReorderPopup === 'function') window.showAlbumReorderPopup(albumName, (row.dataset && row.dataset.id) || '');")

once('the delegated hold is two seconds',
     "  // Three full seconds, on purpose: a press this long cannot be an accident, so an\n",
     "  // Two full seconds, on purpose: a press this long cannot be an accident, so an\n")

once('the delegated hold timer is two seconds',
     "  var HOLD_MS = 3000;         // press length that opens the Reorder Songs sheet\n"
     "  var RELEASE_MIN_MS = 2800;  // a press this long still counts if Android cancels it early",
     "  var HOLD_MS = 2000;         // press length that opens the Reorder Songs sheet\n"
     "  var RELEASE_MIN_MS = 1800;  // a press this long still counts if Android cancels it early")

once('the delegated hold says two seconds',
     "      // The finger must still be on the screen when the three seconds are up.\n",
     "      // The finger must still be on the screen when the two seconds are up.\n")

once('the delegated hold hands the song to the sheet',
     "    try{ showAlbumReorderPopup(album); }",
     "    try{ showAlbumReorderPopup(album, (row && row.dataset && row.dataset.id) || ''); }")

once('the sheet takes the song it was opened for',
     "window.showAlbumReorderPopup = function(albumName){",
     "window.showAlbumReorderPopup = function(albumName, focusTrackId){")

once('the sheet opens on that song',
     "      row.appendChild(durDiv);\n      listEl.appendChild(row);\n",
     "      row.appendChild(durDiv);\n      listEl.appendChild(row);\n"
     "      // 80.7 - THE SONG YOU HELD IS THE ONE YOU SEE. The sheet builds from the\n"
     "      // top of the album, so holding the twelfth song opened a list that did not\n"
     "      // show it. It scrolls that row into the middle and lights it instead.\n"
     "      if(focusTrackId && !_focusDone && String(tt.id) === String(focusTrackId)){\n"
     "        _focusDone = true;\n"
     "        var _focusRow = row;\n"
     "        setTimeout(function(){\n"
     "          try{\n"
     "            var want = _focusRow.offsetTop - (listEl.clientHeight || 0) / 2 + (_focusRow.offsetHeight || 0) / 2;\n"
     "            listEl.scrollTop = Math.max(0, want);\n"
     "            _focusRow.style.background = 'rgba(227,178,60,0.20)';\n"
     "            setTimeout(function(){ try{ _focusRow.style.background = ''; }catch(_e){ } }, 900);\n"
     "          }catch(_e){ }\n"
     "        }, 30);\n"
     "      }\n")

once('the sheet only lights one row',
     "    if(!__origOrders[targetAlbumName]) __origOrders[targetAlbumName] = (targetAlbum.trackIds || []).slice();\n"
     "    listEl.innerHTML = '';\n",
     "    if(!__origOrders[targetAlbumName]) __origOrders[targetAlbumName] = (targetAlbum.trackIds || []).slice();\n"
     "    listEl.innerHTML = '';\n"
     "    var _focusDone = false;\n")

once('the sheet comment stops promising three seconds',
     "  /* No progress bar. A three-second hold used to draw a bar crawling across the\n"
     "     bottom of the row, which read as \"something is happening to my song\". The\n"
     "     armed tint above is the whole of the feedback now: tint means the press is\n"
     "     registered, the sheet simply opens when the three seconds are up. */",
     "  /* No progress bar. A hold used to draw a bar crawling across the bottom of the\n"
     "     row, which read as \"something is happening to my song\". The armed tint above\n"
     "     is the whole of the feedback: tint means the press is registered, and the\n"
     "     sheet opens when the two seconds are up. */")

# -- 6. the help text stops promising three seconds ---------------------------
once('the album help says two seconds (1)',
     "Hold a song for 3 seconds inside an album to reorder it.",
     "Hold a song for 2 seconds inside an album to reorder it.")

once('the album help says two seconds (2)',
     "Hold a song 3 seconds inside an album to reorder it; Done keeps, Cancel restores.",
     "Hold a song 2 seconds inside an album to reorder it; Done keeps, Cancel restores.")

once('the album help says two seconds (3)',
     "Hold a row <b>3 seconds</b> inside an album to reorder it.",
     "Hold a row <b>2 seconds</b> inside an album to reorder it.")

# -- 7. the changelog ---------------------------------------------------------
def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.7 - A COLLAB IS A DROP, A FAKE RELEASE CAN BE DELETED, AND THE ALBUM\n"
    "  // SHEET OPENS IN TWO SECONDS. The owner: a Daddy Yankee collab with Diljit\n"
    "  // Dosanjh \"didn't show up in new releases like it should have\", a fake release\n"
    "  // should go on a two-second hold and Delete, and the album sheet should open in\n"
    "  // two seconds instead of three - and be better for it.\n"
    "  { version: '80.7', date: '{{STAMP}}', title: 'Collabs filed under the other artist, a fake release you can delete, and the reorder sheet in two seconds', items: [\n"
    "    'A collaboration that is filed under the other artist\\'s name now shows up in New Releases: a credit is read as every name it carries, so pinning one artist finds the track they are credited second on.',\n"
    "    'A fake or mis-filed release can be deleted: hold it for two seconds, press Delete in the sheet that opens, and it leaves every New Releases surface with an Undo behind it. A tap still opens the release as before.',\n"
    "    'The album reorder sheet opens after two seconds instead of three, and it opens on the song you held - that row is scrolled into view and lit for a moment instead of the sheet starting at the top of the album.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
if ANCHOR in SRC:
    once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)
else:
    failed.append('the changelog anchor for 80.6.32 is not on the page')
