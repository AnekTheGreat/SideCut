#!/usr/bin/env python3
"""74.1.9 - ASK SIDECUT: the AI button, with the music as context and a plan you approve.

The owner: *"can we make an ai button that I can ask anything with like my songs and it'll do it
like create a new playlist containing these songs that Crossfade with specific DJ mode settings"*.

The app already had an assistant (Settings -> Support) and an acting layer (`window.SCACT`), but:
  * it was three taps deep in Settings, away from the music;
  * it had no idea what "these songs" meant;
  * the acting layer ran a sentence immediately, with no plan to look at first;
  * and nothing it did could be undone.

This adds one button (Home header, and the multi-select bar), a drawer, a small typed planner and a
PLAN you approve, executed through the app's own functions and reversible from the toast.

    python3 dev/patch-74110-ai-button.py           # apply
    python3 dev/patch-74110-ai-button.py --check   # the shipped page carries every edit
"""
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"

src = PAGE.read_text(encoding="utf-8")
edits, pairst = [], []
CHECK = "--check" in sys.argv


def rep(old, new, why):
    global src
    pairst.append((old, new, why))
    if CHECK:
        return
    n = src.count(old)
    if n != 1:
        raise SystemExit("anchor found %d times (%s):\n%s" % (n, why, old[:200]))
    src = src.replace(old, new, 1)
    edits.append(why)


# ---------------------------------------------------------------------------
# 1. The button, where the music is.
# ---------------------------------------------------------------------------
rep(
    '    <button class="icon-btn" id="refreshBtn" title="Refresh app" style="flex-shrink:0;">\n',
    '    <button class="icon-btn" id="homeAiBtn" title="Ask SideCut about your music" aria-label="Ask SideCut">\n'
    '      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6 5.6 1.9-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm6 11l.95 2.8 2.8.95-2.8.95L18 20.5l-.95-2.8-2.8-.95 2.8-.95L18 13z"/></svg>\n'
    '    </button>\n'
    '    <button class="icon-btn" id="refreshBtn" title="Refresh app" style="flex-shrink:0;">\n',
    "the Home header carries an Ask button",
)

rep(
    '          <button class="icon-btn" id="selectDeleteBtn" title="Delete selected"',
    '          <button class="icon-btn" id="selectAskBtn" title="Ask SideCut about these songs" aria-label="Ask SideCut about these songs">\n'
    '            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6 5.6 1.9-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z"/></svg>\n'
    '          </button>\n'
    '          <button class="icon-btn" id="selectDeleteBtn" title="Delete selected"',
    "and the selection bar asks about the songs you picked",
)

# ---------------------------------------------------------------------------
# 2. The seven bridges the drawer needs, each beside the variable it changes.
# ---------------------------------------------------------------------------
rep(
    "  let djDisabledPlaylists = new Set(); // playlists the user has manually opted out of DJ Mode for\n",
    "  let djDisabledPlaylists = new Set(); // playlists the user has manually opted out of DJ Mode for\n"
    "  // 74.1.9 - the Ask drawer runs in the Studio block, which is a later <script> and\n"
    "  // cannot see this Set, so the two switches it needs are published here beside it.\n"
    "  // Both return what the value was BEFORE, which is what Undo puts back.\n"
    "  window.__scSetDjDisabled = function(name, on){\n"
    "    try{\n"
    "      var key = String(name || '').trim();\n"
    "      if(!key) return null;\n"
    "      // `on` is DJ MODE ON. The Set stores the opt-outs, so enabling removes the name.\n"
    "      var before = !djDisabledPlaylists.has(key);\n"
    "      if(on) djDisabledPlaylists.delete(key); else djDisabledPlaylists.add(key);\n"
    "      dbPut('meta', { key: 'djDisabledPlaylists', value: Array.from(djDisabledPlaylists) });\n"
    "      renderTabs();\n"
    "      return before;\n"
    "    }catch(_e){ return null; }\n"
    "  };\n",
    "DJ mode is a switch the drawer can read back (the previous value is the undo)",
)

