#!/usr/bin/env python3
"""83.2.2 - a file called current.mp3 is not necessarily audio.

83.2.1 fixed the writer, not the copy already on the phone: 83.2.0's base64 text still
sits in private files, and audioFile() only asks whether the file exists and is longer
than zero bytes, which garbage passes. The press still reached the native player,
which still refused it, so the fix could not be seen.

The header decides now. A copy that is not a container is deleted with its json, so the
same press falls through to the old hidden player, and the trail says so.

Settings -> Widget also stops hiding its breadcrumb box when it is empty.

Re-running is a no-op, and --check reports without writing.
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
JAVA = 'dev/native-play-service.java.txt'
VERSION = '83.2.2'
OLD = '83.2.1'
CHECK = '--check' in sys.argv

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()

if ("const APP_VERSION = '%s';" % VERSION) in s:
    print('%s is already on the page - nothing to do' % VERSION)
    sys.exit(0)

if CHECK:
    print('%s is NOT on the page - it needs applying' % VERSION)
    sys.exit(1)

changes = []


def sub(text, old, new, label, where=PAGE):
    n = text.count(old)
    if n != 1:
        sys.exit('%s: %s has %d matches (expected exactly 1)' % (where, label, n))
    out = text.replace(old, new, 1)
    changes.append(label)
    print('ok  ' + label)
    return out


# ---- the native side: the header decides -----------------------------------------
java = io.open(JAVA, encoding='utf-8').read()

AUDIO_OLD = '''            File f = new File(new File(c.getFilesDir(), "np"), name);
            if (!f.exists() || f.length() <= 0) return null;
            return f;'''

AUDIO_NEW = '''            File dir = new File(c.getFilesDir(), "np");
            File f = new File(dir, name);
            if (!f.exists() || f.length() <= 0) return null;
            // 83.2.2 - A FILE NAMED current.mp3 IS NOT NECESSARILY AUDIO.
            // 83.2.0's base64 text still passes exists() and length(), so a press kept
            // starting this service on garbage. The header decides, not the name.
            if (!sniff(f)) {
                note(c, "native -> the copy on disk is not audio, throwing it away");
                try { f.delete(); } catch (Exception ignored) {}
                try { new File(dir, "current.json").delete(); } catch (Exception ignored) {}
                return null;
            }
            return f;'''

SNIFF = '''
    /** 83.2.2 - do the first bytes look like something MediaPlayer can open? */
    private static boolean sniff(File f) {
        byte[] h = new byte[12];
        int n = 0;
        FileInputStream in = null;
        try {
            in = new FileInputStream(f);
            int r;
            while (n < h.length && (r = in.read(h, n, h.length - n)) > 0) n += r;
        } catch (Exception e) {
            return false;
        } finally {
            try { if (in != null) in.close(); } catch (Exception ignored) {}
        }
        if (n < 4) return false;
        String s = new String(h, 0, n);
        if (s.startsWith("ID3")) return true;              // mp3 with a tag
        if (s.startsWith("fLaC")) return true;             // flac
        if (s.startsWith("OggS")) return true;             // ogg / opus in ogg
        if (s.startsWith("RIFF")) return true;             // wav
        if (s.startsWith("FORM")) return true;             // aiff
        if (s.startsWith("#!AMR")) return true;            // amr
        if (s.startsWith("MThd")) return true;             // midi
        if (n >= 8 && s.substring(4, 8).equals("ftyp")) return true;   // m4a / mp4 / aac
        int b0 = h[0] & 0xFF;
        int b1 = h[1] & 0xFF;
        if (b0 == 0xFF && (b1 & 0xE0) == 0xE0) return true;   // bare mp3 frame
        return false;
    }

    private static String readAll(File f) throws Exception {'''

if 'private static boolean sniff(File f)' in java:
    print('ok  the header check is already in the service (nothing to do there)')
else:
    java = sub(java, AUDIO_OLD, AUDIO_NEW, 'the copy is checked for a real audio header', JAVA)
    java = sub(java, '''
    private static String readAll(File f) throws Exception {''', SNIFF,
               'the header check itself', JAVA)

# ---- the page: say so when the trail is merely empty ------------------------------
DIAG_OLD = '''      if(!txt){ el.style.display = 'none'; el.textContent = ''; return; }'''

DIAG_NEW = '''      if(!txt){
        // 83.2.2 - an empty trail is also an answer; hiding made "no press yet"
        // look like "no such thing".
        if(on){
          el.style.display = 'block';
          el.textContent = 'Last widget press - switch on' + String.fromCharCode(10)
            + 'Nothing recorded yet. Press the widget once, then open this tab again.';
          return;
        }
        el.style.display = 'none'; el.textContent = ''; return;
      }'''

s = sub(s, DIAG_OLD, DIAG_NEW, 'an empty trail says it is empty')

REFRESH_OLD = '''        wt.addEventListener('click', function(){ setTimeout(ghostDiagRefresh, 200); });
      }
    }catch(_eGhostDiagTab){}'''

REFRESH_NEW = '''        wt.addEventListener('click', function(){ setTimeout(ghostDiagRefresh, 200); });
      }
      // 83.2.2 - read the trail whenever the pane is rendered, not only on the tab click.
      setTimeout(ghostDiagRefresh, 250);
    }catch(_eGhostDiagTab){}'''

s = sub(s, REFRESH_OLD, REFRESH_NEW, 'the trail is read whenever the pane opens')

s = sub(s, "  const APP_VERSION = '%s';" % OLD, "  const APP_VERSION = '%s';" % VERSION,
        'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)

ENTRY = """  { version: '83.2.2', date: 'November 7, 2026 · 11:40 AM EST', title: 'A bad copy can no longer swallow the press', items: [
    'The press with the app swiped away plays again. The broken copy of the song from 83.2.0 was still on the phone and the player trusted the file name instead of the file, so it kept starting on that copy and stopping.',
    'The player now reads the first bytes before it trusts a copy. Anything that is not real audio is thrown away and the same press falls through to the older hidden player.',
    'Settings - Widget no longer hides its breadcrumb box when it has nothing to report: with the switch on it says nothing has been recorded yet.',
    'The copy itself is still written as real bytes, as in 83.2.1, and still checked against the song before it is used.'
  ]},
"""

ANCHOR_OLD = "  { version: '%s', date:" % OLD
s = sub(s, ANCHOR_OLD, ENTRY + ANCHOR_OLD, 'the changelog entry')

io.open(JAVA, 'w', encoding='utf-8').write(java)
io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes), %s and %s' % (PAGE, len(s), len(changes), SW, JAVA))
