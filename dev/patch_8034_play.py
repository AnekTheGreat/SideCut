"""80.3.4, section 4 - the Play build: no downloader, no converter, no notes about
one.

The owner's ask, verbatim: *"in play version of app remove any parts even related to
downloaders or converter from the app and it's patch notes"*.

The store build has had "no downloads" since 60.5.4, but it kept them HIDDEN: the
Conversion Tools section was still in the document (display:none, or a section put
away by position), so the shipped page carried a downloader it never offered plus a
note explaining one - and its own update notes were the place that still talked
about converting albums, because the Play channel was only filtering notes marked
[FULL].

Three edits, one per meaning of "remove":

  * THE SECTION LEAVES THE DOCUMENT. The Conversion Tools card (Spotify, YouTube,
    MP4, Expand URL) and the Settings-side copies are removed from the DOM outright
    in this build, not hidden. Everything downstream that reaches for their ids is
    already null-guarded (the wiring has been `if(btn && input)` since the cards
    existed) and every converter keeps its hard SC_IS_PLAY gate, so a build that
    cannot convert anything is also a build that no longer carries one.
  * THE NOTES ARE THE BUILD'S OWN. An entry whose notes are all downloader notes
    is left out of the update log, the changelog sheet and the What's New panel on
    this build, so no panel claims "0 updates"; and the published Play channel
    (dev/ota-bundle-play.mjs) drops the same notes, with one honest line when a
    release had nothing else to say.
  * THIS RELEASE'S OWN NOTES carry [FULL] on every downloader item, which is the
    marker both channels already understand.

Imported by dev/patch-8034.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 4a. An id on the Conversion Tools section, so this build can name it.
# ---------------------------------------------------------------------------
CONV_ID_OLD = """    <details>
      <summary style="cursor:pointer; padding:12px 14px;"""

CONV_ID_NEW = """    <details id="convToolsCard">
      <summary style="cursor:pointer; padding:12px 14px;"""

# ---------------------------------------------------------------------------
# 4b. The Play branch: remove, do not hide.
# ---------------------------------------------------------------------------
PLAY_CARDS_OLD = """    ['ytCardDisc'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });"""

PLAY_CARDS_NEW = """    // 80.3.4 - REMOVED, NOT HIDDEN. This build offers no download, so it no longer
    // carries one: the whole Conversion Tools section goes, with the Spotify,
    // YouTube, MP4 and Expand URL cards inside it and their Settings copies.
    // Everything that used to reach for these ids is null-guarded, and every
    // converter keeps its hard SC_IS_PLAY gate - so there is nothing left in this
    // build that could be called a downloader or a converter.
    ['convToolsCard', 'spCardDisc', 'ytCardDisc', 'spCardSettings', 'ytCardSettings'].forEach(function(_id){
      var _el = document.getElementById(_id);
      if(_el && _el.parentNode) _el.parentNode.removeChild(_el);
    });"""

PLAY_SP_OLD = """    // 73.5 - the Settings-side cards went with their tab, so only Discover's are
    // left to hide.
    ['spCardDisc'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });"""

PLAY_SP_NEW = """    // 73.5 - the Settings-side cards went with their tab; 80.3.4 takes the
    // Discover section itself out above, so there is nothing left to put away.""" 

PLAY_SIBLING_OLD = """      // The tool section is this box’s next element.
      if(_el.nextElementSibling) _el.nextElementSibling.style.display = 'none';"""

PLAY_SIBLING_NEW = """      // 80.3.4 - the tool section beside this box (the link expander, the three
      // converter cards and the format explainer) is REMOVED with the rest of the
      // conversion tools: a build that offers no download keeps no downloader.
      if(_el.nextElementSibling && _el.nextElementSibling.parentNode) _el.nextElementSibling.parentNode.removeChild(_el.nextElementSibling);"""

PLAY_SUM_OLD = """    var _sums = document.querySelectorAll('summary span');
    for(var _si = 0; _si < _sums.length; _si++){
      var _sumTxt = _sums[_si].textContent || '';
      if(/Spotify/.test(_sumTxt) && /MP4/.test(_sumTxt)) _sums[_si].textContent = 'MP4 \u00b7 Expand URL';
    }
"""

