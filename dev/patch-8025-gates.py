# The gate files 80.2.5 has to change, and the exact edit in each one.
#
# WHY THIS FILE EXISTS. Four suites in dev/ promised the behaviour this release
# removes, or pinned a count this release grows - they are the audit of the album
# rules, and a rule that changed without them would be a rule nobody checked. They
# are edited here rather than carried whole, because each edit is a few lines and
# the page's own patch is the only thing that should travel as a payload.
#
# The page patch runs FIRST, so every OLD string below is the one on main before
# this release (80.2.4). The repin runs after, so any literal this file writes is
# already the live build and is left alone.

# dev/gates.sh - the new suite joins the battery.
GATES_SH = (
    'dev/gates.sh',
    'revamp-check staircase-check album-real-order-check"',
    'revamp-check staircase-check album-real-order-check album-auto-delete-check"',
    'the new suite joins the battery',
)

# dev/album-real-order-check.cjs - it pinned 80.2.4 with an escape sequence (which
# the repin does not sweep, by design: literals are what the repin moves) and the
# row count of a menu this release gives a third row.
REAL_ORDER = (
    'dev/album-real-order-check.cjs',
    """  ok('the page runs 80.2.4', /const APP_VERSION = '80\\.2\\.4';/.test(html));""",
    """  // The live build, not the release this file was written for: 80.2.5 added a third
  // row to this same menu, and 80.2.6 will move the number again. The pin is a
  // quoted literal on purpose, because that is what dev/repin-<version>.mjs sweeps
  // - a literal is repinned every release, an escape sequence is not.
  const VER = '80.2.5'; /* repinned by dev/repin-8025.mjs */
  ok('the page runs ' + VER, new RegExp("const APP_VERSION = '" + VER.replace(/\\./g, '\\\\.') + "';").test(html));""",
    'the 80.2.4 suite reads the live build',
)

REAL_ORDER_ROWS = (
    'dev/album-real-order-check.cjs',
    """  ok('they open an album menu', rows.length === 2, String(rows.length));""",
    """  // Two rows here, and the album's own delete joined them in 80.2.5: the count is
  // not this file's to pin, the two it added are.
  ok('they open an album menu', rows.length >= 2, String(rows.length));""",
    'and does not pin a count the delete grows',
)

# dev/albums-manual-check.cjs - the 73.1.9 block promised a rebuild from tags on
# every boot. It now proves the rule that replaced it, and the archive path that
# keeps the recovery honest.
MANUAL_HEAD = (
    'dev/albums-manual-check.cjs',
    """//   1. An entry the app created for itself (an old card-drag auto-save, or a tag
//      album materialised so a reorder had somewhere to live) is cleared from the
//      Albums tab by the boot sweep, and the name it had taken is free again —""",
    """//   (80.2.5 changed one thing this file covers: the boot no longer rebuilds an
//    album out of a tag at all. It restores only what it archived, which is what
//    the second half of the sweep block below now proves.)
//
//   1. An entry the app created for itself (an old card-drag auto-save, or a tag
//      album materialised so a reorder had somewhere to live) is cleared from the
//      Albums tab by the boot sweep, and the name it had taken is free again —""",
    'the header stops promising the old rule',
)

