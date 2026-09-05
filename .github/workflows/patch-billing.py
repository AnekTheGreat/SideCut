#!/usr/bin/env python3
"""Patch the staged SideCut web bundle for the native Play Billing bridge.

The app source is a very large single HTML file, so this build-time patch keeps
billing fixes isolated and avoids rewriting the whole source file in CI.
"""
from pathlib import Path

INDEX = Path("www/index.html")
if not INDEX.exists():
    raise SystemExit("FATAL: www/index.html is missing")

s = INDEX.read_text(encoding="utf-8")

# Native Purchases requires the Android subscription BASE PLAN id in
# planIdentifier. For @capgo/native-purchases 7.19.x, getProducts()
# returns { identifier: <base-plan-id>, planIdentifier: <subscription product/SKU> },
# so the correct planIdentifier to pass back into purchaseProduct() is the
# product's `identifier` (the base plan id). Falling back to `planIdentifier`
# would hand Google Play the subscription product id, which never matches an
# offer's base plan id, and causes the plugin to silently pick the first offer —
# wrong/confusing behavior. This patch enforces the correct preference order, and
# is a no-op on the shipped source (which already uses identifier-first). If a
# later edit flips it, CI re-fixes it before the AAB is built.
old = "const basePlan = isSub ? (products[0] && (products[0].planIdentifier || products[0].identifier)) : undefined;"
new = "const basePlan = isSub ? (products[0] && (products[0].identifier || products[0].planIdentifier)) : undefined;"
if old in s:
    s = s.replace(old, new, 1)
    print("Re-fixed Android subscription planIdentifier (base plan id, was flipped)")
elif new in s:
    print("Subscription planIdentifier already prefers base plan id (correct)")
else:
    raise SystemExit("FATAL: could not find the Play Billing base-plan line in www/index.html")

INDEX.write_text(s, encoding="utf-8")
