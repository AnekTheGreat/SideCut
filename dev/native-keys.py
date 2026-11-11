#!/usr/bin/env python3
"""83.4.0 - the app answers its own media keys.

The page's presses have always travelled through the media-session plugin. That
plugin's service advertises a transport action only when it holds a live
PluginCall for it, and it builds its PlaybackState actions from that same list -
so a player that is not armed publishes a session with no actions at all, and a
phone does not route a button to a session that says it can do nothing. That is
a press that reaches nobody, on any headset, which is exactly what the owner
reported while the in-app button kept working.

This writes SideCutKeys.java (dev/sidecut-keys.java.txt) beside MainActivity and
has MainActivity attach it in onCreate. A dev/ script, like native-play.py and
native-session.py, because a release can carry dev/ and cannot carry
.github/workflows/. Run by dev/native-play.py. Idempotent.
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, 'sidecut-keys.java.txt')
JAVA_ROOT = os.path.join('android', 'app', 'src', 'main', 'java')

ON_CREATE = (
    '\n'
    '    // 83.4.0 - THE APP ANSWERS ITS OWN MEDIA KEYS. The plugins session\n'
    '    // only exists while its service is armed, and a session that declares\n'
    '    // no actions receives nothing: every press went nowhere on every\n'
    '    // headset. SideCutKeys owns a session of the apps own (see\n'
    '    // SideCutKeys.java and dev/keys-8340.js.txt for the page half).\n'
    '    @Override\n'
    '    public void onCreate(android.os.Bundle savedInstanceState) {\n'
    '        super.onCreate(savedInstanceState);\n'
    '        try { SideCutKeys.attach(this); } catch (Exception ignored) { }\n'
    '    }\n'
)


def find_main_activity():
    if not os.path.isdir(JAVA_ROOT):
        return None
    for base, _dirs, files in os.walk(JAVA_ROOT):
        if 'MainActivity.java' in files:
            return os.path.join(base, 'MainActivity.java')
    return None


def main():
    main_java = find_main_activity()
    if not main_java:
        print('native-keys: no MainActivity.java - run patch-widget.py first')
        return 1
    if not os.path.exists(SOURCE):
        print('native-keys: missing ' + SOURCE)
        return 1

    src = io.open(main_java, encoding='utf-8').read()
    package = ''
    for line in src.splitlines():
        if line.startswith('package ') and line.rstrip().endswith(';'):
            package = line[len('package '):].rstrip().rstrip(';').strip()
            break
    if not package:
        print('native-keys: MainActivity has no package line')
        return 1

    target = os.path.join(os.path.dirname(main_java), 'SideCutKeys.java')
    wanted = io.open(SOURCE, encoding='utf-8').read().replace('__PKG__', package)
    changed = []
    if not os.path.exists(target) or io.open(target, encoding='utf-8').read() != wanted:
        io.open(target, 'w', encoding='utf-8').write(wanted)
        changed.append('SideCutKeys.java')

    if 'SideCutKeys.attach' not in src:
        cut = src.rindex('}')
        out = src[:cut] + ON_CREATE + src[cut:]
        if out.count('SideCutKeys.attach(this)') != 1 or out.count('class MainActivity') != 1:
            print('native-keys: the result is not what was intended - nothing written')
            return 1
        io.open(main_java, 'w', encoding='utf-8').write(out)
        changed.append('MainActivity attaching it')

    if changed:
        print('native-keys: OK - ' + ', '.join(changed))
    else:
        print('native-keys: nothing to change (already applied)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