MANUAL_BLOCK = (
    'dev/albums-manual-check.cjs',
    """  console.log('\\n— 73.1.9: recovery is every-boot, whole-list, and respects a real delete —');
  {
    // A sweep victim whose name no entry holds any more. 73.1.8 rebuilt this
    // only ONCE and only from the unclaimed songs; 73.1.9 rebuilds it on any
    // boot and WHOLE - the song My Mix also holds comes back into it.
    const m = idb._data.meta.get('userAlbums');
    delete m.value['MoonChild Era'];
    win.__scAlbumsRecoverDeleted();
    const s2 = storedAlbums() || {};
    ok('a sweep victim is rebuilt on a later boot too (every-boot, not one-shot)',
       !!s2['MoonChild Era'], JSON.stringify(Object.keys(s2)));
    ok('rebuilt WHOLE - the song My Mix also holds is included',
       s2['MoonChild Era'] && eq(s2['MoonChild Era'].trackIds, ['t1', 't2', 't3']), JSON.stringify(s2['MoonChild Era']));
    ok('the album that shared the song is untouched (additive only)',
       s2['My Mix'] && eq(s2['My Mix'].trackIds, ['t1', 't4']), JSON.stringify(s2['My Mix']));
    ok('and the rebuilt album is marked yours', s2['MoonChild Era'] && s2['MoonChild Era'].manual === true && !s2['MoonChild Era'].auto,
       JSON.stringify([s2['MoonChild Era'] && s2['MoonChild Era'].manual, s2['MoonChild Era'] && s2['MoonChild Era'].auto]));
  }
""",
    """  console.log('\\n— 80.2.5: a lost entry is not invented from its tag, only restored from the archive —');
  {
    // THE OWNER: "sometimes they're making random albums with singles and stuff idk
    // why it shouldn't be doing that". 73.1.9 rebuilt any tag-named album on every
    // boot, and that is what put cards nobody made into the list: the tags on a phone
    // are whatever the files arrived with. 80.2.5 restores only what the app has a
    // record of taking (sidecut_albumsArchive), so an entry that goes missing on its
    // own is NOT re-made out of the album tags on the files.
    const m = idb._data.meta.get('userAlbums');
    delete m.value['MoonChild Era'];
    win.__scAlbumsRecoverDeleted();
    const s2 = storedAlbums() || {};
    ok('an entry that went missing is not invented out of its tag',
       !s2['MoonChild Era'], JSON.stringify(Object.keys(s2)));
    ok('the songs and their tags are untouched by that',
       eq(tags(), { t1: 'MoonChild Era', t2: 'MoonChild Era', t3: 'MoonChild Era', t4: 'G.O.A.T', t5: 'G.O.A.T' }),
       JSON.stringify(tags()));
    ok('and the albums that are there are untouched',
       s2['My Mix'] && eq(s2['My Mix'].trackIds, ['t1', 't4']), JSON.stringify(s2['My Mix']));
    // The record the pass DOES honour: the archive the sweep writes when it takes an
    // entry away. That is the only thing a launch puts back - restored with the song
    // list it had at the moment it went, never rebuilt from a guess.
    win.localStorage.setItem('sidecut_albumsArchive', JSON.stringify({
      'MoonChild Era': { at: 1, entry: { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, auto: true } },
    }));
    win.__scAlbumsRecoverDeleted();
    const s3 = storedAlbums() || {};
    ok('an album the app archived is put back, whole',
       s3['MoonChild Era'] && eq(s3['MoonChild Era'].trackIds, ['t1', 't2', 't3']), JSON.stringify(s3['MoonChild Era']));
    ok('marked yours, with the stale flag gone',
       s3['MoonChild Era'] && s3['MoonChild Era'].manual === true && !s3['MoonChild Era'].auto,
       JSON.stringify([s3['MoonChild Era'] && s3['MoonChild Era'].manual, s3['MoonChild Era'] && s3['MoonChild Era'].auto]));
    ok('and it left the archive (restored, not copied)',
       eq(win.__scAlbumsArchivedNames(), []), JSON.stringify(win.__scAlbumsArchivedNames()));
    ok('the album that shared its songs is still untouched',
       s3['My Mix'] && eq(s3['My Mix'].trackIds, ['t1', 't4']), JSON.stringify(s3['My Mix']));
  }

""",
    'the 73.1.9 block answers for the rule that replaced it',
)

# dev/album-isolation-check.cjs - the audit expected the launch to add tag albums.
ISO_HEAD = (
    'dev/album-isolation-check.cjs',
    """//   2. The Albums tab is MANUAL-ONLY: it lists the albums the user created by
//      hand, and never invents cards for albums that exist only as file tags
//      (the "why are there 400 songs in my albums" report).""",
    """//   2. The Albums tab is MANUAL-ONLY: it lists the albums the user created by
//      hand, and never invents cards for albums that exist only as file tags
//      (the "why are there 400 songs in my albums" report).
//
// 80.2.5 made rule 2 hold at the LAUNCH as well. The boot recovery used to rebuild
// every multi-song album tag as an entry of its own, which is where the cards
// nobody made came from; it now restores only what the app archived. So this file
// expects ONE card here - 'My Mix', the album made by hand - and a tag the picker
// takes in is still taken in by hand, which the last section proves.""",
    'the audit header says what the launch does now',
)

