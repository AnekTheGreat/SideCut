# Bug Fixes - Purchase & Top Hits

## Issue 1: Purchase Error ("Something went wrong")
**Root Cause**: The `runTip()` function likely lacks error handling for failed Capacitor Billing calls.

**Fix Applied**: Add try-catch wrapper and fallback error messages
- Catch billing adapter errors
- Show user-friendly error messages
- Verify PLAY_TIP_PRODUCTS is loaded

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
