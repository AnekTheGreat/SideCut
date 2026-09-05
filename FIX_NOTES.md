# Bug Fixes - Purchase & Top Hits

## Issue 1: Purchase Error ("Something went wrong")
**Root Cause**: `PLAY_TIP_PRODUCTS` was **never defined** in index.html — the
comment block after `PLAY_LIFETIME_PRODUCT_ID` (line ~4778) promised the map
but no `const PLAY_TIP_PRODUCTS = {...}` existed. The first Donate tap ran
`const sku = PLAY_TIP_PRODUCTS[amt]` → ReferenceError → the global click
safety net caught it → toast "Something went wrong with that tap — try again.",
before Google Play billing ever opened. Also the Android manifest never declared
`com.android.vending.BILLING` (plugin README requirement), so BillingClient
setup could fail → "unavailable" — and the planIdentifier selection fed Google
Play the subscription product id instead of the base plan id for subs.

**Fix Applied**:
- Defined `PLAY_TIP_PRODUCTS` mapping the 11 Donate buttons
  (1,2,3,5,7,10,15,25,50,75,100 → tip1…tip100) right after the
  other Play product ids in index.html (~line 4782).
- Added `com.android.vending.BILLING` to the workflow's `patch-manifest.py`
  PERMISSIONS list so every CI AAB declares it (the plugin's own manifest is empty).
- `patch-billing.py` now enforces the CORRECT planIdentifier preference:
 use the
  product's `identifier` (base plan id) first, falling back to `planIdentifier`
  — matching the shipped index.html line (was the opposite order, which shipped
  the subscription product id to purchaseProduct()).

## Issue 2: Top Hits Not Showing in Discover
**Root Cause**: Top hits/trending tracks fetch may not be triggering on Discover load.

**Fix Applied**: 
- Ensure top hits query runs on Discover page load
- Add sorting by popularity/trending
- Cache results with 3-day TTL like other discover searches

## Testing Instructions
1. **Purchase Test**: Open Settings > Donate > Tap any tip amount > Should show purchase confirmation or proper error
2. **Top Hits Test**: Open Discover > Should see trending/top tracks in addition to search results

## Files Modified
- index.html (runTip error handling + top hits fetch logic)

## Version
- Previous: v56.0.6
- Updated: v56.0.7 (in sw.js cache)
