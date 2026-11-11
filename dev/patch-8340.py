#!/usr/bin/env python3
"""SideCut 83.4.0 - the app answers the headphones itself.

83.3.0 woke the mixer, and the sound half of a press got its own door. The press
itself was still travelling through the media-session plugin, and that plugin's
service only advertises a transport action it holds a live PluginCall for - it
builds its PlaybackState actions from the same list. A player that is not armed
(bridge not ready, the opt-in switch off, the crash recorder having switched it
off once) therefore publishes a session that declares NO actions, and a phone
does not route a button to a session that says it can do nothing. That is a
press that reaches nobody, on any headset, while the in-app button still works
because it never leaves the page.

This release gives the app a session of its own: SideCutKeys.java, attached by
MainActivity.onCreate (dev/native-keys.py), always ACTIVE, always declaring
play, pause, play/pause, stop, next and previous, and handing every press to
window.__scNativeKey (dev/keys-8340.js.txt) inside the WebView that made the
sound. Nothing depends on the plugin being armed.

    python3 dev/patch-8340.py            # apply
    python3 dev/patch-8340.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
NATIVE_PLAY = os.path.join(ROOT, "dev", "native-play.py")
KEYS = os.path.join(ROOT, "dev", "keys-8340.js.txt")

V = "83.4.0"
OLD = "83.3.0"

ENTRY = """      { version: '%s', date: 'November 11, 2026', title: 'The app answers the headphones itself', items: [
    'A press from the earbuds now goes to a media session the app owns, not to one a plugin has to be armed for. The plugin only advertises a button it holds a live handler for, and a phone will not route a press to a player that says it can do nothing - which is why every headset failed at once.',
    'The app\\'s session is always listening and always offers play, pause, play/pause, stop, next and previous. A single press is decided by the page, which is the only thing that knows whether a song is running.',
    'Nothing here depends on the old notification player being switched on, so a press finds the app even after the phone has restarted it or the notification was turned off.'
  ] },
""" % V

ANCHOR = ("      { version: '%s', date: 'November 11, 2026', "
          "title: 'The headphones wake the sound again', items: [\n" % OLD)

KEYS_ANCHOR = "  function registerMediaSessionHandlers(){\n"

HOOK_OLD = """    except Exception as _e:
        print('native-play: the session half was skipped (%s)' % _e)
"""
HOOK_NEW = """    except Exception as _e:
        print('native-play: the session half was skipped (%s)' % _e)

    # 83.4.0 - the app's own media keys; see dev/native-keys.py.
    try:
        import importlib.util as _iu2
        _s2 = _iu2.spec_from_file_location('sc_nk', os.path.join(HERE, 'native-keys.py'))
        _m2 = _iu2.module_from_spec(_s2)
        _s2.loader.exec_module(_m2)
        _m2.main()
        changed.append('the app answering its own media keys')
    except Exception as _e2:
        print('native-play: the keys half was skipped (%s)' % _e2)
"""


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8340: %s appears %d times, expected exactly 1" % (what, n))
    return text


def keys_text():
    if not os.path.exists(KEYS):
        raise SystemExit("patch-8340: missing dev/keys-8340.js.txt")
    return io.open(KEYS, encoding="utf-8").read()


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and "__scNativeKey" in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the %s changelog entry" % OLD)
    once(page, KEYS_ANCHOR, "registerMediaSessionHandlers")
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(KEYS_ANCHOR, keys_text() + KEYS_ANCHOR, 1)
    return out


def patched_native(text):
    if "native-keys.py" in text:
        return text
    once(text, HOOK_OLD, "the session half of native-play.py")
    return text.replace(HOOK_OLD, HOOK_NEW, 1)


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    native = io.open(NATIVE_PLAY, encoding="utf-8").read()
    out = patched(page)
    native_out = patched_native(native)
    sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V)
    if out == page and sw_new == sw and native_out == native:
        print("already on the page")
        return 0
    if check:
        print("not applied yet")
        return 1
    once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    io.open(NATIVE_PLAY, "w", encoding="utf-8").write(native_out)
    print("page at %s, cache at sidecut-shell-v%s, native-play hooked" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
