# -- 1. the release itself ----------------------------------------------------
once('the version moves',
     "  const APP_VERSION = '%s';" % OLD,
     "  const APP_VERSION = '%s';" % VERSION)

# -- 2. a credit is a list ----------------------------------------------------
once('a credit is read as a list of names',
     "    const primary = name.split(/\\s*[,;&]|\\s+feat\\.?\\s+|\\s+ft\\.?\\s+|\\s+vs\\.?\\s+|\\s+x\\s+/i)[0].trim();\n"
     "    return primary || name;\n"
     "  }\n",
     "    const primary = name.split(/\\s*[,;&]|\\s+feat\\.?\\s+|\\s+ft\\.?\\s+|\\s+vs\\.?\\s+|\\s+x\\s+/i)[0].trim();\n"
     "    return primary || name;\n"
     "  }\n"
     "  // 80.7 - A COLLAB IS A DROP, WHEREVER IT IS FILED. primaryArtistName\n"
     "  // answers \"whose name is printed first\", and that is the wrong question for a\n"
     "  // catalog result: a collaboration is filed under one artist and credited to\n"
     "  // both, so the pinned artist sitting second was filtered out before listing.\n"
     "  // This splits a credit into every name it carries and puts each one to the\n"
     "  // same test the rest of the app uses - so \"Karan Aujla Tribute Band\" is still\n"
     "  // not Karan Aujla.\n"
     "  function scCreditNames(credit){\n"
     "    return String(credit == null ? '' : credit)\n"
     "      .split(/\\s*(?:,|&|;|\\/|\\bwith\\b|\\bfeat\\.?\\b|\\bft\\.?\\b|\\bfeaturing\\b|\\bvs\\.?\\b|\\band\\b|\\u00d7|\\sx\\s)\\s*/i)\n"
     "      .map(function(s){ return s.trim(); })\n"
     "      .filter(Boolean);\n"
     "  }\n"
     "  function scCreditHas(credit, artist){\n"
     "    if(!artist) return false;\n"
     "    var want = String(artist).trim();\n"
     "    return scCreditNames(credit).some(function(n){\n"
     "      return window.__scSameArtistName(n, want);\n"
     "    });\n"
     "  }\n")

once('the song pass stops asking who is printed first',
     "          primaryArtistName(r.artistName || '').toLowerCase().trim() === primaryArtistName(artist).toLowerCase().trim());",
     "          scCreditHas(r.artistName || '', artist));")

once('the album pass stops asking who is printed first',
     "            const rArtist = primaryArtistName(r.artistName || '').toLowerCase().trim();\n"
     "            const pArtist = primaryArtistName(artist).toLowerCase().trim();\n"
     "            // Same artist by name, never by substring: \"Karan Aujla Tribute\n"
     "            // Band\" is not Karan Aujla, and a remix album is not his drop.\n"
     "            if(!window.__scSameArtistName(rArtist, pArtist)) return;",
     "            // 80.7 - any credited name counts, not just the first: a\n"
     "            // collaboration album is filed under one name and credited to both.\n"
     "            // The test is still by name, never by substring.\n"
     "            if(!scCreditHas(r.artistName || '', artist)) return;")

# -- 3. the release rows carry the day the drop is filed under -----------------
once('a release row carries its day',
     'return `<div class="new-release-row" data-title="${escapeHtml(rel.title)}" data-artist=',
     'return `<div class="new-release-row" data-title="${escapeHtml(rel.title)}" data-date="${escapeHtml(rel.date || \'\')}" data-artist=')

