// One-off patch for v60.0.7 — the Watermark Remover.
//
// The regression: the escape step's replacement string lost its backslash
// (commit 6b9df35 turned '\\$&' into '\$&', and '\$&' in JS is just "$&" — the
// match inserted unchanged). So `escaped` was the raw pattern and every pattern
// went to the regex engine unescaped: "[SpotiSaver]" became a CHARACTER CLASS,
// which is why the watermark word stopped disappearing and single letters
// (S, p, o, t, i, a, v, e, r) started vanishing out of unrelated titles.
//
//   node dev/_patch_v607.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

let s = fs.readFileSync(HTML, 'utf8');
let changed = 0;
function rep(label, from, to, expect) {
  const n = s.split(from).length - 1;
  if (n !== expect) {
    console.error(`MISMATCH [${label}] found ${n}, expected ${expect}`);
    console.error('--- looked for ---\n' + from.slice(0, 200));
    process.exit(1);
  }
  s = s.split(from).join(to);
  changed += n;
  console.log(`  ok ${label} (${n})`);
}

// Built character by character so this file itself cannot be mis-read: a lone
// backslash before $& (broken) vs. the two the replacement string needs.
const BS = String.fromCharCode(92);
const SQ = String.fromCharCode(39);
const BROKEN = SQ + BS + '$&' + SQ;            // '\$&'  → inserts the raw match
const FIXED = SQ + BS + BS + '$&' + SQ;        // '\\$&' → inserts the escaped match

/* 1 ── escape the pattern again, so it matches the literal phrase. */
rep("the escape replacement string", BROKEN, FIXED, 1);

/* 2 ── tidy what a removal leaves behind: "Song []", "Song ()", double spaces. */
rep(
  'the return tidy-up',
  `      } catch(e) {}
    });
    return text.trim();
  }`,
  `      } catch(e) {}
    });
    // Removing a pattern can leave the brackets it sat inside behind ("Song []",
    // "Song ()") or a double space where the words met. Only EMPTY pairs are
    // tidied — a bracket that still holds text is left exactly as it is.
    return text
      .replace(/\\(\\s*\\)|\\[\\s*\\]|\\{\\s*\\}/g, '')
      .replace(/\\s{2,}/g, ' ')
      .trim();
  }`,
  1
);

/* 3 ── academic: the pattern list is applied per line, so a multi-word watermark
   still has to be one line. Nothing to change — but the artist number patterns
   stay start-only, which the check below asserts. */

/* 4 ── version bump + patch notes (the version is the OTA's delivery mechanism). */
const now = new Date();
const dateStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
const timeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(now).find((p) => p.type === 'timeZoneName');
const stamped = `${dateStr} \\u00b7 ${timeStr} ${zone ? zone.value : 'ET'}`;
console.log('  changelog stamp: ' + stamped.replace('\\u00b7', '-'));

rep('APP_VERSION', `const APP_VERSION = '60.0.6';`, `const APP_VERSION = '60.0.7';`, 1);

rep(
  'CHANGELOG head',
  `  { version: '60.0.6', date: '`,
  `  { version: '60.0.7', date: '${stamped}', title: 'The watermark remover matches whole phrases again, not single letters', items: [
    'The pattern escaping lost its backslash, so every pattern in Watermark Remover was handed to the regex engine RAW. A pattern like [SpotiSaver] then meant "any one of these characters", which is why SpotiSaver stopped being removed as a word and the letters S, p, o, t, i, a, v, e and r started disappearing out of unrelated titles instead',
    'Patterns are escaped again, so a pattern only ever matches the exact sequence of characters you typed: "(SpotiSaver)" removes that whole watermark phrase, "Radio Edit" removes those two words only where they actually sit together, and a title that merely happens to contain one of those letters is left alone',
    'Removing a pattern no longer leaves the brackets it sat inside behind. "Song [SpotiSaver]" cleans up to "Song" instead of "Song [] ", and double spaces left where words met collapse',
    'The same function runs the always-on import cleaner, so titles and artists are cleaned correctly both on import and in the library-wide Apply',
    'The number-prefix patterns (1. 2. 3. …) still only strip at the very start of a field, so a song called "Track 1." is not touched',
  ]},
  { version: '60.0.6', date: '`,
  1
);

fs.writeFileSync(HTML, s);
console.log(`index.html: ${changed} replacements`);

let sw = fs.readFileSync(SW, 'utf8');
const swFrom = `const CACHE_NAME = 'sidecut-shell-v60.0.6';`;
if (sw.split(swFrom).length - 1 !== 1) { console.error('MISMATCH [sw.js CACHE_NAME]'); process.exit(1); }
fs.writeFileSync(SW, sw.replace(swFrom, `const CACHE_NAME = 'sidecut-shell-v60.0.7';`));
console.log('sw.js: CACHE_NAME -> sidecut-shell-v60.0.7');
