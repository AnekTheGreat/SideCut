"""80.5 - the web page is the build without the converters; /full/ is the one with them.

The owner's ask, verbatim:

    "have the converters only on the full build apk version not web version
     either, make a seperate web version with the converters on a different URL
     with full attached to it"

WHAT ALREADY EXISTED. Since 60.5 this page has been two builds in one: CI sets
window.__PLAY_BUILD__ on the AAB and the page then removes Conversion Tools, the
downloader and every acquisition path, keeping only "the files you already have".
That machinery is complete and proven - it removes `convToolsCard`, `spCardDisc`,
`ytCardDisc` and the Settings copies, rewrites Discover's how-to, and gates about
twenty entry points with `SC_IS_PLAY`. So this release does not write a second
hider; it teaches the existing one about a THIRD build: the plain web page.

THE SHAPE OF THE CHANGE. `SC_IS_PLAY` stops meaning "the store build" and starts
meaning what every gate actually reads it as: THIS BUILD OFFERS NO CONVERTER. It
is now true for the store build AND for a web page that was not opened in full
mode. The store build's own properties - Billing, its update channel, its version
line - move to `SC_PLAY_NATIVE`, which is the flag CI injects and nothing else, so
a web page never claims to be a Play install and never checks ota-play/.

THE FAILURE MODE IS THE APP PEOPLE ALREADY HAVE. An installed app serves this
page from https://localhost, which is http(s) too, so "is this the web" cannot be
answered by the protocol. It is answered by Capacitor's own isNativePlatform(),
then by the host: a loopback / IP / .local name is a machine talking to itself (a
local preview), not the site, and keeps the tools. Anything that cannot answer
keeps the tools too. A player that quietly lost its converter is the one outcome
this must never produce.

THE FULL WEB BUILD IS THE SAME PAGE, NOT A COPY. `?full` (and `full`,
`build=full`, or a /full/ pathname) turns the gate off. /full/index.html is a
door: it replaces itself with ../?full=1, so the converters cost one file of HTML
instead of a second 3.7 MB page that every release would have to keep in step.

TWO MORE EDITS ARE NOT GATES AT ALL. The web page adds one card to Discover's
how-to that says where the tools went and links to /full/ - a page that silently
drops a menu reads as broken. And the version line names the build it is running,
because "my converter is missing" is a question about which build is installed.

Imported by dev/patch-805.py; holds constants only.
"""

# The heading the block goes in front of: the page's own build switch.
WEB_ANCHOR = '// ---- Build switch: Play Store build vs sideload/OTA build --------------------'

WEB_BLOCK = r'''// ---- 80.5 - WHICH PAGE THIS IS, AND WHICH BUILD ------------------------------
// SideCut reaches a phone three ways, and since this release only the installed
// ones convert:
//
//   * THE FULL APK (sideload / OTA): every converter, every source. No flag.
//   * THE STORE BUILD: patch-playbuild.py injects window.__PLAY_BUILD__, and the
//     page leaves out the converters, the downloader and every video-host path.
//   * THE WEB PAGE (this, served from github.io): the same build as the store
//     one - the files you already have, no tools - unless it was opened with
//     `?full`. The full web app is the same page with that one word: /full/ is
//     the short link, and it replaces itself with ../?full=1.
//
// THE INSTALLED APP IS NEVER A WEB PAGE. The WebView serves this bundle from
// https://localhost, which is http(s) as well, so the test cannot be the protocol:
// it is Capacitor's isNativePlatform() first, then the host. A loopback, an IP
// literal or a .local name is a machine talking to itself (a local preview), not
// the site. A context that cannot answer at all keeps the tools - the failure
// mode of this switch has to be the app people already have, never a player that
// quietly lost its converter.
var SC_IS_WEB = (function(){
  try{
    var _cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if(_cap && typeof _cap.isNativePlatform === 'function' && _cap.isNativePlatform()) return false;
    if(_cap && typeof _cap.getPlatform === 'function'){
      var _pf = _cap.getPlatform();
      if(_pf === 'android' || _pf === 'ios') return false;
    }
    var _proto = String((typeof location !== 'undefined' && location.protocol) || '');
    if(_proto !== 'http:' && _proto !== 'https:') return false;   // file:, capacitor:, blob:
    var _host = String((typeof location !== 'undefined' && location.hostname) || '').toLowerCase();
    if(!_host) return false;
    if(_host === 'localhost' || _host === '127.0.0.1' || _host === '::1' || _host === '[::1]') return false;
    if(/^\d{1,3}(\.\d{1,3}){3}$/.test(_host)) return false;
    if(/\.local$/.test(_host)) return false;
    return true;
  }catch(_eScWeb){ return false; }
})();
// `?full`, `?full=1`, `?build=full`, or a /full/ pathname. The loader page at
// /full/index.html leaves the app at ../?full=1, but it is accepted by path as
// well so the door keeps working if it is ever served without its redirect.
var SC_WEB_FULL = !SC_IS_WEB ? false : (function(){
  try{
    var _q = String(location.search || '').toLowerCase();
    if(/(^|[?&])full(=|&|$)/.test(_q)) return true;
    if(/(^|[?&])build=full(&|$)/.test(_q)) return true;
    if(/\/full(\/|$|\.html)/.test(String(location.pathname || '').toLowerCase())) return true;
  }catch(_eScFull){}
  return false;
})();

'''

