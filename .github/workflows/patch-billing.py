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
# planIdentifier. The previous code accidentally preferred Product.identifier
# (the subscription product/SKU) over Product.planIdentifier. That makes
# Google Play reject the purchase even though product lookup succeeds.
old = "const basePlan = isSub ? (products[0] && (products[0].identifier || products[0].planIdentifier)) : undefined;"
new = "const basePlan = isSub ? (products[0] && (products[0].planIdentifier || products[0].identifier)) : undefined;"
if old in s:
    s = s.replace(old, new, 1)
    print("Fixed Android subscription planIdentifier selection")
elif new in s:
    print("Subscription planIdentifier fix already present")
else:
    raise SystemExit("FATAL: could not find the Play Billing base-plan line in www/index.html")

INDEX.write_text(s, encoding="utf-8")