rep(
    "  let crossfadeSeconds = 6;\n",
    "  let crossfadeSeconds = 6;\n"
    "  // The crossfade slider is bound to this number, so the drawer changes the same one\n"
    "  // the slider does - label, stored row and playback all follow.\n"
    "  window.__scSetCrossfade = function(sec){\n"
    "    var n = Math.max(0, Math.min(12, Math.round(Number(sec) || 0)));\n"
    "    var before = crossfadeSeconds;\n"
    "    crossfadeSeconds = n;\n"
    "    try{ var sl = $('crossfadeSlider'); if(sl) sl.value = String(n); }catch(_eSl){}\n"
    "    try{ var lb = $('crossfadeValue'); if(lb) lb.textContent = n + 's'; }catch(_eLb){}\n"
    "    try{ dbPut('meta', { key: 'crossfadeSeconds', value: n }); }catch(_eDb){}\n"
    "    return before;\n"
    "  };\n",
    "crossfade is one number, and the drawer sets the same one the slider does",
)

rep(
    "  window.__scSelectedIds = function(){ return Array.from(selectedIds); };\n",
    "  window.__scSelectedIds = function(){ return Array.from(selectedIds); };\n"
    "  window.__scActivePlaylist = function(){ return String(activePlaylist || ''); };\n"
    "  // Undo for a playlist the drawer created: the same cleanup deletePlaylist() does,\n"
    "  // without the confirm - the drawer has already asked.\n"
    "  window.__scDropPlaylist = function(name){\n"
    "    if(!name || !playlists[name]) return false;\n"
    "    delete playlists[name];\n"
    "    try{\n"
    "      if(hiddenPlaylists.has(name)){ hiddenPlaylists.delete(name); dbPut('meta', { key: 'hiddenPlaylists', value: Array.from(hiddenPlaylists) }); }\n"
    "      if(djDisabledPlaylists.has(name)){ djDisabledPlaylists.delete(name); dbPut('meta', { key: 'djDisabledPlaylists', value: Array.from(djDisabledPlaylists) }); }\n"
    "    }catch(_eClean){}\n"
    "    if(activePlaylist === name) activePlaylist = 'All Songs';\n"
    "    saveMeta(); renderTabs(); renderList();\n"
    "    return true;\n"
    "  };\n",
    "the drawer can see the open playlist, and can take back a playlist it made",
)

# ---------------------------------------------------------------------------
# 3. The offline knowledge base, reachable from the drawer.
# ---------------------------------------------------------------------------
rep(
    "// Knowledge base: question → answer pairs\nvar _aiKB = [\n",
    "// 74.1.9 - the Ask drawer asks the same knowledge base the Support chat does, so\n"
    "// a question typed next to the music is answered from the app itself.\n"
    "window.__scAiLookup = function(q){\n"
    "  try{\n"
    "    if(typeof _aiFuzzyMatch !== 'function') return '';\n"
    "    var entry = _aiFuzzyMatch(String(q || ''));\n"
    "    return (entry && entry.a) ? String(entry.a) : '';\n"
    "  }catch(_e){ return ''; }\n"
    "};\n"
    "// Knowledge base: question → answer pairs\nvar _aiKB = [\n",
    "the drawer answers from the knowledge base that already ships",
)

