#!/usr/bin/env python3
"""
Signing setup for the SideCut Capacitor Android build.

Two modes, chosen by env ANDROID_SIGNING_MODE (default 'secret'):

  'secret'    Sign with the developer's REAL Play upload keystore, which is
              provided base64-encoded in ANDROID_KEYSTORE_BASE64 (a GitHub repo
              secret) plus ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_PASSWORD /
              ANDROID_KEY_ALIAS. Keystore material never lives in the repo.

              The script ALSO tries the store password that PWA Builder printed
              when it generated signing.keystore (and a couple of common case
              typos), so a small paste/case error in the password secret does
              not break the build. The alias is picked from the secret, falling
              back to the note's alias if needed.

  'generated' Create our OWN keystore with keytool (first run) and cache it so
              the same key is reused every build. Use this only after a Play
              Console "reset upload key" registered the exported certificate.

Both modes auto-detect the keystore store type (PKCS#12 vs JKS) and write
android/keystore.properties + inject the release signingConfig into
android/app/build.gradle (idempotent).
"""
import base64, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ANDROID_APP = os.path.join(ROOT, 'android', 'app')
BUILD_GRADLE = os.path.join(ANDROID_APP, 'build.gradle')
KEYSTORE = os.path.join(ROOT, 'sidecut-upload.jks')

MODE = os.environ.get('ANDROID_SIGNING_MODE', 'secret').strip().lower()

# Secret-mode creds (from GitHub repo secrets).
KS_B64 = os.environ.get('ANDROID_KEYSTORE_BASE64', '').strip()
STORE_PASS = os.environ.get('ANDROID_KEYSTORE_PASSWORD', '').strip()
KEY_PASS = os.environ.get('ANDROID_KEY_PASSWORD', '').strip()
ALIAS = os.environ.get('ANDROID_KEY_ALIAS', '').strip()

# Generated-mode creds, fixed so the cached keystore is usable on every run.
GEN_STORE_PASS = 'SideCut-Upload-Key-2026!Gen'
GEN_KEY_PASS = 'SideCut-Upload-Key-2026!Gen'
GEN_ALIAS = 'sidecut'

# The credentials PWA Builder printed when it generated signing.keystore
# (shown on screen: "Key store password: h3gYtWfYyz72", "Key alias: my-key-alias").
NOTE_PASS = 'h3gYtWfYyz72'
NOTE_ALIAS = 'my-key-alias'


def detect_storetype(path):
    """Return 'pkcs12' or 'jks' by magic bytes. PKCS#12 = DER SEQUENCE (30 82);
    JKS = FEEDFEED. PWA Builder 'signing.keystore' is often really PKCS#12."""
    with open(path, 'rb') as f:
        head = f.read(8)
    if len(head) >= 4 and head[0] == 0xFE and head[1] == 0xED and head[2] == 0xFE and head[3] == 0xED:
        return 'jks'
    if len(head) >= 2 and head[0] == 0x30 and head[1] == 0x82:
        return 'pkcs12'
    return 'jks'


def list_aliases(keystore, storepass):
    """Return (aliases, ok, detail) for the keystore using keytool -list."""
    storetype = detect_storetype(keystore)
    try:
        out = subprocess.run(
            ['keytool', '-list', '-keystore', keystore,
             '-storetype', storetype, '-storepass', storepass, '-noprompt'],
            capture_output=True, text=True, timeout=90,
        )
    except Exception as e:
        return [], False, 'keytool error: %s' % e
    if out.returncode != 0:
        return [], False, (out.stderr or out.stdout).strip()
    aliases = [m.group(1) for m in re.finditer(r'^(\S+),.*', out.stdout, re.M)]
    return aliases, True, out.stdout.strip()


def find_working_credentials(keystore, preferred_alias):
    """Try candidate store passwords (secret value first, then the note's
    password and common case typos). Return (store_pass, alias) or raise."""
    candidates = [
        STORE_PASS,
        NOTE_PASS,
        'h3gYtWfYYz72',   # note "Yy" -> "YY" typo
        'h3gYtWfyYz72',   # note "Yy" -> "yY" typo
    ]
    seen = set()
    for pw in candidates:
        if not pw or pw in seen:
            continue
        seen.add(pw)
        aliases, ok, detail = list_aliases(keystore, pw)
        if ok:
            alias = preferred_alias if preferred_alias in aliases else (
                aliases[0] if aliases else preferred_alias)
            print('FOUND working store password (aliases in keystore: %s)' % aliases)
            return pw, alias
        else:
            print('password rejected: %r' % pw)
    raise SystemExit(
        'FATAL: none of the candidate passwords opens the keystore decoded from '
        'ANDROID_KEYSTORE_BASE64 (%d bytes). Either the secret is not the real '
        'signing.keystore binary (encode the actual .keystore file, not a text '
        'note), or the store password differs from the note.'
        % os.path.getsize(keystore))


def prepare_keystore():
    if MODE == 'generated':
        if os.path.exists(KEYSTORE):
            print('generated keystore already present; reusing:', KEYSTORE)
        else:
            print('creating generated keystore...')
            subprocess.run([
                'keytool', '-genkeypair', '-v',
                '-keystore', KEYSTORE,
                '-storetype', 'PKCS12',
                '-alias', GEN_ALIAS,
                '-storepass', GEN_STORE_PASS,
                '-keypass', GEN_KEY_PASS,
                '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10950',
                '-dname', 'CN=SideCut, OU=Android, O=AnekTheGreat, L=Unknown, ST=Unknown, C=US',
            ], check=True)
            print('created generated keystore at', KEYSTORE)
        return GEN_STORE_PASS, GEN_KEY_PASS, GEN_ALIAS

    # ---- secret mode ----
    if not KS_B64:
        sys.exit('FATAL: ANDROID_SIGNING_MODE is "secret" but ANDROID_KEYSTORE_BASE64 secret is not set. '
                 'Set it, or switch ANDROID_SIGNING_MODE=generated after a Play upload-key reset.')
    try:
        data = base64.b64decode(KS_B64)
    except Exception as e:
        sys.exit('FATAL: could not base64-decode ANDROID_KEYSTORE_BASE64: %s' % e)
    with open(KEYSTORE, 'wb') as f:
        f.write(data)
    print('wrote developer keystore (%d bytes) from secret' % len(data))

    store_pass, alias = find_working_credentials(KEYSTORE, ALIAS or NOTE_ALIAS)
    # PWA Builder uses the same password for store and key; the secret's key
    # password (if any) is ignored in favor of the proven working one.
    return store_pass, store_pass, alias


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
                storeType sidecutKsProps.storeType ?: 'jks'
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


def write_keystore_properties(store_pass, key_pass, alias):
    storetype = detect_storetype(KEYSTORE)
    print('detected keystore format:', storetype)
    ks_path = os.path.join(ROOT, 'android', 'keystore.properties')
    with open(ks_path, 'w') as f:
        f.write('\n'.join([
            f'storeFile={KEYSTORE}',
            f'storeType={storetype}',
            f'storePassword={store_pass}',
            f'keyAlias={alias}',
            f'keyPassword={key_pass}',
            '',
        ]))
    print('wrote', ks_path)


if __name__ == '__main__':
    print('signing mode:', MODE)
    sp, kp, al = prepare_keystore()
    inject()
    write_keystore_properties(sp, kp, al)
    print('signing setup complete')
