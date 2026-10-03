#!/usr/bin/env node
/**
 * SideCut 72.5.1 - the widget's transport buttons reach the player again.
 *
 * The owner's report: play a song, leave the app while it is still playing, then
 * press pause / play / next / previous on the home-screen widget and nothing
 * happens.
 *
 * TWO THINGS HAVE TO BE TRUE for those presses to work, and the app was not
 * reliably holding either one:
 *
 * 1. THE PRESS HAS TO REACH A SESSION THAT IS OURS. The widget sent each press
 *    as a system-wide media key (AudioManager.dispatchMediaKeyEvent), and Android
 *    delivers a media key to whichever player it currently considers active. In
 *    the background that is frequently another app, or nothing at all, so all
 *    four buttons came out dead while the song was audibly still playing. The
 *    widget now hands the key straight to the service that owns SideCut's own
 *    media session, with the system-wide key kept only as a fallback.
 *
 * 2. THE SESSION HAS TO EXIST, AND KEEP ITS BUTTONS. The native notification
 *    player was armed exactly once, three seconds after boot. If the bridge was
 *    not ready at that one moment the app ran the whole session with NO media
 *    session at all - no lock-screen player, and a widget with nothing to hand a
 *    press to. Arming now retries until it takes. And the system can rebuild the
 *    notification while the app is away; a session rebuilt without handlers has
 *    no buttons, so every control is re-asserted on the way OUT of the app as
 *    well as on the way back in, and the play heartbeat puts them back if they
 *    were lost while away.
 *
 * THE SESSION SIDE IS DELIVERED TWICE, ON PURPOSE. The web half (the arming and
 * the re-asserts) rides an OTA update and reaches a phone in minutes. The widget
 * half is native Java injected only during the Android build, so it reaches a
 * phone in the next APK. They are complementary, not alternatives.
 *
 * EVERY sub carries a `key`, so re-running this on a tree that already has it
 * applied is a no-op instead of a second insertion.
 *
 *   node dev/patch-7251.mjs
 *   node dev/patch-7251.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.5.1';
const STAMP = 'October 2, 2026 \\u00b7 7:27 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.5';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'The widget transport buttons reach the player again';
const NOTES = [
  'The play, pause, next and previous buttons on the home-screen widget now reach SideCut itself. A press was sent out as a general media key, which lands on the player the phone considers active, and in the background that was often another app.',
  'The widget hands each press straight to the player SideCut owns, so the four buttons keep working whether the app is open, in the background, or only the lock screen is showing.',
  'The notification and lock-screen player is armed as soon as the app can reach it and keeps trying if the first moment is missed, instead of being given up on for the whole session.',
  'Every control is put back when you leave the app, not only when you return, so a card the system rebuilt while you were away comes back with all four buttons rather than play and pause on their own.',
  'A press on the widget while SideCut is not running opens the app instead of doing nothing, so the transport button is never a dead one.',
  'The rule for the previous button is unchanged: past a few seconds it restarts the song that is playing, and in the opening seconds it moves to the song before it.',
  'A song that is still playing when you leave the app keeps playing. This release is about the buttons that control it from outside the app, not about playback itself.',
  'Nothing about your songs, playlists or settings changed. Your library, your queue and your saved songs are read exactly as they were.',
  'The Albums list can let go of the albums you are done with. A switch in Settings > More and in Manage albums, off by default, closes every album when you leave the tab and leaves the one the playing song is in open, if it is in one.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

let applied = 0, already = 0;

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

// NO TOP GUARD, on purpose, and this is the difference from patch-725 (which
// needed one because it REMOVED a trailing newline, and a key can only ever mean
// "the text I add is already here"). Every sub here is an insertion or a swap and
// carries a `key`, so re-running on a half-applied or fully-applied tree adds
// exactly what is missing and nothing else. That matters for 72.5.1: the album
// switch was added to this release after the first pass had already run, so it
// has to land on top of an already-72.5.1 tree.

/* ============================================================================
   1. THE VERSION, AND WHAT A FOURTH NUMBER MEANS
   ========================================================================== */