# ---------------------------------------------------------------------------
# 4. The drawer's own styles.
# ---------------------------------------------------------------------------
rep(
    ".sc-sheet-head h3{ flex: 1; font-size: 15px; }\n",
    ".sc-sheet-head h3{ flex: 1; font-size: 15px; }\n"
    "/* 74.1.9 - ASK SIDECUT. A bottom drawer that knows what is selected, turns a\n"
    "   sentence into a PLAN, and does nothing until Do it is tapped. */\n"
    "#scAiBackdrop{ display:none; position:fixed; inset:0; z-index:260; align-items:flex-end; justify-content:center; background:rgba(6,10,28,0.6); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }\n"
    "#scAiBackdrop.in{ display:flex; }\n"
    "#scAiBody{ padding:10px 16px calc(14px + env(safe-area-inset-bottom)); overflow-y:auto; -webkit-overflow-scrolling:touch; display:flex; flex-direction:column; gap:10px; }\n"
    ".scai-ctx{ font-size:11.5px; color:var(--ink-dim); border:1px solid var(--line); border-radius:999px; padding:5px 10px; align-self:flex-start; }\n"
    ".scai-log{ display:flex; flex-direction:column; gap:8px; max-height:34vh; overflow-y:auto; }\n"
    ".scai-msg{ font-size:13px; line-height:1.5; padding:9px 11px; border-radius:12px; background:color-mix(in srgb, var(--bg) 70%, transparent); border:1px solid var(--line); }\n"
    ".scai-msg.me{ align-self:flex-end; background:color-mix(in srgb, var(--coral) 16%, transparent); border-color:color-mix(in srgb, var(--coral) 40%, transparent); }\n"
    ".scai-plan{ display:none; border:1px solid color-mix(in srgb, var(--coral) 45%, transparent); border-radius:14px; padding:10px 12px; background:color-mix(in srgb, var(--coral) 8%, transparent); }\n"
    ".scai-plan.on{ display:block; }\n"
    ".scai-step{ display:flex; gap:8px; font-size:12.5px; padding:4px 0; color:var(--ink); }\n"
    ".scai-step b{ color:var(--coral); }\n"
    ".scai-acts{ display:flex; gap:8px; margin-top:10px; }\n"
    ".scai-acts button{ flex:1; padding:10px; border-radius:10px; font-size:13px; font-weight:600; border:none; }\n"
    "#scAiDoBtn{ background:var(--coral); color:var(--on-coral, #fff); }\n"
    "#scAiCancelBtn{ background:var(--bg-raised); color:var(--ink-dim); border:1px solid var(--line); }\n"
    ".scai-chips{ display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; }\n"
    ".scai-chips button{ flex-shrink:0; font-size:11.5px; padding:6px 10px; border-radius:999px; border:1px solid var(--line); background:none; color:var(--ink-dim); }\n"
    ".scai-row{ display:flex; gap:8px; }\n"
    "#scAiInput{ flex:1; min-width:0; padding:11px 12px; border-radius:12px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font-size:13.5px; }\n"
    "#scAiPlanBtn{ padding:0 16px; border-radius:12px; border:none; background:var(--coral); color:var(--on-coral, #fff); font-weight:700; font-size:13px; }\n",
    "the drawer looks like the rest of the app",
)