ISO_BOOT = (
    'dev/album-isolation-check.cjs',
    """  // 73.1.8: the one-time upgrade recovery rebuilds the sweep victims from their
  // file tags — 'Other Album' is a real card alongside the hand-made one.
  // 73.1.9: recovery is every-boot and WHOLE - both multi-song tags rebuild
  // ('MoonChild Era' 3 songs + the recovered 'Other Album' 2 songs).
  ok('the hand-made album and every recovered tag album have cards',
     eq(cardNames(win).slice().sort(), ['MoonChild Era', 'My Mix', 'Other Album']), JSON.stringify(cardNames(win)));
  ok('and each recovered album lists its WHOLE tag (no song left out)',
     (() => { const v = storedAlbums() || {}; return (!!v['MoonChild Era'] && v['MoonChild Era'].trackIds.length === 3); })(), JSON.stringify(storedAlbums()));
  ok('and no album outside those three exists as a card', cardNames(win).length === 3, JSON.stringify(cardNames(win)));
  ok('no album beyond the recovered tag names exists in storage',
     eq(Object.keys(storedAlbums() || {}).sort(), ['MoonChild Era', 'My Mix', 'Other Album']),
     JSON.stringify(Object.keys(storedAlbums() || {})));""",
    """  // 80.2.5: the launch invents nothing. Both multi-song tags on these files
  // ('MoonChild Era' 3 songs, 'Other Album' 2) used to become entries of their own
  // here; the card the user made is the only card there is.
  ok('the album made by hand is the only card on the Albums tab',
     eq(cardNames(win).slice().sort(), ['My Mix']), JSON.stringify(cardNames(win)));
  ok('and no tag album was invented alongside it',
     (() => { const v = storedAlbums() || {}; return !v['MoonChild Era'] && !v['Other Album'] && !!v['My Mix']; })(),
     JSON.stringify(Object.keys(storedAlbums() || {})));
  ok('so no album outside the one you made exists as a card', cardNames(win).length === 1, JSON.stringify(cardNames(win)));
  ok('and the store holds nothing but the album you made',
     eq(Object.keys(storedAlbums() || {}).sort(), ['My Mix']),
     JSON.stringify(Object.keys(storedAlbums() || {})));""",
    'the boot section expects one card',
)

ISO_COUNT = (
    'dev/album-isolation-check.cjs',
    """  // 73.1.8: the one-time upgrade-boot recovery rebuilds tag-named albums the old
  // sweep deleted whole, so 'Other Album' (2 songs) is a card here alongside the
  // hand-made one — and the header counts both albums' songs, not the library.
  ok('the header counts only the albums’ songs (5, not more than the albums hold)', /\\b5 tracks\\b/.test(paneHeader(win)), paneHeader(win));
  ok('the tag-only songs are not smuggled into the count beyond the albums', !/\\b7 tracks\\b/.test(paneHeader(win)), paneHeader(win));""",
    """  // The header counts the songs of the albums on screen - one album, three songs -
  // and never the whole library (five files).
  ok('the header counts only the albums’ songs (3, not the library’s 5)', /\\b3 tracks\\b/.test(paneHeader(win)), paneHeader(win));
  ok('the tag-only songs are not smuggled into the count beyond the albums', !/\\b5 tracks\\b/.test(paneHeader(win)), paneHeader(win));""",
    'the header count follows the cards',
)

ISO_REORDER = (
    'dev/album-isolation-check.cjs',
    """  // 73.1.8: the reorder itself must still invent NOTHING — the recovery's one
  // tag-named album is the only extra entry, and it existed before the reorder.
  ok('reordering invented no album beyond the recovered ones', eq(Object.keys(albumsAfter).sort(), ['MoonChild Era', 'My Mix', 'Other Album']), JSON.stringify(Object.keys(albumsAfter)));""",
    """  // A reorder must never invent an album either: one album in, one album out.
  ok('reordering invented no album', eq(Object.keys(albumsAfter).sort(), ['My Mix']), JSON.stringify(Object.keys(albumsAfter)));""",
    'a reorder invents nothing',
)

ISO_CARD_COUNT = (
    'dev/album-isolation-check.cjs',
    """  ok('and no FOURTH album appears out of the reorder', eq(cardNames(win).slice().sort(), ['MoonChild Era', 'My Mix', 'Other Album']), JSON.stringify(cardNames(win)));""",
    """  ok('and no second album appears out of the reorder', eq(cardNames(win).slice().sort(), ['My Mix']), JSON.stringify(cardNames(win)));""",
    'and adds no card',
)

ISO_PICKER = (
    'dev/album-isolation-check.cjs',
    """  // 73.1.9: the saved album, plus every recovered tag album. Albums may share
  // songs now - sharing is what keeps a rebuilt album WHOLE - and the picker
  // offers each of them.
  ok('picker offers the saved album and the recovered tag albums', picks.length === 3,
     'picks=' + picks.length + ' ' + picks.map((b) => b.textContent.trim().replace(/\\s+/g, ' ')).join(' | '));""",
    """  // The saved album, plus the tag the library still has songs for that no album
  // holds ('Other Album', 2 songs). 'MoonChild Era' is not offered because every
  // song carrying that tag is already inside 'My Mix'. Taking one in here is the
  // deliberate way a tag becomes an album.
  ok('picker offers the saved album and the tag no album holds yet', picks.length === 2,
     'picks=' + picks.length + ' ' + picks.map((b) => b.textContent.trim().replace(/\\s+/g, ' ')).join(' | '));""",
    'the picker offers what is left',
)

ISO_AFTER_PICK = (
    'dev/album-isolation-check.cjs',
    """  ok('no other album appeared', cardNames(win).length === 3, JSON.stringify(cardNames(win)));""",
    """  ok('no other album appeared', cardNames(win).length === 2, JSON.stringify(cardNames(win)));""",
    'taking one in adds exactly one',
)