PLAY_SUM_NEW = """    // 80.3.4 - the summary line that used to be rewritten here ("Spotify \u00b7
    // YouTube \u00b7 MP4 \u00b7 Expand URL" -> "MP4 \u00b7 Expand URL") is gone with the
    // section it labelled, so there is nothing left to rewrite and no tool named on
    // a card this build no longer has.
"""

# ---------------------------------------------------------------------------
# 4c. The notes this build shows (and the ones it does not).
# ---------------------------------------------------------------------------
NOTES_FN_OLD = """  function changelogTitle(entry){
    var t = (entry && entry.title) || '';
    if(scIsPlayBuild() && scHidesOnPlay(t)) return 'Fixes & improvements';
    return t;
  }"""

NOTES_FN_NEW = """  function changelogTitle(entry){
    var t = (entry && entry.title) || '';
    if(scIsPlayBuild() && scHidesOnPlay(t)) return 'Fixes & improvements';
    return t;
  }
  // 80.3.4 - AN ENTRY WITH NO NOTES THIS BUILD CAN SHOW IS NOT SHOWN. The filter
  // above already hides the downloader items on the Play build, which would leave a
  // headline like "an album converts in minutes" standing over nothing (and a
  // count reading "0 updates"). Every panel that lists the notes goes through
  // here, so this build never announces a downloader it does not have.
  function scChangelogEntries(){
    var out = [];
    var play = scIsPlayBuild();
    for(var i = 0; i < CHANGELOG.length; i++){
      if(play && !changelogItems(CHANGELOG[i]).length) continue;
      out.push(CHANGELOG[i]);
    }
    return out.length ? out : CHANGELOG.slice(0, 1);
  }"""

# The five places the array is read: the update-log panel (both modes), the sheet
# that lists every release, and the What's New popup's two reads.
NOTES_SITES = [
    ("""      body.innerHTML = CHANGELOG.map(entry => `""",
     """      body.innerHTML = scChangelogEntries().map(entry => `""",
     'the update-log panel (both of its modes)'),
    ("""    const latest = CHANGELOG[0];""",
     """    const latest = scChangelogEntries()[0];""",
     "the changelog sheet's summary"),
    ("""    html += CHANGELOG.map((entry, idx) => {""",
     """    html += scChangelogEntries().map((entry, idx) => {""",
     'the changelog sheet list'),
    ("""        const entry = CHANGELOG[0];""",
     """        const entry = scChangelogEntries()[0];""",
     "the What's New popup"),
]

# ---------------------------------------------------------------------------
# 4d. The published Play channel: the same rule, in the script that builds it.
# ---------------------------------------------------------------------------
OTAPLAY_FN_OLD = """function readVersion(src) {"""

OTAPLAY_FN_NEW = """// 80.3.4 - THE NOTES THIS CHANNEL PUBLISHES ARE FILTERED THE WAY THE APP SHOWS
// THEM. This is the build with no downloader and no converter, so a note about one
// is not a note it can publish. The two rules are the page's own: an item marked
// [FULL] belongs to the other build, and an item the page hides on this build is
// hidden here too. This is `scHidesOnPlay` from index.html, kept in step by hand -
// the notes the channel publishes and the notes the app shows have to agree.
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\\b|spotify to mp3|youtube to mp3|\\bto mp3\\b|get song\\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off)/i.test(t)) return true;
  if (/\\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}

function readVersion(src) {"""

OTAPLAY_NOTES_OLD = """  const e = entries.find((x) => String(x.version) === String(version)) || entries[0];
  if (!e) return { notes: [], date: '' };
  // [FULL]-marked items never belong to this channel.
  return { notes: (e.items || []).filter((it) => !(typeof it === 'string' && it.startsWith('[FULL] '))).slice(0, 6), date: e.date ? String(e.date) : '' };"""

OTAPLAY_NOTES_NEW = """  const e = entries.find((x) => String(x.version) === String(version)) || entries[0];
  if (!e) return { notes: [], date: '' };
  // [FULL]-marked items never belong to this channel, and neither does anything
  // this build hides (a downloader, a converter, their copy). A release whose only
  // notes were about downloads therefore publishes one honest line rather than a
  // note about a feature the build does not have.
  const shown = (e.items || []).filter((it) => typeof it !== 'string' || (!it.startsWith('[FULL] ') && !hidesOnPlay(it)));
  const notes = (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
  return { notes, date: e.date ? String(e.date) : '' };"""