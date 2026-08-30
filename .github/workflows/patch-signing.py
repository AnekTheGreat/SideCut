#!/usr/bin/env python3
"""
Wire release signing into the Capacitor-generated Android project.

Idempotent: safe to run every build. Generates the upload keystore once (via
keytool) and NEVER overwrites it, so the signing key stays identical across
builds via the GitHub Actions cache — Google Play requires a stable upload
signature to accept updates.

If sidecut-upload.jks already exists (from a previous CI run restored from
cache), this script leaves it untouched and just points Gradle at it.
"""
import os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ANDROID_APP = os.path.join(ROOT, 'android', 'app')
BUILD_GRADLE = os.path.join(ANDROID_APP, 'build.gradle')
KEYSTORE = os.path.join(ROOT, 'sidecut-upload.jks')

ALIAS = 'sidecut'
STORE_PASS = 'SideCutUpload!2026'
KEY_PASS = 'SideCutUpload!2026'


def ensure_keystore():
    # Stability comes from the GitHub Actions cache (workflow restores
    # sidecut-upload.jks from cache when present). NEVER overwrite an existing
    # keystore, or Play would reject the changed signature and all future
    # uploads. We only generate when the file is genuinely absent.
    if os.path.exists(KEYSTORE):
        print('keystore already present:', KEYSTORE)
        return
    # Generate a keystore with keytool (JDK present on the runner).
    cmd = [
        'keytool', '-genkeypair', '-v',
        '-keystore', KEYSTORE,
        '-alias', ALIAS,
        '-storepass', STORE_PASS,
        '-keypass', KEY_PASS,
        '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10950',
        '-dname', 'CN=SideCut, OU=Android, O=AnekTheGreat, L=Unknown, ST=Unknown, C=US',
    ]
    print('generating keystore via:', ' '.join(cmd))
    subprocess.run(cmd, check=True)


def inject():
    if not os.path.exists(BUILD_GRADLE):
        sys.exit('FATAL: android/app/build.gradle missing — run `npx cap add android` first.')
    src = open(BUILD_GRADLE).read()
    marker = '// ---- SideCut release signing (injected by CI) ----'
    if marker in src:
        print('signing already injected; skipping')
        return
    injection = f'''

// ---- SideCut release signing (injected by CI) ----
def sidecutKs = rootProject.file("keystore.properties")
def sidecutKsProps = new Properties()
if (sidecutKs.exists()) {{
    sidecutKs.withInputStream {{ sidecutKsProps.load(it) }}
}}
android {{
    signingConfigs {{
        release {{
            if (sidecutKsProps.storeFile) {{
                storeFile file(sidecutKsProps.storeFile)
                storePassword sidecutKsProps.storePassword
                keyAlias sidecutKsProps.keyAlias
                keyPassword sidecutKsProps.keyPassword
            }}
        }}
    }}
    buildTypes {{
        release {{
            if (sidecutKsProps.storeFile) {{
                signingConfig signingConfigs.release
            }}
            minifyEnabled false
        }}
    }}
}}
{marker}
'''
    # Insert right after the closing brace of the outer `android { ... }` block,
    # i.e. before the final newline. Capacitor build.gradle ends the top-level
    # android {} block at the bottom of the file.
    if src.rstrip().endswith('}'):
        src = src.rstrip() + injection
    else:
        src = src + '\n' + injection
    open(BUILD_GRADLE, 'w').write(src)
    print('signing injected into', BUILD_GRADLE)


def write_keystore_properties():
    # Gradle reads it via rootProject.file(...) => lives in the android/ project.
    ks_path = os.path.join(ROOT, 'android', 'keystore.properties')
    with open(ks_path, 'w') as f:
        f.write('\n'.join([
            f'storeFile={KEYSTORE}',
            f'storePassword={STORE_PASS}',
            f'keyAlias={ALIAS}',
            f'keyPassword={KEY_PASS}',
            '',
        ]))
    print('wrote', ks_path)


if __name__ == '__main__':
    ensure_keystore()
    inject()
    write_keystore_properties()
    print('signing setup complete')