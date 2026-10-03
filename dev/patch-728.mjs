#!/usr/bin/env node
/**
 * SideCut 72.8 - Last.fm scrobbling, and the two lyrics highlight chips.
 *
 * The owner's words: "Next feature: Last.fm scrobbling | Letter by letter
 * doesn't work and the button itself should be highlighted if you click on it
 * same thing with word by word".
 *
 * THREE things, in one feature release:
 *
 * 1. LETTER-BY-LETTER COULD NOT BE SEEN. The pacing code was already walking the
 *    letters of the sung word and applying `.lit` to each in turn (verified in
 *    jsdom against the shipped code). It was invisible: word-by-word paints the
 *    WHOLE current word gold and glowing, so the gold letters had nothing to
 *    stand out against. In letter mode the word now sits in the trough
 *    (--ink-dim, no glow, no pulse) and only the .lit letters are gold, so the
 *    wave is the highlight.
 *
 * 2. THE CHIPS DID NOT LOOK ON. Both chips carry their base border and colour as
 *    an INLINE style, and an inline style outranks a plain class rule, so the
 *    `.active` class the chips already toggled painted nothing - the label
 *    flipped to "On" and the chip stayed grey. The Highlight chip solved the
 *    same problem with !important; the word and letter chips now do too.
 *
 * 3. LAST.FM SCROBBLING. A self-contained module: the user's own API key and
 *    shared secret live on this device, the request signature is an MD5 of the
 *    sorted parameters plus the secret, now-playing is sent when a track starts
 *    and the scrobble when it is heard, and anything that cannot be sent is
 *    queued and retried. ws.audioscrobbler.com answers Access-Control-Allow-
 *    Origin: * and accepts POST (checked against the live endpoint), so no
 *    server of ours sits in the middle and the secret never leaves the device.
 *
 * EVERY sub is a swap and carries a `key`, so re-running this on a tree that
 * already has it applied is a no-op.
 *
 *   node dev/patch-728.mjs
 *   node dev/patch-728.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.8';
const STAMP = 'October 3, 2026 \\u00b7 5:45 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.7.1';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'Scrobble to Last.fm, and the lyrics chips light up when they are on';
const NOTES = [
  'SideCut scrobbles to Last.fm now: each song you hear past its halfway point is sent to your own account, and now playing appears on your profile the moment a song starts.',
  'Turn it on under Settings, then More, then Scrobble to Last.fm: paste your own Last.fm API key and shared secret, tap Connect, and authorize SideCut in the window that opens.',
  'The key and secret live only on this device and are used for nothing but signing requests to Last.fm, so the account you scrobble to is yours alone.',
  'A song that cannot be sent while you are offline is held in a queue and sent on its own once the connection returns, so listening on a plane costs you nothing.',
  'A song shorter than thirty seconds is never sent, because Last.fm would refuse it, and only real playback counts - the player, the widget and your library are left exactly as they were.',
  'The switch turns scrobbling off again at any time, and Disconnect forgets the account without touching a single song, playlist or saved setting.',
  'The letter-by-letter lyrics highlight shows its wave now: the word under the light stays plain and only the letters being sung turn gold, instead of the whole word arriving gold at once.',
  'The Word-by-word and Letter-by-letter chips in the lyrics bar light up in coral while they are on, so their state is visible at a glance and not only in the label.',
  'Everything else stays where it was: the queue, the equalizer, the storage panel, the startup stopwatch and every saved setting are untouched.',
];

// The settings card, kept as one blob so it lands in exactly one place.
const LASTFM_CARD = `      <!-- Last.fm scrobbling (72.8) -->
      <div id="lastfmCard" style="margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--line);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="min-width:0;">
            <div style="font-size:13px; font-weight:600;">Scrobble to Last.fm</div>
            <div id="lastfmStatus" style="font-size:11px; color:var(--ink-dim); margin-top:2px;">Not connected</div>
          </div>
          <button id="lastfmToggle" style="padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Off</button>
        </div>
        <div style="font-size:11px; color:var(--ink-dim); line-height:1.6; margin:8px 0 6px;">Every song you listen to is scrobbled to <b>your own</b> Last.fm account. Use your own API key and shared secret — they stay on this device and go nowhere except Last.fm.</div>
        <input id="lastfmKeyInput" type="text" placeholder="Last.fm API key" autocomplete="off" spellcheck="false" style="width:100%; box-sizing:border-box; margin-bottom:6px; padding:9px 10px; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font-size:12px;">
        <input id="lastfmSecretInput" type="password" placeholder="Last.fm shared secret" autocomplete="off" spellcheck="false" style="width:100%; box-sizing:border-box; margin-bottom:8px; padding:9px 10px; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font-size:12px;">
        <button class="playlist-pick-btn" id="lastfmConnectBtn" style="text-align:center; width:100%;">Connect Last.fm</button>
        <div id="lastfmAuthHint" style="display:none; font-size:11px; color:var(--ink-dim); line-height:1.6; margin-top:6px;"></div>
        <div id="lastfmQueueHint" style="display:none; font-size:11px; color:var(--gold); margin-top:6px;"></div>
        <button id="lastfmDisconnectBtn" style="margin-top:8px; width:100%; padding:8px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; cursor:pointer;">Disconnect</button>
        <details style="margin-top:8px;"><summary style="cursor:pointer; color:var(--gold); font-size:11px; font-weight:600;">Where do I get an API key?</summary><div style="margin-top:6px; font-size:11px; color:var(--ink-dim); line-height:1.7;">Open <b>last.fm/api/account/create</b>, give the application any name (for example “SideCut”), and copy the <b>API key</b> and <b>Shared secret</b> it shows you — those two go in the boxes above. Scrobbling stays off, and nothing is sent anywhere, until you connect.</div></details>
      </div>`;

// The scrobbler module, inserted in front of the play counters.
const LASTFM_MODULE = `  // ---- Last.fm scrobbling (72.8) -------------------------------------------
  // Self-contained on purpose: the user's own API key and shared secret live in
  // localStorage on this device, the signature is an MD5 of the sorted request
  // parameters plus the secret, now-playing is sent when a track starts and the
  // scrobble when it has been heard, and anything that cannot be sent is queued
  // and retried. ws.audioscrobbler.com answers Access-Control-Allow-Origin: *
  // and accepts POST, so nothing of ours sits in the middle and the secret never
  // leaves the device.
  var LF_API = 'https://ws.audioscrobbler.com/2.0/';
  var LF_AUTH = 'https://www.last.fm/api/auth/';
  var LF_K_KEY = 'sidecut_lastfm_key';
  var LF_K_SECRET = 'sidecut_lastfm_secret';
  var LF_K_SESSION = 'sidecut_lastfm_session';
  var LF_K_USER = 'sidecut_lastfm_user';
  var LF_K_ON = 'sidecut_lastfm_on';
  var LF_K_QUEUE = 'sidecut_lastfm_queue';
  var LF_MIN_SECONDS = 30;   // Last.fm refuses anything shorter
  var LF_QUEUE_MAX = 200;    // a long offline stretch stays bounded

  // Last.fm signs with MD5, which crypto.subtle does not offer, so the digest
  // rides along here rather than reaching for a library.
  function lfMd5(string){
    function safeAdd(x, y){ var lsw = (x & 0xFFFF) + (y & 0xFFFF); var msw = (x >> 16) + (y >> 16) + (lsw >> 16); return (msw << 16) | (lsw & 0xFFFF); }
    function rol(num, cnt){ return (num << cnt) | (num >>> (32 - cnt)); }
    function cmn(q, a, b, x, s, t){ return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t){ return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t){ return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t){ return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t){ return cmn(c ^ (b | ~d), a, b, x, s, t); }
    function cycle(x, len){
      x[len >> 5] |= 0x80 << (len % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;
      var i, oa, ob, oc, od, a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
      for(i = 0; i < x.length; i += 16){
        oa = a; ob = b; oc = c; od = d;
        a = ff(a, b, c, d, x[i], 7, -680876936);        d = ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = ff(c, d, a, b, x[i + 2], 17, 606105819);    b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = ff(a, b, c, d, x[i + 4], 7, -176418897);    d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = ff(c, d, a, b, x[i + 6], 17, -1473231341);  b = ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = ff(a, b, c, d, x[i + 8], 7, 1770035416);    d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = ff(c, d, a, b, x[i + 10], 17, -42063);      b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = ff(a, b, c, d, x[i + 12], 7, 1804603682);   d = ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = gg(a, b, c, d, x[i + 1], 5, -165796510);    d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = gg(c, d, a, b, x[i + 11], 14, 643717713);   b = gg(b, c, d, a, x[i], 20, -373897302);
        a = gg(a, b, c, d, x[i + 5], 5, -701558691);    d = gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = gg(c, d, a, b, x[i + 15], 14, -660478335);  b = gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = gg(a, b, c, d, x[i + 9], 5, 568446438);     d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = gg(c, d, a, b, x[i + 3], 14, -187363961);   b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = gg(a, b, c, d, x[i + 13], 5, -1444681467);  d = gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = gg(c, d, a, b, x[i + 7], 14, 1735328473);   b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = hh(a, b, c, d, x[i + 5], 4, -378558);       d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = hh(c, d, a, b, x[i + 11], 16, 1839030562);  b = hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = hh(a, b, c, d, x[i + 1], 4, -1530992060);   d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = hh(c, d, a, b, x[i + 7], 16, -155497632);   b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = hh(a, b, c, d, x[i + 13], 4, 681279174);    d = hh(d, a, b, c, x[i], 11, -358537222);
        c = hh(c, d, a, b, x[i + 3], 16, -722521979);   b = hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = hh(a, b, c, d, x[i + 9], 4, -640364487);    d = hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = hh(c, d, a, b, x[i + 15], 16, 530742520);   b = hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = ii(a, b, c, d, x[i], 6, -198630844);        d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = ii(a, b, c, d, x[i + 12], 6, 1700485571);   d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = ii(c, d, a, b, x[i + 10], 15, -1051523);    b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = ii(a, b, c, d, x[i + 8], 6, 1873313359);    d = ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = ii(c, d, a, b, x[i + 6], 15, -1560198380);  b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = ii(a, b, c, d, x[i + 4], 6, -145523070);    d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = ii(c, d, a, b, x[i + 2], 15, 718787259);    b = ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = safeAdd(a, oa); b = safeAdd(b, ob); c = safeAdd(c, oc); d = safeAdd(d, od);
      }
      return [a, b, c, d];
    }
    function toHex(bin){
      var tab = '0123456789abcdef', out = '';
      for(var i = 0; i < bin.length * 4; i++){
        out += tab.charAt((bin[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) + tab.charAt((bin[i >> 2] >> ((i % 4) * 8)) & 0xF);
      }
      return out;
    }
    var bytes = unescape(encodeURIComponent(String(string == null ? '' : string)));
    var words = [];
    for(var i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes.charCodeAt(i) << ((i % 4) * 8));
    return toHex(cycle(words, bytes.length * 8));
  }

  function lfGet(k, d){ try{ var v = localStorage.getItem(k); return v === null ? d : v; }catch(_e){ return d; } }
  function lfSet(k, v){ try{ if(v === null || v === undefined || v === '') localStorage.removeItem(k); else localStorage.setItem(k, String(v)); }catch(_e){} }
  function lfConfig(){ return { key: lfGet(LF_K_KEY, ''), secret: lfGet(LF_K_SECRET, ''), session: lfGet(LF_K_SESSION, ''), user: lfGet(LF_K_USER, '') }; }
  function lfEnabled(){ return lfGet(LF_K_ON, '') === '1' && !!lfConfig().session; }
  function lfNotify(msg, ms){ try{ if(typeof window.toast === 'function') window.toast(msg, ms || 3000); }catch(_e){} }

  // The signature: every parameter except format and callback, sorted by name,
  // concatenated as name+value, then the shared secret, digested with MD5.
  function lfSig(params, secret){
    var keys = Object.keys(params).filter(function(k){
      return k !== 'format' && k !== 'callback' && params[k] !== undefined && params[k] !== null && params[k] !== '';
    });
    keys.sort();
    var s = '';
    for(var i = 0; i < keys.length; i++) s += keys[i] + String(params[keys[i]]);
    return lfMd5(s + secret);
  }
  function lfPost(params, secret){
    var p = Object.assign({}, params);
    p.api_sig = lfSig(p, secret);
    var body = new URLSearchParams();
    Object.keys(p).forEach(function(k){ var v = p[k]; if(v !== undefined && v !== null && v !== '') body.append(k, v); });
    body.append('format', 'json');
    return fetch(LF_API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
      .then(function(r){ return r.text().then(function(t){ var d = null; try{ d = JSON.parse(t); }catch(_e){ d = null; } return { ok: r.ok, status: r.status, data: d }; }); })
      .then(function(res){
        var d = res.data;
        if(d && d.error){ var e = new Error(d.message || ('Last.fm error ' + d.error)); e.lfCode = d.error; throw e; }
        if(!res.ok) throw new Error('Last.fm request failed (' + res.status + ')');
        return d;
      });
  }
  function lfQueue(){ try{ var q = JSON.parse(lfGet(LF_K_QUEUE, '') || '[]'); return Object.prototype.toString.call(q) === '[object Array]' ? q : []; }catch(_e){ return []; } }
  function lfQueueSave(q){ lfSet(LF_K_QUEUE, JSON.stringify((q || []).slice(-LF_QUEUE_MAX))); }

  var lfNow = null;   // { id, artist, track, album, duration, startedAt }
  function lfNowPlaying(t){
    var c = lfConfig();
    if(!lfEnabled() || !c.key || !c.secret || !c.session) return;
    if(!t) return;
    var artist = String(t.artist || '').trim(), name = String(t.name || '').trim();
    if(!artist || !name) return;
    lfNow = { id: t.id, artist: artist, track: name, album: String(t.album || '').trim(), duration: Math.round(t.duration || 0), startedAt: Math.floor(Date.now() / 1000) };
    var params = { method: 'track.updateNowPlaying', api_key: c.key, sk: c.session, artist: artist, track: name };
    if(lfNow.album) params.album = lfNow.album;
    if(lfNow.duration > 0) params.duration = lfNow.duration;
    lfPost(params, c.secret).catch(function(){ /* now playing is best effort */ });
  }
  function lfScrobble(t){
    var c = lfConfig();
    if(!lfEnabled() || !c.key || !c.secret || !c.session) return;
    if(!t) return;
    var artist = String(t.artist || '').trim(), name = String(t.name || '').trim();
    if(!artist || !name) return;
    var duration = Math.round(t.duration || 0);
    if(duration > 0 && duration < LF_MIN_SECONDS) return;   // Last.fm would refuse it
    var startedAt = (lfNow && lfNow.id === t.id) ? lfNow.startedAt : Math.floor(Date.now() / 1000);
    var item = { artist: artist, track: name, album: String(t.album || '').trim(), timestamp: startedAt, duration: duration };
    lfSendScrobble(item).catch(function(){
      var q = lfQueue(); q.push(item); lfQueueSave(q);
      lfUpdateUI();
    });
  }
  function lfSendScrobble(item){
    var c = lfConfig();
    if(!lfEnabled() || !c.key || !c.secret || !c.session) return Promise.reject(new Error('Last.fm is not connected.'));
    var params = { method: 'track.scrobble', api_key: c.key, sk: c.session, 'artist[0]': item.artist, 'track[0]': item.track, 'timestamp[0]': item.timestamp };
    if(item.album) params['album[0]'] = item.album;
    if(item.duration > 0) params['duration[0]'] = item.duration;
    return lfPost(params, c.secret);
  }
  function lfFlushQueue(){
    if(!lfEnabled()) return Promise.resolve();
    var q = lfQueue();
    if(!q.length){ lfUpdateUI(); return Promise.resolve(); }
    var item = q[0];
    return lfSendScrobble(item).then(function(){
      var rest = lfQueue(); rest.shift(); lfQueueSave(rest);
      return lfFlushQueue();
    }).catch(function(){ lfUpdateUI(); /* still offline — the queue keeps it */ });
  }
  function lfUpdateUI(){
    try{
      var c = lfConfig(), connected = !!c.session && !!c.key && !!c.secret;
      var status = $('lastfmStatus'), toggle = $('lastfmToggle'), keyI = $('lastfmKeyInput'), secI = $('lastfmSecretInput');
      if(status){
        status.textContent = connected ? ('Connected as ' + (c.user || 'you'))
          : ((c.key && c.secret) ? 'Ready — tap Connect to authorize on Last.fm' : 'Not connected');
      }
      if(toggle){
        var on = lfEnabled();
        toggle.textContent = on ? 'On' : 'Off';
        toggle.style.borderColor = on ? 'var(--coral)' : 'var(--line)';
        toggle.style.color = on ? 'var(--coral)' : 'var(--ink-dim)';
        toggle.disabled = !connected;
        toggle.style.opacity = connected ? '1' : '0.5';
      }
      if(keyI && document.activeElement !== keyI) keyI.value = c.key || '';
      if(secI && document.activeElement !== secI) secI.value = c.secret || '';
      var qh = $('lastfmQueueHint'), q = lfQueue();
      if(qh){
        if(connected && q.length){
          qh.style.display = '';
          qh.textContent = q.length + ' scrobble' + (q.length === 1 ? '' : 's') + ' waiting to send — they go on their own once the connection is back.';
        } else { qh.style.display = 'none'; }
      }
    }catch(_e){}
  }
  function lfConnect(){
    var keyI = $('lastfmKeyInput'), secI = $('lastfmSecretInput');
    var key = ((keyI && keyI.value) || '').trim(), secret = ((secI && secI.value) || '').trim();
    if(!key || !secret){ lfNotify('Paste your Last.fm API key and shared secret first.', 3400); return; }
    lfSet(LF_K_KEY, key); lfSet(LF_K_SECRET, secret); lfUpdateUI();
    lfPost({ method: 'auth.getToken', api_key: key }, secret).then(function(d){
      var token = d && d.token;
      if(!token) throw new Error('Last.fm returned no token.');
      var url = LF_AUTH + '?api_key=' + encodeURIComponent(key) + '&token=' + encodeURIComponent(token);
      var hint = $('lastfmAuthHint');
      if(hint){
        hint.style.display = '';
        hint.innerHTML = 'Authorize SideCut on Last.fm, then come back here — the app notices by itself. If no window opened, <a href="' + url + '" target="_blank" rel="noopener" style="color:var(--coral);">tap here to authorize</a>.';
      }
      try{ window.open(url, 'lastfm_auth', 'width=820,height=680'); }catch(_e){}
      lfNotify('Authorize SideCut in the Last.fm window, then wait a moment…', 5200);
      var tries = 0;
      var poll = setInterval(function(){
        tries++;
        lfPost({ method: 'auth.getSession', api_key: key, token: token }, secret).then(function(sd){
          var sess = sd && sd.session;
          if(!sess || !sess.key) throw new Error('Last.fm returned no session.');
          clearInterval(poll);
          lfSet(LF_K_SESSION, sess.key); lfSet(LF_K_USER, sess.name || ''); lfSet(LF_K_ON, '1');
          if(hint) hint.style.display = 'none';
          lfUpdateUI(); lfFlushQueue();
          lfNotify('Last.fm connected as ' + (sess.name || 'you') + ' — scrobbling is on', 4200);
        }).catch(function(e){
          if(e && e.lfCode === 14){                     // not authorized yet
            if(tries > 100){ clearInterval(poll); lfNotify('Last.fm authorization timed out — tap Connect to try again.', 4200); }
            return;
          }
          clearInterval(poll);
          lfNotify('Last.fm connect failed: ' + ((e && e.message) || 'unknown error'), 4600);
        });
      }, 3000);
    }).catch(function(e){ lfNotify('Last.fm rejected the key: ' + ((e && e.message) || 'unknown error'), 4600); });
  }
  function lfDisconnect(){
    lfSet(LF_K_SESSION, null); lfSet(LF_K_USER, null); lfSet(LF_K_ON, null);
    var hint = $('lastfmAuthHint'); if(hint) hint.style.display = 'none';
    lfUpdateUI();
    lfNotify('Last.fm disconnected.', 2600);
  }
  try{
    if($('lastfmConnectBtn')) $('lastfmConnectBtn').addEventListener('click', lfConnect);
    if($('lastfmDisconnectBtn')) $('lastfmDisconnectBtn').addEventListener('click', lfDisconnect);
    if($('lastfmToggle')) $('lastfmToggle').addEventListener('click', function(){
      if(!lfConfig().session) return;
      var on = !lfEnabled();
      lfSet(LF_K_ON, on ? '1' : null);
      lfUpdateUI();
      if(on){ lfFlushQueue(); lfNotify('Last.fm scrobbling is on'); }
      else lfNotify('Last.fm scrobbling is off');
    });
    window.addEventListener('online', function(){ lfFlushQueue(); });
  }catch(_eLfWire){}
  lfUpdateUI();
  setTimeout(function(){ lfFlushQueue(); }, 9000);
  window.scLastfm = {
    nowPlaying: lfNowPlaying,
    scrobble: lfScrobble,
    flush: lfFlushQueue,
    update: lfUpdateUI,
    enabled: lfEnabled,
    config: lfConfig,
    md5: lfMd5,
    sig: lfSig
  };