sub(html, 'the app runs 72.5.1, and the comment says why a fourth number exists',
  "  // 70.0.0, which the updater would treat as the same build.\n" +
  "  const APP_VERSION = '72.5';\n",
  "  // 70.0.0, which the updater would treat as the same build.\n" +
  "  // 72.5.1 adds a FOURTH number for a fix shipped inside a release: the\n" +
  "  // updater compares the numbers one at a time, so it reads 72.5.1 as newer\n" +
  "  // than 72.5 and installs it, while the release it belongs to stays 72.5.\n" +
  "  const APP_VERSION = '72.5.1';\n",
  { key: "const APP_VERSION = '72.5.1';" });

/* ============================================================================
   2. THE CHANGELOG HEAD
   ========================================================================== */
const headEntry = [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...NOTES.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');

sub(html, 'the changelog carries the 72.5.1 entry at its head',
  "  const CHANGELOG = [\n" +
  "  { version: '" + OLDVER + "', date:",
  "  const CHANGELOG = [\n" +
  headEntry + "\n" +
  "  { version: '" + OLDVER + "', date:",
  { key: "{ version: '" + VERSION + "', date: '" + STAMP + "'" });

// The album switch was written into the release after the first pass had already
// run, so the entry it wrote has to GROW by one note. On a fresh run the first sub
// above writes all nine and this one finds its own key already present; on the
// already-applied tree it is this sub that does the work.
const entryWith = (notes) => [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...notes.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');
sub(html, 'the 72.5.1 entry grows by the album switch note',
  entryWith(NOTES.slice(0, NOTES.length - 1)),
  entryWith(NOTES),
  { key: NOTES[NOTES.length - 1] });

sub(sw, 'the shell cache is this release name',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ============================================================================
   3. THE NOTIFICATION PLAYER ARMS RELIABLY
   --------------------------------------------------------------------------
   It used to be armed exactly once, three seconds after boot. A bridge that was
   not ready at that moment - or a session that had been auto-disabled after a
   crash on this version and then re-enabled - left the whole run with no media
   session. The body becomes a named function that is called at three seconds and
   then retried every two seconds until it takes (or gives up after a minute).
   ========================================================================== */
sub(html, 'the arming becomes a function that can be tried again',
  "    setTimeout(() => {\n" +
  "      try{\n" +
  "        try{ if(window.__scMediaNotifOff(localStorage.getItem('sidecut_native_media'))) return; }catch(e){ }\n" +
  "        const C = window.Capacitor;\n" +
  "        if(!C || typeof C.nativePromise !== 'function' || typeof C.nativeCallback !== 'function') return;\n" +
  "        let broken = false;\n",
  "    // 72.5.1 - ARM THE NOTIFICATION PLAYER RELIABLY. This was armed exactly once,\n" +
  "    // three seconds after boot, and if the bridge was not ready at that one\n" +
  "    // moment the app ran the whole session with NO media session at all: the\n" +
  "    // lock-screen player never appeared and the home-screen widget had nothing\n" +
  "    // to hand its play, pause, next and previous to. It keeps trying until it is\n" +
  "    // armed instead - and if it did arm, _scMediaArmDone stops the retries.\n" +
  "    let _scMediaArmDone = false;\n" +
  "    function _scArmNativeMedia(){\n" +
  "      try{\n" +
  "        try{ if(window.__scMediaNotifOff(localStorage.getItem('sidecut_native_media'))) return; }catch(e){ }\n" +
  "        const C = window.Capacitor;\n" +
  "        if(!C || typeof C.nativePromise !== 'function' || typeof C.nativeCallback !== 'function') return;\n" +
  "        let broken = false;\n",
  { key: 'function _scArmNativeMedia(){' });

sub(html, 'arming it marks the job done, so the retries stop',
  "        capMediaSessionActive = capMediaSessionNative;\n" +
  "        if(window.__scMark) __scMark('the media player notification');\n",
  "        capMediaSessionActive = capMediaSessionNative;\n" +
  "        _scMediaArmDone = true;\n" +
  "        if(window.__scMark) __scMark('the media player notification');\n",
  { key: '_scMediaArmDone = true;' });

sub(html, 'the arm call becomes a retrying timer instead of a single three-second shot',
  "    }, 3000);\n" +
  "  }\n" +
  "\n" +
  "  function updateMediaSession(t){\n",
  "    }\n" +
  "    setTimeout(function(){ try{ _scArmNativeMedia(); }catch(e){} }, 3000);\n" +
  "    (function(){\n" +
  "      let _scArmTries = 0;\n" +
  "      const _scArmTimer = setInterval(function(){\n" +
  "        if(_scMediaArmDone || ++_scArmTries > 30){ clearInterval(_scArmTimer); return; }\n" +
  "        try{ _scArmNativeMedia(); }catch(e){}\n" +
  "      }, 2000);\n" +
  "    })();\n" +
  "  }\n" +
  "\n" +
  "  function updateMediaSession(t){\n",
  { key: 'let _scArmTries = 0;' });

/* ============================================================================
   4. THE CONTROLS ARE RE-ASSERTED ON THE WAY OUT, NOT ONLY ON THE WAY IN
   --------------------------------------------------------------------------
   The system (and the native player) rebuilds the notification while the app is
   away. A session rebuilt without these handlers has no buttons at all, which is
   what a press on the widget or the lock screen then hits. The foreground return
   already re-armed them; leaving now does too.
   ========================================================================== */
sub(html, 'leaving the app re-asserts every media control, not only returning',
  "  document.addEventListener('visibilitychange', function(){\n" +
  "    if(document.hidden){\n" +
  "      if(mediaPausedInBackground()) armMediaRelease();\n" +
  "    } else {\n",
  "  document.addEventListener('visibilitychange', function(){\n" +
  "    if(document.hidden){\n" +
  "      // 72.5.1 - re-assert on the way OUT as well as the way back in. A session\n" +
  "      // the system rebuilds while the app is away comes back with whatever\n" +
  "      // buttons it was rebuilt with; without this a press on the home-screen\n" +
  "      // widget or the lock screen had nothing to land on.\n" +
  "      mediaHandlersNeedArm();\n" +
  "      try{ refreshMediaControls(); }catch(e){}\n" +
  "      if(mediaPausedInBackground()) armMediaRelease();\n" +
  "    } else {\n",
  { key: 're-assert on the way OUT as well as the way back in' });

sub(html, 'the while-playing heartbeat puts the controls back if they were lost while away',
  "      const bgDead = !userPaused && !playbackSurvivedBackground();\n" +
  "      if(bgDead) mediaSetPlaybackState('paused');\n" +
  "      if(!capMediaSession && !('mediaSession' in navigator)) return;\n",
  "      const bgDead = !userPaused && !playbackSurvivedBackground();\n" +
  "      if(bgDead) mediaSetPlaybackState('paused');\n" +
  "      // 72.5.1 - while a song plays this heartbeat is the one thing still\n" +
  "      // running, so it is what puts the controls back if the session was\n" +
  "      // rebuilt with none while the app was away.\n" +
  "      if(mediaHandlersDirty){ try{ refreshMediaControls(); }catch(e){} }\n" +
  "      if(!capMediaSession && !('mediaSession' in navigator)) return;\n",
  { key: 'so it is what puts the controls back' });

/* ============================================================================
   5. THE WIDGET'S PRESS GOES TO SIDECUT'S OWN SESSION
   --------------------------------------------------------------------------
   Native Java injected by the Android build; the web layer cannot touch it.
   Anchored here so the whole release is one script and one record.
   ========================================================================== */
const WIDGET = path.join(ROOT, '.github', 'workflows', 'patch-widget.py');
if (fs.existsSync(WIDGET)) {
  const py = holder(fs.readFileSync(WIDGET, 'utf8'));
  sub(py, "the widget transport buttons are handed to SideCut's own media session",
    '        int code = 0;\n' +
    '        if (action.endsWith("_prev")) code = KeyEvent.KEYCODE_MEDIA_PREVIOUS;\n' +
    '        else if (action.endsWith("_next")) code = KeyEvent.KEYCODE_MEDIA_NEXT;\n' +
    '        else if (action.endsWith("_playpause")) code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;\n' +
    '        if (code != 0) {\n' +
    '            try {\n' +
    '                AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);\n' +
    '                if (am != null) {\n' +
    '                    am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));\n' +
    '                    am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));\n' +
    '                }\n' +
    '            } catch (Exception ignored) {\n' +
    '            }\n' +
    '        }\n',
    '        int code = 0;\n' +
    '        if (action.endsWith("_prev")) code = KeyEvent.KEYCODE_MEDIA_PREVIOUS;\n' +
    '        else if (action.endsWith("_next")) code = KeyEvent.KEYCODE_MEDIA_NEXT;\n' +
    '        else if (action.endsWith("_playpause")) code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;\n' +
    '        if (code != 0) {\n' +
    '            // 72.5.1 - HAND THE PRESS TO SIDECUT\'S OWN PLAYER FIRST.\n' +
    '            //\n' +
    '            // A media key was broadcast system-wide, and Android delivers a\n' +
    '            // media key to whichever player it currently considers active.\n' +
    '            // While SideCut is in the foreground that is SideCut; in the\n' +
    '            // background it is frequently another app, or nothing at all,\n' +
    '            // which is why play, pause, next and previous all did nothing\n' +
    '            // while a song was audibly still playing. Sending the key straight\n' +
    '            // to the service that owns SideCut\'s media session removes that\n' +
    '            // guess entirely.\n' +
    '            boolean sent = false;\n' +
    '            try {\n' +
    '                Intent mb = new Intent(Intent.ACTION_MEDIA_BUTTON);\n' +
    '                mb.setClassName(context.getPackageName(),\n' +
    '                        "io.github.jofr.capacitor.mediasessionplugin.MediaSessionService");\n' +
    '                mb.putExtra(Intent.EXTRA_KEY_EVENT, new KeyEvent(KeyEvent.ACTION_DOWN, code));\n' +
    '                context.startService(mb);\n' +
    '                sent = true;\n' +
    '            } catch (Exception ignored) {\n' +
    '                sent = false;\n' +
    '            }\n' +
    '            boolean music = false;\n' +
    '            try {\n' +
    '                AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);\n' +
    '                if (am != null) music = am.isMusicActive();\n' +
    '            } catch (Exception ignored) {\n' +
    '            }\n' +
    '            if (!sent) {\n' +
    '                // No session of ours to hand it to: fall back to the\n' +
    '                // system-wide key, exactly as every earlier build did.\n' +
    '                try {\n' +
    '                    AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);\n' +
    '                    if (am != null) {\n' +
    '                        am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));\n' +
    '                        am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));\n' +
    '                    }\n' +
    '                } catch (Exception ignored) {\n' +
    '                }\n' +
    '            }\n' +
    '            if (!sent && !music) {\n' +
    '                // Nothing is playing and there is no session of ours to move:\n' +
    '                // open the app rather than leaving the press unanswered.\n' +
    '                try {\n' +
    '                    Intent open = context.getPackageManager()\n' +
    '                            .getLaunchIntentForPackage(context.getPackageName());\n' +
    '                    if (open != null) {\n' +
    '                        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);\n' +
    '                        context.startActivity(open);\n' +
    '                    }\n' +
    '                } catch (Exception ignored) {\n' +
    '                }\n' +
    '            }\n' +
    '        }\n',
    { key: 'HAND THE PRESS TO SIDECUT' });

  if (!CHECK && py.text !== fs.readFileSync(WIDGET, 'utf8')) fs.writeFileSync(WIDGET, py.text);
} else {
  problems.push('anchor missing (patch-widget.py not found)');
}

/* ============================================================================
   6. LEAVING ALBUMS CAN CLOSE EVERYTHING BUT THE PLAYING ALBUM
   --------------------------------------------------------------------------
   An OPTIONAL switch, off by default, in Settings > More and in Manage albums.
   With it on, leaving the Albums tab collapses every album card except the one
   the playing song is in (and a song that is in no album leaves them all shut).
   While you are ON the tab nothing is touched, so you can still keep as many
   albums open as you like. Turning it OFF restores the old behaviour exactly.
   ========================================================================== */
const ALBUM_HELPERS = [
  '  // ---- 72.5.1: leaving Albums can close everything but the playing album -----',
  '  // An OPTIONAL switch (off by default, in Settings > More and in Manage albums).',
  '  // With it on, leaving the Albums tab collapses every album card except the one',
  '  // the playing song is in; a song that is in no album leaves them all shut.',
  '  // While you are ON the tab nothing is touched - you can keep as many albums',
  '  // open as you like, which is exactly how the list has always worked.',
  '  function scAlbumFocusOn(){',
  "    try{ return localStorage.getItem('sidecut_albumFocusPlaying') === '1'; }catch(e){ return false; }",
  '  }',
  '  // The album the playing song is in, or null. It never CREATES an album: a song',
  '  // whose tag names no album you have simply has no album to keep open.',
  '  function scAlbumForPlayingTrack(){',
  '    try{',
  '      var tid = null;',
  '      try{',
  "        var djOpen = $('djModeBackdrop') && $('djModeBackdrop').style.display === 'flex';",
  "        if(djOpen && typeof djCurrentTrackId !== 'undefined' && djCurrentTrackId) tid = djCurrentTrackId;",
  '      }catch(_eDj){}',
  '      if(!tid && queueIndex >= 0 && queueIndex < queue.length) tid = queue[queueIndex];',
  '      if(!tid) return null;',
  '      var t = allTracks.find(function(tr){ return tr.id === tid; });',
  '      if(!t) return null;',
  '      var found = null;',
  '      Object.keys(userAlbums || {}).some(function(n){',
  '        var e = userAlbums[n];',
  '        if(!e || !Array.isArray(e.trackIds)) return false;',
  "        if(typeof albumIsAuto === 'function' && albumIsAuto(n)) return false;",
  "        if(e.trackIds.indexOf(t.id) !== -1){ found = n; return true; }",
  '        return false;',
  '      });',
  '      if(found) return found;',
  "      var tag = String(t.album || '').trim();",
  "      if(tag && userAlbums && userAlbums[tag]) return tag;",
  '      return null;',
  '    }catch(e){ return null; }',
  '  }',
  '  // Called on the way OUT of the Albums tab. It PERSISTS the collapse state as',
  '  // well as painting it, because the cards are rebuilt from that state on the',
  '  // next render - so what you see when you come back is what was decided here.',
  '  function scAlbumsRememberOnLeave(){',
  '    try{',
  '      if(!scAlbumFocusOn()) return 0;                          // off by default',
  "      if(typeof libraryMode === 'undefined' || libraryMode !== 'albums') return 0;",
  "      var pane = document.getElementById('listPane');",
  '      if(!pane) return 0;',
  '      var cards = pane.querySelectorAll(\'[data-album-name]\');',
  '      if(!cards || !cards.length) return 0;                    // the Albums list is not on screen',
  '      var keepName = scAlbumForPlayingTrack();',
  '      var closed = 0;',
  '      Array.prototype.forEach.call(cards, function(card){',
  '        var nm = card.dataset ? card.dataset.albumName : \'\';',
  '        var open = !!(keepName && nm === keepName);',
  '        if(!open) closed++;',
  "        try{ localStorage.setItem('sidecut_albColl_' + nm, open ? '0' : '1'); }catch(_eSt){}",
  '        var body = card.querySelector(\'[id^="alb_card_"]\');',
  "        if(body) body.style.display = open ? 'block' : 'none';",
  '        var hdr = card.firstElementChild;',
  '        var chev = hdr ? hdr.querySelector(\'span\') : null;',
  '        if(chev) chev.style.transform = open ? \'rotate(90deg)\' : \'\';',
  '      });',
  '      return closed;',
  '    }catch(e){ return 0; }',
  '  }',
  '  function scSyncAlbumFocusToggles(){',
  '    try{',
  '      var on = scAlbumFocusOn();',
  "      var label = on ? 'On \\u2713' : 'Off';",
  "      var s = document.getElementById('albumFocusPlayingToggle');",
  '      if(s) s.textContent = label;',
  "      var m = document.getElementById('mgrAlbumFocusPlayingToggle');",
  '      if(m) m.textContent = label;',
  '    }catch(e){}',
  '  }',
  '  function scSetAlbumFocus(on){',
  "    try{ localStorage.setItem('sidecut_albumFocusPlaying', on ? '1' : '0'); }catch(e){}",
  '    scSyncAlbumFocusToggles();',
  '  }',
  '  window.__scAlbumFocusOn = scAlbumFocusOn;',
  '  window.__scAlbumsRememberOnLeave = scAlbumsRememberOnLeave;',
  '',
  '  // Wire up the toggle button',
].join('\n') + '\n';

sub(html, 'the album-focus helpers sit with the other toggles',
  '  // Wire up the toggle button\n',
  ALBUM_HELPERS,
  { key: 'function scAlbumFocusOn(){' });

sub(html, 'the More tab carries the album switch',
  '          <button id="autoScrollToggle" style="padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Off</button>\n' +
  '        </div>\n',
  '          <button id="autoScrollToggle" style="padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Off</button>\n' +
  '        </div>\n' +
  '        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0 4px;">\n' +
  '          <div>\n' +
  '            <div style="font-size:13px; font-weight:600;">Keep the playing album open</div>\n' +
  '            <div style="font-size:11px; color:var(--ink-dim); margin-top:2px;">Leaving Albums closes every album except the one the playing song is in</div>\n' +
  '          </div>\n' +
  '          <button id="albumFocusPlayingToggle" style="padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Off</button>\n' +
  '        </div>\n',
  { key: 'id="albumFocusPlayingToggle"' });

sub(html, 'the switch is in the delegated click handler, and its label is synced on load',
  "    if(e.target.id === 'autoScrollToggle'){",
  "    if(e.target.id === 'albumFocusPlayingToggle'){\n" +
  "      scSetAlbumFocus(!scAlbumFocusOn());\n" +
  "    }\n" +
  "    if(e.target.id === 'autoScrollToggle'){",
  { key: "if(e.target.id === 'albumFocusPlayingToggle'){" });

sub(html, 'the More tab shows the switch state when it opens',
  '    if(tab === \'more\'){\n' +
  '      renderRefreshRateOptions();',
  '    if(tab === \'more\'){\n' +
  '      scSyncAlbumFocusToggles();\n' +
  '      renderRefreshRateOptions();',
  { key: 'scSyncAlbumFocusToggles();\n      renderRefreshRateOptions();' });

sub(html, 'the switch label is synced once at boot too',
  '  setTimeout(function(){\n' +
  '    applyLibraryButtonMode();\n' +
  "    var asBtn = document.getElementById('autoScrollToggle');",
  '  setTimeout(function(){\n' +
  '    applyLibraryButtonMode();\n' +
  '    scSyncAlbumFocusToggles();\n' +
  "    var asBtn = document.getElementById('autoScrollToggle');",
  { key: 'applyLibraryButtonMode();\n    scSyncAlbumFocusToggles();' });

sub(html, 'leaving the Albums view is where the switch applies',
  '  function navigate(view){\n' +
  '    if(view === "albums"){ libraryMode = "albums";',
  '  function navigate(view){\n' +
  '    // 72.5.1 - leaving the Albums tab with the switch on closes every album but\n' +
  '    // the one the playing song is in. Re-entering the library view (view\n' +
  '    // "library") is a redraw of whichever half is already showing, not a leave,\n' +
  '    // so it is excluded - as is navigate("albums") itself.\n' +
  '    if(view !== "albums" && view !== "library"){ try{ scAlbumsRememberOnLeave(); }catch(_eAf){ } }\n' +
  '    if(view === "albums"){ libraryMode = "albums";',
  { key: 'try{ scAlbumsRememberOnLeave(); }catch(_eAf){ }' });

sub(html, 'flipping the single library button away from Albums is leaving the tab too',
  "      libraryMode = libraryMode === 'playlists' ? 'albums' : 'playlists';\n" +
  "      if(typeof dbPut === 'function') dbPut('meta', { key: 'libraryMode', value: libraryMode });",
  "      // Flipping AWAY from Albums is leaving the tab, so the switch applies here\n" +
  "      // too (flipping TO Albums is not a leave).\n" +
  "      try{ if(libraryMode === 'albums') scAlbumsRememberOnLeave(); }catch(_eAf2){}\n" +
  "      libraryMode = libraryMode === 'playlists' ? 'albums' : 'playlists';\n" +
  "      if(typeof dbPut === 'function') dbPut('meta', { key: 'libraryMode', value: libraryMode });",
  { key: "if(libraryMode === 'albums') scAlbumsRememberOnLeave();" });

sub(html, 'Manage albums carries the same switch',
  "    html += '<div id=\"mgrAlbumCount\" style=\"display:none;font-size:11px;color:var(--ink-dim);padding:6px 2px 2px;\"></div>';\n",
  "    html += '<div id=\"mgrAlbumCount\" style=\"display:none;font-size:11px;color:var(--ink-dim);padding:6px 2px 2px;\"></div>';\n" +
  "    html += '<div style=\"display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 2px 2px;\">'\n" +
  "      + '<div style=\"min-width:0;\"><div style=\"font-size:12.5px;font-weight:600;\">Keep the playing album open</div>'\n" +
  "      + '<div style=\"font-size:11px;color:var(--ink-dim);margin-top:2px;line-height:1.5;\">Leaving Albums closes every album except the one the playing song is in.</div></div>'\n" +
  "      + '<button id=\"mgrAlbumFocusPlayingToggle\" style=\"flex-shrink:0;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;\">' + (scAlbumFocusOn() ? 'On \\u2713' : 'Off') + '</button>'\n" +
  "      + '</div>';\n",
  { key: 'id=\"mgrAlbumFocusPlayingToggle\"' });

sub(html, 'and the Manage albums switch is wired where its siblings are',
  '    if(sClr){\n' +
  '      sClr.addEventListener(\'click\', function(e){\n' +
  '        e.stopPropagation();\n' +
  "        if(sIn) sIn.value = '';\n" +
  "        _mgrAlbumQuery = '';\n" +
  "        applyAlbumFilter('');\n" +
  '        try{ if(sIn) sIn.focus(); }catch(_eF){}\n' +
  '      });\n' +
  '    }\n',
  '    if(sClr){\n' +
  '      sClr.addEventListener(\'click\', function(e){\n' +
  '        e.stopPropagation();\n' +
  "        if(sIn) sIn.value = '';\n" +
  "        _mgrAlbumQuery = '';\n" +
  "        applyAlbumFilter('');\n" +
  '        try{ if(sIn) sIn.focus(); }catch(_eF){}\n' +
  '      });\n' +
  '    }\n' +
  '    var _afToggle = bEl.querySelector(\'#mgrAlbumFocusPlayingToggle\');\n' +
  '    if(_afToggle && !_afToggle._afWired){\n' +
  '      _afToggle._afWired = true;\n' +
  "      _afToggle.addEventListener('click', function(e){\n" +
  '        e.stopPropagation();\n' +
  '        scSetAlbumFocus(!scAlbumFocusOn());\n' +
  '      });\n' +
  '    }\n',
  { key: "bEl.querySelector('#mgrAlbumFocusPlayingToggle')" });

// The Manage albums row went out with a doubled escape on the first pass (it drew
// the literal characters instead of a tick). Corrected here rather than by editing
// the sub above, so the fix lands on a tree that already carries the wrong text
// while a fresh run - which the corrected sub already emits - is untouched.
const BS = '\\';
sub(html, 'the Manage albums switch draws a real tick, not a stray escape',
  "(scAlbumFocusOn() ? 'On " + BS.repeat(2) + "u2713' : 'Off')",
  "(scAlbumFocusOn() ? 'On " + BS.repeat(1) + "u2713' : 'Off')",
  { key: "(scAlbumFocusOn() ? 'On " + BS.repeat(1) + "u2713' : 'Off')" });

/* ============================================================================
   7. THE OTA TAIL
   --------------------------------------------------------------------------
   ota-fixpoint.mjs iterates the bundle size against the manifest's own `size`
   field, and at THIS page's size it two-cycles between 872146 and 872147 - the
   fixed point is outside the cycle, so the loop burns all eight passes. The tail
   is the lever: after </html> one newline settles it on the first pass (probed
   across 0..15; 0 -> 872144, 1 -> 872146, 3 -> 872148 settle, 2 and 4 cycle).
   This is the same trick patch-725 used with two newlines.

   It is done with code rather than a `sub` because it is a REMOVAL, and - as
   72.5 learned - a key can only ever mean "the text I add is already here", so a
   removal cannot be keyed. Trimming to exactly one trailing newline is
   idempotent, so running this on a tree that is already correct changes nothing.
   ========================================================================== */
{
  const trimmed = html.text.replace(/\s*$/, '');
  const want = trimmed.endsWith('</html>') ? trimmed + '\n' : trimmed;
  if (html.text !== want) {
    if (process.env.SC_DEBUG) console.log('  normalising the OTA tail to one newline');
    html.text = want;
    applied++;
  } else {
    already++;
  }
}

if (problems.length) {
  console.error('patch-7251: ' + problems.join('\n             '));
  process.exit(1);
}

if (!CHECK) {
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-7251: ' + applied + ' applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