ISO_PLAYING = (
    'dev/album-isolation-check.cjs',
    """  ok('the playing highlight did not add or remove any album card',
     eq(cardNames(win).slice().sort(), ['MoonChild Era', 'My Mix', 'Other Album']), JSON.stringify(cardNames(win)));""",
    """  ok('the playing highlight did not add or remove any album card',
     eq(cardNames(win).slice().sort(), ['My Mix', 'Other Album']), JSON.stringify(cardNames(win)));""",
    'and playback adds no card',
)

# dev/albums-menu-isolation-check.cjs - the export confirm counted the rebuilt albums.
MENU_EXPORT = (
    'dev/albums-menu-isolation-check.cjs',
    """    // 73.1.9: the junk single-song 'Tag Album' entry is cleared and archived
    // (name not a file tag); recovery rebuilds 'MoonChild Era' WHOLE and
    // 'G.O.A.T' whole, so the export is about 4 albums. The song count is the
    // UNIQUE library songs across them (6 of 6) - the export dedupes by design.
    ok('it counts the songs of your albums (6 unique songs across 4 albums)',
       /\\b6 songs?\\b/.test(body), body.slice(0, 120));
    ok('it names the albums you have', /\\b4 albums?\\b/.test(body), body.slice(0, 120));""",
    """    // 80.2.5: the junk single-song 'Tag Album' entry is still cleared and archived
    // (its name is not a file tag), and the launch no longer invents an album out
    // of the 'MoonChild Era' / 'G.O.A.T' tags - so the export is about the two
    // albums you have. Its song count is the UNIQUE library songs across them
    // (t1, t4, t5, t6 - 4 of 6) because the export dedupes by design.
    ok('it counts the songs of your albums (4 unique songs across 2 albums)',
       /\\b4 songs?\\b/.test(body), body.slice(0, 120));
    ok('it names the albums you have', /\\b2 albums?\\b/.test(body), body.slice(0, 120));""",
    'the export counts the albums that exist',
)

MENU_ENTRIES = (
    'dev/albums-menu-isolation-check.cjs',
    """  // 73.1.9: the junk 'Tag Album' (name is NO file tag) is cleared and archived;
  // recovery rebuilt 'MoonChild Era' WHOLE (t1,t2,t3,t6 — even the t1 that My
  // Mix shares) and 'G.O.A.T' whole (t4,t5) from the tags on the files.
  ok('the hand-made album entries are unchanged (rebuilt ones whole and marked yours, junk archived)',
     (() => {
       const v = idb._data.meta.get('userAlbums').value || {};
       const mine = { 'My Mix': v['My Mix'], 'Late Night': v['Late Night'] };
       const rec = v['MoonChild Era'];
       const goat = v['G.O.A.T'];
       return eq(mine, ALBUMS_AFTER_BOOT) && !!rec && rec.manual === true && !rec.auto &&
              eq(rec.trackIds, ['t1', 't2', 't3', 't6']) &&
              !!goat && goat.manual === true && eq(goat.trackIds, ['t4', 't5']) &&
              typeof win.__scAlbumsArchivedNames === 'function' &&
              win.__scAlbumsArchivedNames().indexOf('Tag Album') !== -1;
     })(), JSON.stringify(idb._data.meta.get('userAlbums').value));""",
    """  // The junk 'Tag Album' (its name is NO file tag) is cleared and archived. 80.2.5:
  // the 'MoonChild Era' and 'G.O.A.T' tags are NOT turned into albums any more, so
  // the store holds the two albums made by hand and nothing else.
  ok('the hand-made album entries are unchanged (junk archived, no tag album invented)',
     (() => {
       const v = idb._data.meta.get('userAlbums').value || {};
       const mine = { 'My Mix': v['My Mix'], 'Late Night': v['Late Night'] };
       return eq(mine, ALBUMS_AFTER_BOOT) &&
              v['MoonChild Era'] === undefined && v['G.O.A.T'] === undefined &&
              typeof win.__scAlbumsArchivedNames === 'function' &&
              win.__scAlbumsArchivedNames().indexOf('Tag Album') !== -1;
     })(), JSON.stringify(idb._data.meta.get('userAlbums').value));""",
    'the store holds the albums you made',
)

EDITS = [
    GATES_SH,
    REAL_ORDER,
    REAL_ORDER_ROWS,
    MANUAL_HEAD,
    MANUAL_BLOCK,
    ISO_HEAD,
    ISO_BOOT,
    ISO_COUNT,
    ISO_REORDER,
    ISO_CARD_COUNT,
    ISO_PICKER,
    ISO_AFTER_PICK,
    ISO_PLAYING,
    MENU_EXPORT,
    MENU_ENTRIES,
]