`;

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

let applied = 0, already = 0;

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

/* ============================================================================
   1. THE VERSION AND THE CHANGELOG HEAD
   ========================================================================== */
sub(html, 'the app runs 72.8',
  "  const APP_VERSION = '72.7.1';\n",
  "  const APP_VERSION = '72.8';\n",
  { key: "const APP_VERSION = '72.8';" });

const headEntry = [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...NOTES.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');

sub(html, 'the changelog carries the 72.8 entry at its head',
  "  const CHANGELOG = [\n" +
  "  { version: '" + OLDVER + "', date:",
  "  const CHANGELOG = [\n" +
  headEntry + "\n" +
  "  { version: '" + OLDVER + "', date:",
  { key: "{ version: '" + VERSION + "', date: '" + STAMP + "'" });

sub(sw, 'the shell cache is the release name',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ============================================================================
   2. THE LETTER WAVE BECOMES VISIBLE
   --------------------------------------------------------------------------
   Word-by-word owns the gold: .ww-on .lyric-word.current is gold, glowing and
   pulsing. Letter mode rides on top of word mode, so without this the lit
   letters were gold on gold. In letter mode the word drops to the plain lyric
   tint with no glow and no pulse, and the .lit letters are the only gold.
   Placed after the .ww-on rule so equal specificity resolves to this one.
   ========================================================================== */
sub(html, 'letter mode puts the word in the trough',
  "  #lyricsText.ll-on .lyric-word.current .lyric-letter{\n" +
  "    font-weight: 700;\n" +
  "    transform: translateY(-1px);\n" +
  "  }\n",
  "  #lyricsText.ll-on .lyric-word.current .lyric-letter{\n" +
  "    font-weight: 700;\n" +
  "    transform: translateY(-1px);\n" +
  "  }\n" +
  "  /* 72.8 - letter mode needs the word to sit in the trough. Word-by-word paints\n" +
  "     the whole current word gold and glowing, so the lit letters had nothing to\n" +
  "     stand out against — the sweep happened but could not be seen, which read as\n" +
  "     \"letter-by-letter does nothing\". In letter mode the word goes back to the\n" +
  "     plain lyric tint, with no glow and no pulse, and only the .lit letters are\n" +
  "     gold: the travelling light IS the highlight. */\n" +
  "  #lyricsText.ll-on .lyric-word.current{\n" +
  "    color: var(--ink-dim);\n" +
  "    background: none;\n" +
  "    text-shadow: none;\n" +
  "    animation: none;\n" +
  "  }\n",
  { key: '#lyricsText.ll-on .lyric-word.current{' });

/* ============================================================================
   3. THE CHIPS LOOK ON WHEN THEY ARE ON
   ========================================================================== */
sub(html, 'both highlight chips show their coral state',
  "  #lyricsWordBtn.active {\n" +
  "    border-color: var(--coral);\n" +
  "    color: var(--coral);\n" +
  "  }",
  "  /* 72.8 - a chip has to LOOK on when it is on. Both highlight chips carry their\n" +
  "     base border/colour as an INLINE style, and an inline style outranks a plain\n" +
  "     class rule, so the .active class these chips already toggled painted\n" +
  "     nothing: the label flipped to \"On\" but the chip stayed grey. !important —\n" +
  "     the same trick the Highlight chip already uses — puts the coral on top. */\n" +
  "  #lyricsWordBtn.active, #lyricsLetterBtn.active {\n" +
  "    border-color: var(--coral) !important;\n" +
  "    color: var(--coral) !important;\n" +
  "    background: rgba(255,79,126,0.1) !important;\n" +
  "  }",
  { key: '#lyricsWordBtn.active, #lyricsLetterBtn.active {' });

/* ============================================================================
   4. THE LAST.FM CARD IN SETTINGS -> MORE
   ========================================================================== */
sub(html, 'the More tab carries the Last.fm card',
  "      <div style=\"margin-bottom:16px;\">\n" +
  "        <button class=\"playlist-pick-btn\" id=\"howToUseBtn\" style=\"text-align:center;\">🎓 Replay tutorial</button>\n" +
  "        <div style=\"font-size:11px; color:var(--ink-dim); margin-top:6px; text-align:center;\">Shown automatically the first time you open the app — replay it anytime from here.</div>\n" +
  "      </div>\n" +
  "\n" +
  "      <!-- Diagonal / Single button toggle -->",
  "      <div style=\"margin-bottom:16px;\">\n" +
  "        <button class=\"playlist-pick-btn\" id=\"howToUseBtn\" style=\"text-align:center;\">🎓 Replay tutorial</button>\n" +
  "        <div style=\"font-size:11px; color:var(--ink-dim); margin-top:6px; text-align:center;\">Shown automatically the first time you open the app — replay it anytime from here.</div>\n" +
  "      </div>\n" +
  "\n" +
  LASTFM_CARD +
  "\n" +
  "      <!-- Diagonal / Single button toggle -->",
  { key: 'id="lastfmCard"' });

/* ============================================================================
   5. THE SCROBBLER ITSELF
   --------------------------------------------------------------------------
   A self-contained module dropped in front of the play-counting block, so the
   track-start hook (recordPlay) and the midpoint hook (commitPlay) can call it
   and nothing else has to move.
   ========================================================================== */
sub(html, 'the scrobbler module sits beside the play counters',
  "  const PLAY_COUNTS_AFTER = 0.5;\n",
  LASTFM_MODULE + "\n  const PLAY_COUNTS_AFTER = 0.5;\n",
  { key: "var LF_API = 'https://ws.audioscrobbler.com/2.0/';" });

sub(html, 'a track change tells Last.fm what is playing',
  "    recordListeningDay();\n",
  "    recordListeningDay();\n" +
  "    try{ if(window.scLastfm) window.scLastfm.nowPlaying(t); }catch(_eLfNp){}\n",
  { key: 'window.scLastfm.nowPlaying(t)' });

sub(html, 'a heard song is scrobbled',
  "    scSidecarSet(t.id, { playCount: t.playCount });\n",
  "    scSidecarSet(t.id, { playCount: t.playCount });\n" +
  "    try{ if(window.scLastfm) window.scLastfm.scrobble(t); }catch(_eLfSc){}\n",
  { key: 'window.scLastfm.scrobble(t)' });

/* ============================================================================
   6. THE OTA TAIL - TWO newlines after </html>, as 72.5, 72.7 and 72.7.1
   ========================================================================== */
{
  const trimmed = html.text.replace(/\s*$/, '');
  const want = trimmed.endsWith('</html>') ? trimmed + '\n\n' : trimmed;
  if (html.text !== want) {
    if (process.env.SC_DEBUG) console.log('  normalising the OTA tail to two newlines');
    html.text = want;
    applied++;
  } else {
    already++;
  }
}

if (problems.length) {
  console.error('patch-728: ' + problems.join('\n           '));
  process.exit(1);
}

if (!CHECK) {
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-728: ' + applied + ' applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
