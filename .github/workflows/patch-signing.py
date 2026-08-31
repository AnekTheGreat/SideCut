#!/usr/bin/env python3
"""
Rewrite the signing setup to use the developer's REAL upload keystore.

The keystore arrives base64-encoded in the ANDROID_KEYSTORE_BASE64 env var
(set as a GitHub Actions repo secret); its passwords/alias come from the
ANDROID_KEYSTORE_* env vars. We decode/write it to android/keystore.properties
and inject the release signingConfig into build.gradle (idempotent).
"""
import base64, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ANDROID_APP = os.path.join(ROOT, 'android', 'app')
BUILD_GRADLE = os.path.join(ANDROID_APP, 'build.gradle')
KEYSTORE = os.path.join(ROOT, 'sidecut-upload.jks')

# -------- Read credentials from env (set as GitHub repo secrets) --------
# Values are .strip()ed defensively: entering a secret on a phone can leave a
# stray trailing space/newline (autocorrect or copy-paste) that otherwise makes
# Gradle reject a perfectly correct password "keystore password was incorrect".
# Keystore/key passwords almost never contain meaningful leading/trailing
# whitespace, so stripping is safe and only guards against the paste bug.
KS_B64 = os.environ.get('ANDROID_KEYSTORE_BASE64', '').strip()
STORE_PASS = os.environ.get('ANDROID_KEYSTORE_PASSWORD', '').strip()
KEY_PASS = os.environ.get('ANDROID_KEY_PASSWORD', '').strip()
ALIAS = os.environ.get('ANDROID_KEY_ALIAS', '').strip()


def write_keystore_from_secret():
    if not KS_B64:
        sys.exit('FATAL: ANDROID_KEYSTORE_BASE64 secret is not set. '
                 'Add it to repo Settings -> Secrets and variables -> Actions.')
    try:
        data = base64.b64decode(KS_B64)
    except Exception as e:
        sys.exit('FATAL: could not base64-decode ANDROID_KEYSTORE_BASE64: %s' % e)
    if not STORE_PASS or not KEY_PASS or not ALIAS:
        sys.exit('FATAL: ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_PASSWORD / '
                 'ANDROID_KEY_ALIAS secrets must all be set.')
    with open(KEYSTORE, 'wb') as f:
        f.write(data)
    print('wrote keystore (%d bytes) from secret' % len(data))


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
    write_keystore_from_secret()
    inject()
    write_keystore_properties()
    print('signing setup complete (using developer keystore)')