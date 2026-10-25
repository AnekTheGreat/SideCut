#!/usr/bin/env python3
"""
Print — and optionally enforce — the SDK levels declared inside an .aab.

WHY THIS EXISTS. Play rejects an upload on the numbers in the BUNDLE's manifest,
not on anything Gradle prints, and the bundle is the one artifact nobody could
inspect from the build log: `aapt2 dump badging` reads an APK (binary XML), while
an AAB stores `base/manifest/AndroidManifest.xml` as aapt2's protobuf form. So the
two rejections that actually happened — an AAB below target SDK 36, and
SideCut-5.0.53-release.aab below minSdk 24 ("Play automatic protection requires a
minimum SDK version of 24 or higher") — were both invisible until the console
said no.

The protobuf makes this readable without a protobuf library: `XmlElement` holds a
repeated `XmlAttribute`, and an attribute is `name` (field 2, a string) followed
by `value` (field 3, a length-delimited string, tag byte 0x1a). So the value of
`minSdkVersion` is the byte string right behind the name — which is exactly how
this reads it, and which the shipped 5.0.53 bundle (minSdk 23, target 36) and the
rebuilt one after the fix (24/36) both confirm.

  python3 dev/aab-sdk.py SideCut-5.0.53-release.aab
  python3 dev/aab-sdk.py app-release.aab --min 24 --target 36
"""
import argparse
import re
import sys
import zipfile

MANIFEST = 'base/manifest/AndroidManifest.xml'


def sdk_value(raw, name):
    """The declared value of `name` in the bundle's protobuf manifest, or None."""
    pattern = re.compile(name.encode('ascii') + rb'\x1a(.)', re.S)
    match = pattern.search(raw)
    if not match:
        return None
    length = match.group(1)[0]
    value = raw[match.end():match.end() + length].decode('ascii', 'replace')
    return value if re.fullmatch(r'\d{1,3}', value) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('aab')
    ap.add_argument('--min', type=int, default=None, help='fail below this minSdkVersion')
    ap.add_argument('--target', type=int, default=None, help='fail below this targetSdkVersion')
    args = ap.parse_args()

    try:
        raw = zipfile.ZipFile(args.aab).read(MANIFEST)
    except KeyError:
        sys.exit('::error::%s has no %s - not a valid AAB' % (args.aab, MANIFEST))
    except OSError as exc:
        sys.exit('::error::cannot read %s (%s)' % (args.aab, exc))

    declared = {'minSdkVersion': sdk_value(raw, 'minSdkVersion'),
                'targetSdkVersion': sdk_value(raw, 'targetSdkVersion')}
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
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