# ---------------------------------------------------------------------------
# 5. The drawer itself, in the Studio block, beside the acting layer it uses.
# ---------------------------------------------------------------------------
MODULE = r'''
  /* --------------------------------------------------------------------------
     74.1.9 - ASK SIDECUT
     --------------------------------------------------------------------------
     One button, where the music is, opening a drawer that knows what is selected.
     A sentence becomes a PLAN - a list of typed steps against the app's own
     functions - and NOTHING runs until Do it is tapped. The old acting layer
     (window.SCACT) ran the sentence as it was typed; this one shows the same kind
     of work as steps first, and leaves an Undo behind.
     -------------------------------------------------------------------------- */
  var SCAI = (function(){
    var built = false, sheet, backdrop, input, logEl, planEl, ctxEl, doBtn, cancelBtn, sendBtn;
    var lastPlan = null;

    function tracks(){ return call('__scAllTracks') || []; }
    function playlists(){ return call('__scPlaylists') || {}; }
    function selection(){ return call('__scSelectedIds') || []; }
    function esc(s){
      return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
      });
    }
    function trackName(id){
      var t = tracks().filter(function(x){ return x.id === id; })[0];
      return t ? String(t.name || 'a song') : 'a song';
    }

    // ---- THE PLAN -------------------------------------------------------------
    // A tiny, declared grammar. It is deliberately not a free-text interpreter: every
    // thing the drawer can do is a step kind listed here, and anything outside it is
    // answered, or offered as one sentence for the existing acting layer to run.
    function planFor(text){
      var raw = String(text || '').trim();
      var low = raw.toLowerCase();
      var sel = selection();
      var steps = [];
      if(!low) return { reply: 'Ask me to make a playlist, set a crossfade, or turn DJ mode on.', steps: steps };

      // 1. A playlist, optionally named.
      // Matched against the RAW sentence, not the lowercased one: the name the owner
      // typed keeps its capitals, so "Night Drive" stays "Night Drive".
      var pm = raw.match(/(?:make|create|build|start|new)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:new\s+)?playlist(?:\s+(?:called|named|for)\s+["\u201c']?([^"\u201d'.,;]+)["\u201d']?)?/i);
      if(!pm) pm = raw.match(/playlist\s+(?:called|named)\s+["\u201c']?([^"\u201d'.,;]+)["\u201d']?/i);
      var plName = '';
      if(pm){
        plName = pm[1] ? String(pm[1]).trim() : '';
        // "called Night Drive from these songs with a 6 second crossfade" - the name
        // ends where the next instruction begins.
        plName = plName.replace(/\s+(?:with|and|from|that|using|then|cross\s*-?\s*fade|dj\b|crossfade\b).*$/i, '').trim();
        if(!plName) plName = 'New playlist';
        if(/^(them|these|those|this|the)$/i.test(plName)) plName = 'New playlist';
      }
      var wantsThese = /(these songs|this selection|these tracks|selected|selection|them|these)\b/.test(low);
      if(plName){
        var existing = playlists()[plName];
        if(!sel.length){
          steps.push({ kind: 'note', text: 'Pick the songs first - tick them in the library, then ask me again.', bad: true });
        } else if(existing && existing.length){
          steps.push({ kind: 'playlist',
            label: 'Add ' + sel.length + ' selected song' + (sel.length === 1 ? '' : 's') + ' to the existing playlist "' + plName + '"',
            name: plName, ids: sel.slice(), add: true });
        } else {
          steps.push({ kind: 'playlist',
            label: 'Create the playlist "' + plName + '" with ' + sel.length + ' selected song' + (sel.length === 1 ? '' : 's'),
            name: plName, ids: sel.slice(), add: false });
        }
      } else if(wantsThese && !/(crossfade|dj mode)/.test(low) && sel.length) {
        steps.push({ kind: 'note', text: 'Tell me the playlist name - "make a playlist called Late Night from these songs".', bad: true });
      }

      // 2. Crossfade.
      // Both ways people say it: "crossfade 9" and "a 9 second crossfade".
      var cm = low.match(/cross\s*-?\s*fade(?:\s*(?:of|to|at|for))?\s*(\d+(?:\.\d+)?)/);
      if(!cm) cm = low.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec\b|secs\b|second[s]?\b)\s*(?:long\s+)?cross\s*-?\s*fade/);
      if(cm) steps.push({ kind: 'crossfade', label: 'Set the crossfade to ' + Math.max(0, Math.min(12, Math.round(Number(cm[1])))) + 's', sec: Number(cm[1]) });

      // 3. DJ mode for the playlist being made, or the one on screen.
      var dm = low.match(/\bdj(?:\s*mode)?\s*(on|off)\b/);
      if(dm){
        var djName = plName || call('__scActivePlaylist') || '';
        if(djName) steps.push({ kind: 'dj', label: 'Turn DJ mode ' + dm[1] + ' for "' + djName + '"', name: djName, on: dm[1] === 'on' });
      }

      if(steps.length){
        var good = steps.filter(function(s){ return !s.bad; });
        var reply = good.length
          ? 'Here is the plan - nothing has changed yet.'
          : steps[0].text;
        return { reply: reply, steps: steps, summary: good.map(function(s){ return s.label; }).join('; ') };
      }

      // 4. Nothing in the grammar: let the existing acting layer carry one sentence,
      //    but only after the owner taps Do it.
      var action = { kind: 'action', label: 'Carry out: "' + raw + '"', text: raw };
      var kb = '';
      try{ kb = (typeof window.__scAiLookup === 'function') ? window.__scAiLookup(raw) : ''; }catch(_eKb){}
      if(kb){
        return { reply: kb.replace(/\*\*/g, ''), steps: [], fromKB: true };
      }
      return { reply: 'I can do that one if you tap Do it - or ask it in Settings \u2192 Support for a full answer.', steps: [action], summary: raw };
    }

    // ---- RUNNING IT ------------------------------------------------------------
    function runPlan(p){
      var before = JSON.parse(JSON.stringify(playlists() || {}));
      var done = [], undo = [];
      p.steps.forEach(function(st){
        try{
          if(st.bad) return;
          if(st.kind === 'playlist'){
            var ids = st.add ? ((before[st.name] || []).slice()) : st.ids.slice();
            if(st.add) st.ids.forEach(function(id){ if(ids.indexOf(id) === -1) ids.push(id); });
            call('__scSetPlaylist', st.name, ids);
            done.push(st.label);
          }
          if(st.kind === 'crossfade'){
            st.prev = call('__scSetCrossfade', st.sec);
            done.push(st.label);
          }
          if(st.kind === 'dj'){
            st.prev = call('__scSetDjDisabled', st.name, st.on);
            done.push(st.label);
          }
          if(st.kind === 'action'){
            var r = (window.SCACT && window.SCACT.tryRun) ? window.SCACT.tryRun(st.text) : null;
            st.result = r;
            if(r) done.push(r);
          }
        }catch(e){ st.failed = true; }
      });
      // Undo is the whole bookkeeping: playlist bodies go back exactly, a playlist the
      // drawer created is taken away, and the two switches return to their old values.
      var crossfadeStep = p.steps.filter(function(s){ return s.kind === 'crossfade'; })[0];
      var djStep = p.steps.filter(function(s){ return s.kind === 'dj'; })[0];
      toastWithUndo('Done - ' + (done[0] || 'that is set'), function(){
        Object.keys(playlists()).forEach(function(n){ if(!(n in before)) call('__scDropPlaylist', n); });
        Object.keys(before).forEach(function(n){
          var now = (playlists()[n] || []).join(',');
          if(now !== before[n].join(',')) call('__scSetPlaylist', n, before[n]);
        });
        if(crossfadeStep && crossfadeStep.prev != null) call('__scSetCrossfade', crossfadeStep.prev);
        if(djStep && djStep.prev != null) call('__scSetDjDisabled', djStep.name, djStep.prev);
      });
      return done;
    }

    // ---- THE DRAWER ------------------------------------------------------------
    function build(){
      if(built) return;
      built = true;
      backdrop = document.createElement('div');
      backdrop.id = 'scAiBackdrop';
      backdrop.innerHTML =
        '<div class="sc-sheet" id="scAiSheet" role="dialog" aria-modal="true" aria-label="Ask SideCut">' +
          '<div class="sc-sheet-grip"></div>' +
          '<div class="sc-sheet-head"><h3>Ask SideCut</h3>' +
            '<button class="icon-btn" id="scAiClose" title="Close" style="width:32px;height:32px;">\u2715</button></div>' +
          '<div id="scAiBody">' +
            '<div class="scai-ctx" id="scAiCtx"></div>' +
            '<div class="scai-log" id="scAiLog"></div>' +
            '<div class="scai-plan" id="scAiPlan"></div>' +
            '<div class="scai-chips">' +
              '<button data-scai-chip="crossfade 6">crossfade 6s</button>' +
              '<button data-scai-chip="dj mode on">DJ mode on</button>' +
              '<button data-scai-chip="make a playlist called Late Night from these songs">playlist from these</button>' +
            '</div>' +
            '<div class="scai-row"><input id="scAiInput" type="text" autocomplete="off" placeholder="Ask anything - or tell me what to do">' +
              '<button id="scAiPlanBtn">Plan</button></div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(backdrop);
      sheet = backdrop.querySelector('#scAiSheet');
      input = backdrop.querySelector('#scAiInput');
      logEl = backdrop.querySelector('#scAiLog');
      planEl = backdrop.querySelector('#scAiPlan');
      ctxEl = backdrop.querySelector('#scAiCtx');
      sendBtn = backdrop.querySelector('#scAiPlanBtn');
      doBtn = null; cancelBtn = null;
      backdrop.addEventListener('click', function(e){ if(e.target === backdrop) close(); });
      backdrop.querySelector('#scAiClose').addEventListener('click', close);
      sendBtn.addEventListener('click', ask);
      input.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); ask(); } });
      Array.prototype.forEach.call(backdrop.querySelectorAll('[data-scai-chip]'), function(b){
        b.addEventListener('click', function(){ input.value = b.dataset.scaiChip; ask(); });
      });
    }

    function message(text, who){
      var el = document.createElement('div');
      el.className = 'scai-msg' + (who === 'me' ? ' me' : '');
      el.textContent = String(text || '').replace(/\*\*/g, '');
      logEl.appendChild(el);
      logEl.scrollTop = logEl.scrollHeight;
      return el;
    }

    function renderPlan(p){
      lastPlan = (p && p.steps && p.steps.filter(function(s){ return !s.bad; }).length) ? p : null;
      planEl.innerHTML = '';
      if(!lastPlan){ planEl.classList.remove('on'); return; }
      planEl.classList.add('on');
      var head = document.createElement('div');
      head.style.cssText = 'font-size:11px;letter-spacing:0.4px;text-transform:uppercase;color:var(--coral);margin-bottom:4px;';
      head.textContent = 'Plan - nothing has changed yet';
      planEl.appendChild(head);
      lastPlan.steps.forEach(function(st, i){
        var row = document.createElement('div');
        row.className = 'scai-step';
        row.innerHTML = '<b>' + (i + 1) + '.</b><span>' + esc(st.label) + '</span>';
        planEl.appendChild(row);
      });
      var acts = document.createElement('div');
      acts.className = 'scai-acts';
      doBtn = document.createElement('button');
      doBtn.id = 'scAiDoBtn';
      doBtn.textContent = 'Do it';
      cancelBtn = document.createElement('button');
      cancelBtn.id = 'scAiCancelBtn';
      cancelBtn.textContent = 'Cancel';
      acts.appendChild(cancelBtn);
      acts.appendChild(doBtn);
      planEl.appendChild(acts);
      cancelBtn.addEventListener('click', function(){
        planEl.classList.remove('on');
        planEl.innerHTML = '';
        lastPlan = null;
        message('Cancelled - nothing was changed.');
      });
      doBtn.addEventListener('click', function(){
        var p2 = lastPlan;
        lastPlan = null;
        planEl.classList.remove('on');
        planEl.innerHTML = '';
        if(!p2) return;
        var done = runPlan(p2);
        close();
        if(!done.length) toast('Nothing was changed.');
      });
    }

    function ask(){
      var text = String(input.value || '').trim();
      if(!text) return;
      build();
      message(text, 'me');
      input.value = '';
      var p = planFor(text);
      message(p.reply);
      renderPlan(p);
      updateCtx();
      try{ if(window.__scMarkAiUsed) window.__scMarkAiUsed(); }catch(_e){}
    }

    function updateCtx(){
      var sel = selection();
      var n = sel.length;
      ctxEl.textContent = n
        ? (n + ' song' + (n === 1 ? '' : 's') + ' selected' + (n <= 3 ? ' \u00b7 ' + sel.map(trackName).join(', ') : ''))
        : ('Your library \u00b7 ' + tracks().length + ' songs');
    }

    function open(){
      build();
      updateCtx();
      backdrop.classList.add('in');
      setTimeout(function(){ try{ input.focus(); }catch(_e){ } }, 60);
    }
    function close(){
      if(backdrop) backdrop.classList.remove('in');
    }

    // The two ways in, wired here because this block is the one that owns the drawer.
    try{
      var hb = document.getElementById('homeAiBtn');
      if(hb) hb.addEventListener('click', open);
      var sb = document.getElementById('selectAskBtn');
      if(sb) sb.addEventListener('click', open);
    }catch(_eWire){}

    return {
      open: open, close: close, plan: planFor, run: runPlan,
      isOpen: function(){ return !!(backdrop && backdrop.classList.contains('in')); }
    };
  })();
  window.SCAI = SCAI;
'''

