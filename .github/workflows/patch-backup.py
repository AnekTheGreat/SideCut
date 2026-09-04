#!/usr/bin/env python3
"""
Enable Android Auto Backup so an uninstall -> reinstall (or a new phone)
restores SideCut's small user data from Google Drive.

WHY THIS SHAPE (and what it deliberately leaves out):
  - SideCut's library lives in WebView storage (localStorage + IndexedDB under
    app_webview/). Auto Backup's DEFAULT include set is shared prefs, the app's
    internal files dir (getFilesDir), SQLite databases, and getExternalFilesDir
    - NOT app_webview. And Auto Backup hard-fails above 25 MB per app, so the
    audio blobs inside IndexedDB can never ride along anyway (including
    app_webview would blow the quota and kill the WHOLE backup, including the
    small settings).
  - Therefore this only includes the small stuff: shared prefs (widget theme,
    plugin state), the internal files dir (which holds the app's automatic
    sidecut-snapshot.json mirror of settings/playlists/premium/pins), and
    SQLite databases. The web layer handles the actual data-loss recovery by
    restoring from that snapshot file when the WebView stores come up empty.

The android/ project is regenerated from the Capacitor template on every CI
build, so we patch android/app/src/main/AndroidManifest.xml after
`npx cap add android` and write the rules into res/xml/. Idempotent.
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', '..'))
MANIFEST = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
XML_DIR = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'xml')

BACKUP_RULES = """<?xml version="1.0" encoding="utf-8"?>
<!-- Android 11 (API 30) and lower: Auto Backup rules for SideCut.
     Include only the small durable data: shared prefs, the internal files dir
     (holds the sidecut-snapshot.json mirror), and SQLite databases. WebView
     storage (app_webview/) is deliberately excluded: the audio library there
     exceeds Auto Backup's 25 MB per-app cap and would fail the whole backup. -->
<full-backup-content>
    <include domain="sharedpref" path="." />
    <include domain="file" path="." />
    <include domain="database" path="." />
</full-backup-content>
"""

DATA_EXTRACTION_RULES = """<?xml version="1.0" encoding="utf-8"?>
<!-- Android 12 (API 31) and higher: Auto Backup rules for SideCut. -->
<data-extraction-rules>
    <cloud-backup>
        <include domain="sharedpref" path="." />
        <include domain="file" path="." />
        <include domain="database" path="." />
    </cloud-backup>
    <device-transfer>
        <include domain="sharedpref" path="." />
        <include domain="file" path="." />
        <include domain="database" path="." />
    </device-transfer>
</data-extraction-rules>
"""


def main():
    if not os.path.exists(MANIFEST):
        sys.exit('FATAL: %s missing - run `npx cap add android` first.' % MANIFEST)

    src = open(MANIFEST).read()

    # 1) android:allowBackup="true" (the Android default, but make it explicit).
    if 'android:allowBackup="true"' in src:
        print('allowBackup already true')
    elif 'android:allowBackup="false"' in src:
        src = src.replace('android:allowBackup="false"', 'android:allowBackup="true"', 1)
        print('flipped allowBackup false -> true')
    else:
        new_src, n = re.subn(
            r'<application\b',
            '<application android:allowBackup="true"',
            src, count=1)
        if n == 0:
            sys.exit('FATAL: <application> tag not found in %s' % MANIFEST)
        src = new_src
        print('inserted android:allowBackup="true"')

    # 2) Point at the rules files (only once).
    if 'android:fullBackupContent' not in src and 'android:dataExtractionRules' not in src:
        src = src.replace(
            'android:allowBackup="true"',
            'android:allowBackup="true"\n'
            '        android:fullBackupContent="@xml/backup_rules"\n'
            '        android:dataExtractionRules="@xml/data_extraction_rules"', 1)
        print('added fullBackupContent + dataExtractionRules')
    elif 'android:fullBackupContent' in src and 'android:dataExtractionRules' in src:
        print('backup rule attrs already present')
    else:
        print('WARNING: partial backup attrs present - leaving as-is')

    open(MANIFEST, 'w').write(src)

    os.makedirs(XML_DIR, exist_ok=True)
    with open(os.path.join(XML_DIR, 'backup_rules.xml'), 'w') as f:
        f.write(BACKUP_RULES)
    with open(os.path.join(XML_DIR, 'data_extraction_rules.xml'), 'w') as f:
        f.write(DATA_EXTRACTION_RULES)
    print('patch-backup: OK - wrote backup rules + manifest attrs')


if __name__ == '__main__':
    main()