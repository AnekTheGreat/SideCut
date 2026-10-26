#!/usr/bin/env python3
"""
Print — and optionally enforce — the numbers declared inside an .aab: the SDK
levels, and the version code Play will be shown.

WHY THIS EXISTS. Play rejects an upload on the numbers in the BUNDLE's manifest,
not on anything Gradle prints, and the bundle is the one artifact nobody could
inspect from the build log: `aapt2 dump badging` reads an APK (binary XML), while
an AAB stores `base/manifest/AndroidManifest.xml` as aapt2's protobuf form. So
the three rejections that actually happened — an AAB below target SDK 36,
SideCut-5.0.53-release.aab below minSdk 24 ("Play automatic protection requires
a minimum SDK version of 24 or higher"), and 5.0.54 with "Version code 511722 has
already been used" (and 5.0.55 with 512000) — were all invisible until the console
said no.

The protobuf makes this readable without a protobuf library: `XmlElement` holds a
repeated `XmlAttribute`, and an attribute is `name` (field 2, a string) followed
by `value` (field 3, a length-delimited string, tag byte 0x1a). So the value of
`minSdkVersion` is the byte string right behind the name — which is exactly how
this reads it, and which the shipped 5.0.53 bundle (minSdk 23, target 36), the
rebuilt one after the fix (24/36) and the 5.0.54 bundle (versionCode 511722) all
confirm.

The version code is only checked when one is given with `--version-code`, which is
what android-build.yml does: it passes the number the build was given
(`patch-version.py --print-code`). There is no pin in package.json to compare
against any more - a hand-bumped pin is how 512000 got spent twice, on the bundle
uploaded on 25 October and on the one rebuilt after 80.3 ("Version code 512000 has
already been used. Try another version code."). Inspecting an older bundle needs
no number at all.

  python3 dev/aab-sdk.py SideCut-5.0.54-release.aab
  python3 dev/aab-sdk.py app-release.aab --min 24 --target 36
"""
import argparse
import re
import sys
import zipfile

MANIFEST = 'base/manifest/AndroidManifest.xml'


def declared_value(raw, name):
    """The string stored under attribute `name` in the bundle's protobuf manifest, or None."""
    pattern = re.compile(name.encode('ascii') + rb'\x1a(.)', re.S)
    match = pattern.search(raw)
    if not match:
        return None
    length = match.group(1)[0]
    return raw[match.end():match.end() + length].decode('ascii', 'replace')


def sdk_value(raw, name):
    """The declared SDK level of `name`, or None when it is missing or not a small number."""
    value = declared_value(raw, name)
    return value if value and re.fullmatch(r'\d{1,3}', value) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('aab')
    ap.add_argument('--min', type=int, default=None, help='fail below this minSdkVersion')
    ap.add_argument('--target', type=int, default=None, help='fail below this targetSdkVersion')
    ap.add_argument('--version-code', type=int, default=None,
                    help='fail unless the bundle declares exactly this versionCode '
                         '(android-build.yml passes the one the build was given)')
    args = ap.parse_args()
    want_code = args.version_code

    try:
        raw = zipfile.ZipFile(args.aab).read(MANIFEST)
    except KeyError:
        sys.exit('::error::%s has no %s - not a valid AAB' % (args.aab, MANIFEST))
    except OSError as exc:
        sys.exit('::error::cannot read %s (%s)' % (args.aab, exc))

    declared = {'minSdkVersion': sdk_value(raw, 'minSdkVersion'),
                'targetSdkVersion': sdk_value(raw, 'targetSdkVersion'),
                'versionCode': declared_value(raw, 'versionCode')}
    print('%s: %s' % (args.aab, ' '.join('%s=%s' % (k, v or 'none') for k, v in declared.items())))

    failed = False
    for floor, name in ((args.min, 'minSdkVersion'), (args.target, 'targetSdkVersion')):
        if floor is None:
            continue
        value = declared[name]
        if value is None or int(value) < floor:
            print('::error::%s declares %s %s - Play needs %d or higher'
                  % (args.aab, name, value or 'nothing', floor))
            failed = True
    if want_code is not None:
        value = declared['versionCode']
        # Not just "different": the whole point is that Play has never been given
        # this number before, so the bundle has to carry exactly the one this build
        # was given. A mismatch means the gradle patch did not take, and uploading it
        # would spend a version code on an artifact nobody chose - or, worse, re-spend
        # one Play has already taken.
        if value is None or not value.isdigit() or int(value) != want_code:
            print('::error::%s declares versionCode %s - this build was given %d'
                  % (args.aab, value or 'nothing', want_code))
            failed = True
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