# The two build flags, as 80.4 left them.
PLAY_OLD = "var SC_IS_PLAY = !!(typeof window !== 'undefined' && window.__PLAY_BUILD__);"

PLAY_NEW = r'''// The store build itself, and nothing else: Billing, the store's update channel
// and the licensed-source layer are Play's own, and a web page has none of them.
var SC_PLAY_NATIVE = !!(typeof window !== 'undefined' && window.__PLAY_BUILD__);
// ...and this is the flag every GATE has always read. It means "this build offers
// no download", which is the store build AND, since 80.5, a plain web page. One
// definition rather than twenty edits: the removal block below and every hard
// gate in the page (a converter that is somehow called, a download job, the
// licensed-source search) key off this, so the web page inherits a behaviour that
// has been shipping since 60.5 instead of a second, newer, less-tested hider.
var SC_IS_PLAY = SC_PLAY_NATIVE || (SC_IS_WEB && !SC_WEB_FULL);'''

# The tail of the block that rewrites Discover's how-to on a no-tools build.
CARD_ANCHOR = """      if(_el.nextElementSibling && _el.nextElementSibling.parentNode) _el.nextElementSibling.parentNode.removeChild(_el.nextElementSibling);
    });"""

CARD_ADDED = CARD_ANCHOR + r'''
    // 80.5 - THE WEB PAGE SAYS WHERE THE TOOLS WENT. A page that silently drops a
    // menu reads as broken, so the one thing it adds is the door to the full web
    // app. ONLY the web page: an installed store build must never point at a
    // converter, not even with a link, because that is the swap its review was
    // about. `./full/` is served beside this page.
    if(SC_IS_WEB){
      try{
        var _gsh = document.getElementById('getSongsHowToDisc');
        if(_gsh && !document.getElementById('scFullWebNote')){
          var _fullNote = document.createElement('div');
          _fullNote.id = 'scFullWebNote';
          _fullNote.style.cssText = 'margin-top:10px; padding:10px 12px; border-radius:10px;'
            + ' border:1px solid color-mix(in srgb, var(--coral) 42%, var(--line));'
            + ' background:color-mix(in srgb, var(--coral) 9%, transparent);'
            + ' font-size:11.5px; line-height:1.55; color:var(--ink-dim);';
          _fullNote.innerHTML = '<b style="color:var(--coral);">Converters are not part of the web page.</b>'
            + ' <span>The full web app has them \u2014 Spotify, YouTube, MP4 and Expand URL:'
            + ' <a href="./full/" style="color:var(--coral); font-weight:600; text-decoration:underline;">open SideCut full \u2197</a>.</span>';
          _gsh.appendChild(_fullNote);
        }
      }catch(_eScFullNote){}
    }'''

# Tips are a property of the build, not of the no-tools gate: the web page takes
# them on a card page, exactly like a sideloaded APK.
DONATE_SWAPS = [
    ("if(promise && !SC_IS_PLAY){", "if(promise && !SC_PLAY_NATIVE){",
     'the donate intro (it is not the store build that decides this)'),
    ("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);",
     "const web = SC_PLAY_NATIVE ? '' : donateUrlFor(amt);",
     'the donate card-page fallback'),
    ("const tierList = SC_IS_PLAY ? '' : donateTierList();",
     "const tierList = SC_PLAY_NATIVE ? '' : donateTierList();",
     'the donate tier list'),
]

# "My converter is missing" is a question about which build is installed, so the
# line answers it - for all three builds, not two.
LABEL_OLD = "${SC_IS_PLAY ? 'Play build \u2014 licensed sources' : 'Full build \u2014 all sources'}"

LABEL_NEW = "${SC_IS_WEB ? (SC_IS_PLAY ? 'Web build \u2014 your files only' : 'Web build \u2014 full') : (SC_IS_PLAY ? 'Play build \u2014 licensed sources' : 'Full build \u2014 all sources')}"

# The update channel belongs to the store build; a web page asking for ota-play/
# would be asking about a bundle it does not have.
OTA_SWAPS = [
    ("var _scOtaDir = SC_IS_PLAY ? 'ota-play' : 'ota';",
     "var _scOtaDir = SC_PLAY_NATIVE ? 'ota-play' : 'ota';",
     'the OTA directory'),
    ("(SC_IS_PLAY ? 'ota-play' : 'ota')",
     "(SC_PLAY_NATIVE ? 'ota-play' : 'ota')",
     'the OTA bundle and manifest addresses'),
]