rep(
    "  window.SCACT = SCACT;\n",
    "  window.SCACT = SCACT;\n" + MODULE,
    "the Ask drawer, its planner, its plan and its undo",
)

# ---------------------------------------------------------------------------
# 6. The release note.
# ---------------------------------------------------------------------------
rep(
    "    'Home bubbles have the size that was missing:",
    "    'Ask SideCut sits in the Home header and on the multi-select bar. Say what you want in your own words - make a playlist from these songs, crossfade 6 seconds, DJ mode on - and it shows the plan before anything changes, then does it with one tap and an Undo.',\n"
    "    'Home bubbles have the size that was missing:",
    "the release note announces the button",
)

if CHECK:
    bad = 0
    for old, new, why in pairst:
        if new not in src:
            print("  MISSING result: " + why)
            bad += 1
        elif old not in new and old in src:
            print("  STALE anchor:  " + why)
            bad += 1
    if bad:
        print("patch-74110-ai-button: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-74110-ai-button: CHECK OK - %d edits are in the page" % len(pairst))
    for _, _, e in pairst:
        print("  . " + e)
    sys.exit(0)

PAGE.write_text(src, encoding="utf-8")
print("patch-74110-ai-button: applied %d edits" % len(edits))
for e in edits:
    print("  . " + e)
