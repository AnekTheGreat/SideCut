#!/usr/bin/env python3
"""
Replace the Capacitor default launcher icons with the real SideCut branding.

The android/ project is regenerated from the Capacitor template on every CI
build, and the template ships Capacitor's stock blue logo on a white tile —
not SideCut's mark — so every build installs with a generic "weird" icon in
the launcher and App info screen.

This script copies the repo-root icon-512.png (the same art the PWA/manifest
ships) over every generated launcher icon:

  * legacy ic_launcher / ic_launcher_round bitmaps (copied as-is, Android
    scales them per density)
  * the adaptive-foreground ic_launcher_foreground (scaled to ~85% and
    centered on a transparent canvas so the mark stays inside the adaptive
    icon's ~66dp safe zone and isn't clipped by the mask)

The adaptive background stays the template's #FFFFFF.
"""
import os
import struct
import sys
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
ICON = os.path.join(ROOT, 'icon-512.png')

if not os.path.exists(ICON):
    sys.exit('FATAL: %s missing' % ICON)
if not os.path.isdir(RES):
    sys.exit('FATAL: %s missing - run `npx cap add android` first.' % RES)


def read_png_rgba(path):
    """Decode an RGBA PNG into (w, h, rows). Rows are lists of (r,g,b,a)."""
    data = open(path, 'rb').read()
    w, h = struct.unpack('>II', data[16:24])

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        if pa <= pb and pa <= pc:
            return a
        return b if pb <= pc else c

    idat = b''
    i = 8
    while i < len(data):
        ln = struct.unpack('>I', data[i:i + 4])[0]
        typ = data[i + 4:i + 8]
        if typ == b'IDAT':
            idat += data[i + 8:i + 8 + ln]
        i += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * 4
    rows = []
    prev = [0] * stride
    pos = 0
    for _y in range(h):
        filt = raw[pos]
        pos += 1
        out = [0] * stride
        for x in range(stride):
            a = out[x - 4] if x >= 4 else 0
            b = prev[x]
            c = prev[x - 4] if x >= 4 else 0
            v = raw[pos]
            pos += 1
            if filt == 1:
                v = (v + a) & 255
            elif filt == 2:
                v = (v + b) & 255
            elif filt == 3:
                v = (v + ((a + b) >> 1)) & 255
            elif filt == 4:
                v = (v + paeth(a, b, c)) & 255
            out[x] = v
        rows.append([(out[x], out[x + 1], out[x + 2], out[x + 3])
                     for x in range(0, stride, 4)])
        prev = out
    return w, h, rows


def scale_nearest(w, h, rows, scale):
    """Nearest-neighbour scale to scale*w x scale*h (returns rows)."""
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    out = []
    for y in range(nh):
        sy = min(h - 1, int(y / scale))
        src = rows[sy]
        out.append([src[min(w - 1, int(x / scale))] for x in range(nw)])
    return out


def write_png_rgba(path, w, h, rows):
    """Encode RGBA rows into a PNG (filter 0 scanlines, lossless)."""
    out = b'\x89PNG\r\n\x1a\n'
    out += struct.pack('>I', 13) + b'IHDR' + struct.pack(
        '>IIBBBBB', w, h, 8, 6, 0, 0, 0) + struct.pack('>I', zlib.crc32(b'IHDR' + struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
    scan = bytearray()
    for row in rows:
        scan.append(0)
        for r, g, b, a in row:
            scan += bytes((r, g, b, a))
    comp = zlib.compress(bytes(scan), 9)
    out += struct.pack('>I', len(comp)) + b'IDAT' + comp + struct.pack('>I', zlib.crc32(b'IDAT' + comp))
    out += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', zlib.crc32(b'IEND'))
    open(path, 'wb').write(out)


w, h, icon_rows = read_png_rgba(ICON)
if (w, h) != (512, 512):
    sys.exit('FATAL: expected icon-512.png to be 512x512, got %dx%d' % (w, h))

# Adaptive foreground: 85% scale, centered on a transparent 512x512 canvas so
# the mark stays inside the ~66dp safe zone of the adaptive icon.
fg_scale = 0.85
fg_w = max(1, int(round(512 * fg_scale)))
fg_rows = scale_nearest(w, h, icon_rows, fg_scale)
pad = (512 - fg_w) // 2
canvas = [[(0, 0, 0, 0)] * 512 for _ in range(512)]
for y in range(fg_w):
    for x in range(fg_w):
        canvas[pad + y][pad + x] = fg_rows[y][x]

count = 0
for entry in sorted(os.listdir(RES)):
    if not entry.startswith('mipmap-'):
        continue
    for name in ('ic_launcher.png', 'ic_launcher_round.png'):
        target = os.path.join(RES, entry, name)
        if os.path.isfile(target):
            write_png_rgba(target, w, h, icon_rows)
            count += 1
    fg = os.path.join(RES, entry, 'ic_launcher_foreground.png')
    if os.path.isfile(fg):
        write_png_rgba(fg, 512, 512, canvas)
        count += 1

if count == 0:
    sys.exit('FATAL: no launcher icons found under %s' % RES)
print('patched %d launcher icons with SideCut branding (icon-512.png)' % count)