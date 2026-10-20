#!/usr/bin/env python3
r"""75.1.2 - "ask SideCut should be smarter".

The drawer has had the same four shapes since 75.0: playlist, crossfade, DJ mode,
album. Everything else fell through to one "Carry out: <sentence>" step that the
acting layer usually could not carry out, so Do it closed the drawer and said
"Nothing was changed". This patch teaches it the rest of a sentence and stops it
promising work nothing does:

  - play a song, an artist or a playlist, by name, with the ambiguity named back
    at the owner instead of a guess;
  - the three player switches (shuffle, repeat) and the transport (next, back,
    pause, resume) as typed steps with a real Undo;
  - questions answered with the library's own numbers (how many songs, how much
    music, how many playlists / pinned artists / albums, what is playing, the
    most-played song and artist);
  - the sentence after a plan: "add these too", "take these out of it", "undo
    that", "make it 8";
  - one edit of tolerance on the long command words ("palylist", "shufle"), and
    crossfade numbers as words ("crossfade six seconds");
  - and no Do it button for a sentence it cannot carry out: an honest list of
    what it can do instead.

Idempotent. `--check` reports whether the page already carries it.
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
PAGE = os.path.join(ROOT, 'index.html')

HELPERS_ANCHOR = """      return Object.keys(out);
    }
"""

HELPERS = r"""      return Object.keys(out);
    }

    /* ---- 75.1.2: THE REST OF THE SENTENCE -------------------------------------
       "ask SideCut should be smarter" - the grammar above is what existed. What
       follows is what the drawer reads now: a song, an artist or a playlist out of
       "play ...", the two switches and the transport, questions about the library
       answered with the library's own numbers, and the sentence that comes AFTER a
       plan ("add these too", "undo that"), which is what makes it a conversation
       rather than a form. lastRun/lastUndo are what those follow-ups point at. */
    var lastRun = null;
    var lastUndo = null;

    function askNorm(s){
      return String(s == null ? '' : s).toLowerCase()
        .replace(/[\u2018\u2019\u02bc]/g, "'")
        .replace(/[^a-z0-9']+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    // One edit apart still names the command for the long words, so "palylist",
    // "shufle" and "crossfad" are understood. Words under six letters are not
    // fuzzed: at four letters an edit is most of the word, and "plan" would start
    // matching "play".
    function askFuzzy(token, word){
      if(token === word) return true;
      if(word.length < 6 || Math.abs(token.length - word.length) > 1) return false;
      var i = 0, j = 0, edits = 0;
      while(i < token.length && j < word.length){
        if(token.charAt(i) === word.charAt(j)){ i++; j++; continue; }
        if(++edits > 1) return false;
        if(token.length > word.length) i++;
        else if(token.length < word.length) j++;
        else { i++; j++; }
      }
      return (edits + (token.length - i) + (word.length - j)) <= 1;
    }
    function askHasWord(low, word){
      var t = askNorm(low).split(' ');
      for(var i = 0; i < t.length; i++){ if(askFuzzy(t[i], word)) return true; }
      return false;
    }
    var ASK_NUMS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8,
                     nine:9, ten:10, eleven:11, twelve:12, fifteen:15, twenty:20, thirty:30 };
    function askNumber(text){
      var m = String(text || '').match(/\b(\d+(?:\.\d+)?)\b/);
      if(m) return Number(m[1]);
      var t = askNorm(text).split(' ');
      for(var i = 0; i < t.length; i++){ if(ASK_NUMS[t[i]] != null) return ASK_NUMS[t[i]]; }
      return null;
    }
    // How well a typed name matches a real one. Exact beats a prefix, a prefix
    // beats "contains", contains beats "every word is in there somewhere"; below
    // that a partial word match is remembered but never a winner on its own.
    function askScore(query, name){
      var q = askNorm(query), n = askNorm(name);
      if(!q || !n) return 0;
      if(n === q) return 100;
      if(n.indexOf(q) === 0) return 80;
      if(n.indexOf(q) !== -1) return 60;
      var qt = q.split(' '), nt = n.split(' '), hit = 0;
      for(var i = 0; i < qt.length; i++){ if(nt.indexOf(qt[i]) !== -1) hit++; }
      if(hit === qt.length) return 45;
      if(hit) return 20 + Math.round((hit / qt.length) * 20);
      return 0;
    }
    function askBest(query, items, nameOf){
      var best = null, bestScore = 0, second = 0, tied = [];
      (items || []).forEach(function(it){
        var s = askScore(query, nameOf(it));
        if(!s) return;
        if(s > bestScore){ second = bestScore; bestScore = s; best = it; tied = [it]; }
        else if(s === bestScore && best){ tied.push(it); }
        else if(s > second) second = s;
      });
      return { item: best, score: bestScore, second: second, tied: tied };
    }
    function askArtists(){
      var seen = {}, out = [], list = tracks();
      for(var i = 0; i < list.length; i++){
        var a = String(list[i].artist || '').trim();
        if(a && !seen[a.toLowerCase()]){ seen[a.toLowerCase()] = 1; out.push(a); }
      }
      return out;
    }
    function askArtistSongs(name){
      var a = askNorm(name);
      return tracks().filter(function(t){ return askNorm(t.artist) === a; }).map(function(t){ return t.id; });
    }
    function askPlaylistNames(){
      return Object.keys(playlists() || {}).filter(function(n){ return n !== 'All Songs'; });
    }
    function askClosest(q){
      var cands = askPlaylistNames().concat(askArtists()).concat(tracks().map(function(t){ return String(t.name || ''); }));
      var scored = cands.map(function(n){ return { n: n, s: askScore(q, n) }; })
        .filter(function(x){ return x.s >= 20; })
        .sort(function(a, b){ return b.s - a.s; })
        .slice(0, 2);
      return scored.map(function(x){ return '"' + x.n + '"'; }).join(' or ');
    }
    // What "play X" points at. A playlist the sentence names wins when it is named
    // exactly ("play Night Drive"), then a song, then an artist - and a title that
    // more than one song answers to is handed back as a question, not a guess.
    function askTarget(qRaw){
      var q = String(qRaw || '').replace(/[.!?]+$/, '').trim();
      if(!askNorm(q)) return null;
      var saidPlaylist = /\bplaylists?\b/i.test(q);
      var text = q.replace(/\bplaylists?\b/gi, ' ').replace(/^\s*(?:my|the|our)\s+/i, ' ').trim();
      if(saidPlaylist){
        var pl0 = askBest(text, askPlaylistNames(), function(x){ return x; });
        if(pl0.item) return { kind: 'playlist', name: pl0.item, score: pl0.score };
      }
      var byM = q.match(/^(.*?)\s+by\s+(.+)$/i);
      if(byM){
        var art = askBest(byM[2], askArtists(), function(x){ return x; });
        var trb = askBest(byM[1], tracks(), function(t){ return String(t.name || ''); });
        if(trb.item && trb.score >= 45 && (!art.item || trb.score >= art.score)){
          return { kind: 'track', id: trb.item.id, name: trb.item.name, score: trb.score };
        }
        var byIds = art.item ? askArtistSongs(art.item) : [];
        if(art.item && byIds.length) return { kind: 'artist', name: art.item, ids: byIds, score: art.score };
      }
      var tr = askBest(q, tracks(), function(t){ return String(t.name || ''); });
      var ar = askBest(text, askArtists(), function(x){ return x; });
      var pl = askBest(text, askPlaylistNames(), function(x){ return x; });
      if(pl.item && pl.score >= 80 && pl.score >= tr.score) return { kind: 'playlist', name: pl.item, score: pl.score };
      if(tr.item && tr.score >= 45 && tr.score >= ar.score){
        if(tr.tied.length > 1){
          return { kind: 'ambiguous', names: tr.tied.slice(0, 3).map(function(t){ return String(t.name || ''); }) };
        }
        return { kind: 'track', id: tr.item.id, name: tr.item.name, score: tr.score };
      }
      if(ar.item && ar.score >= 45){
        var ids = askArtistSongs(ar.item);
        if(ids.length) return { kind: 'artist', name: ar.item, ids: ids, score: ar.score };
      }
      if(pl.item) return { kind: 'playlist', name: pl.item, score: pl.score };
      return null;
    }
    function askPlaySteps(target, withShuffle, withRepeat){
      var steps = [];
      if(!target) return steps;
      if(target.kind === 'ambiguous'){
        steps.push({ kind: 'note', bad: true, text: 'That matches more than one song - ' +
          target.names.map(function(n){ return '"' + n + '"'; }).join(' or ') +
          '. Say the artist as well: "play ' + target.names[0] + ' by ...".' });
        return steps;
      }
      if(withShuffle) steps.push({ kind: 'shuffle', on: true, label: 'Turn shuffle on' });
      if(target.kind === 'playlist'){
        var ids = (playlists()[target.name] || []).slice();
        if(!ids.length){
          steps.push({ kind: 'note', bad: true, text: '"' + target.name + '" is empty - add some songs to it first.' });
          return steps;
        }
        steps.push({ kind: 'play', playlist: target.name, ids: ids.slice(),
          label: 'Play the playlist "' + target.name + '" (' + ids.length + ' song' + (ids.length === 1 ? '' : 's') + ')' });
      } else if(target.kind === 'artist'){
        steps.push({ kind: 'play', ids: target.ids.slice(),
          label: 'Play ' + target.name + ' (' + target.ids.length + ' song' + (target.ids.length === 1 ? '' : 's') +
            '), starting with "' + trackName(target.ids[0]) + '"' });
      } else {
        steps.push({ kind: 'play', ids: [target.id], label: 'Play "' + target.name + '"' });
      }
      if(withRepeat) steps.push({ kind: 'repeat', mode: 'all', label: 'Set repeat to the whole queue' });
      return steps;
    }

    /* ---- 75.1.2: the verbs ---------------------------------------------------- */
    function askVerb(raw, low){
      var text = String(raw || '');
      var t = String(low || '');
      if(!t) return null;

      // The transport. It is a plan like everything else, so the owner still sees
      // what will happen before it happens.
      if(/^(next|skip)\b/.test(t) || /\bskip (this|the) (song|track)\b/.test(t)){
        return { reply: 'Skip to the next song.', steps: [{ kind: 'transport', verb: 'next', label: 'Skip to the next song' }], summary: 'next' };
      }
      if(/^(previous|prev|back)\b/.test(t) || /\b(go|take me) back a (song|track)\b/.test(t)){
        return { reply: 'Back to the previous song.', steps: [{ kind: 'transport', verb: 'prev', label: 'Go back to the previous song' }], summary: 'previous' };
      }
      if(/^(pause|stop|hold)\b/.test(t)){
        return { reply: 'Pause.', steps: [{ kind: 'transport', verb: 'pause', label: 'Pause the music' }], summary: 'pause' };
      }
      if(/^(resume|continue|unpause|play)\s*[.!]?$/.test(t)){
        return { reply: 'Resume.', steps: [{ kind: 'transport', verb: 'resume', label: 'Resume the music' }], summary: 'resume' };
      }

      var wantsShuffle = askHasWord(t, 'shuffle') || /\bmix it up\b/.test(t);
      var wantsRepeat = askHasWord(t, 'repeat') || askHasWord(t, 'loop') || /\bon repeat\b/.test(t);
      var repeatMode = 'all';
      if(/\b(one|this song|the song|just this)\b/.test(t)) repeatMode = 'one';
      if(/\b(off|no more|stop repeating)\b/.test(t)) repeatMode = 'off';

      // "shuffle everything" is the whole library, shuffled - the one target that
      // is not a playlist the owner made, so it names the app's own All Songs.
      if(/^(shuffle|mix)\s+(everything|all|it all|my library|the library|my music)\b/.test(t)){
        var allIds = (playlists()['All Songs'] || tracks().map(function(x){ return x.id; })).slice();
        if(!allIds.length) return { reply: 'The library is empty, so there is nothing to shuffle.', steps: [] };
        return { reply: 'Shuffle the whole library.',
          steps: [{ kind: 'shuffle', on: true, label: 'Turn shuffle on' },
                  { kind: 'play', playlist: 'All Songs', ids: allIds,
                    label: 'Play your library (' + allIds.length + ' song' + (allIds.length === 1 ? '' : 's') + '), shuffled' }],
          summary: 'shuffle the library' };
      }

      // "play X" / "put on X" / "start playing X" / "shuffle my X". One matcher
      // reads the target whether it is a song, an artist or a playlist.
      var m = text.match(/^\s*(?:please\s+|hey\s+|can you\s+|could you\s+)?(?:play|put on|throw on|start playing|start|shuffle)\s+(.+)$/i);
      if(m){
        var q = m[1].replace(/\s+(?:now|please|for me|again)\b.*$/i, '').replace(/[.!?]+$/, '').trim();
        var shuffleIt = wantsShuffle || /^shuffle\b/i.test(text);
        q = q.replace(/^(?:shuffle|shuffled)\s+/i, '').trim();
        if(q){
          var target = askTarget(q);
          if(target){
            var playSteps = askPlaySteps(target, shuffleIt, wantsRepeat || /\bon repeat\b/.test(t));
            return { reply: 'Here is the plan for that - nothing has started yet.', steps: playSteps,
              summary: playSteps.filter(function(s){ return !s.bad; }).map(function(s){ return s.label; }).join('; ') };
          }
          if(!wantsRepeat){
            var near = askClosest(q);
            var miss = 'Nothing in your library matches "' + q + '"' + (near ? ' - closest: ' + near : '') +
              '. Name the artist too, or add the song first.';
            return { reply: miss, steps: [{ kind: 'note', bad: true, text: miss }] };
          }
        }
      }

      if(wantsShuffle){
        var on = !/\b(off|no|stop|disable)\b/.test(t);
        return { reply: on ? 'Shuffle on.' : 'Shuffle off.',
          steps: [{ kind: 'shuffle', on: on, label: on ? 'Turn shuffle on' : 'Turn shuffle off' }],
          summary: on ? 'shuffle on' : 'shuffle off' };
      }
      if(wantsRepeat){
        return { reply: 'Repeat ' + repeatMode + '.',
          steps: [{ kind: 'repeat', mode: repeatMode,
                    label: 'Set repeat to ' + (repeatMode === 'one' ? 'this song' : repeatMode === 'all' ? 'the whole queue' : 'off') }],
          summary: 'repeat ' + repeatMode };
      }

      // Crossfade by word as well as by digit: "crossfade six seconds" is the same
      // sentence as "crossfade 6", and the hand-typed one used to fall through.
      if(askHasWord(t, 'crossfade') || /cross\s*-?\s*fade/.test(t)){
        var secs = askNumber(t);
        if(secs != null){
          var sec = Math.max(0, Math.min(12, Math.round(secs)));
          return { reply: 'Set the crossfade to ' + sec + 's.',
            steps: [{ kind: 'crossfade', sec: sec, label: 'Set the crossfade to ' + sec + 's' }],
            summary: 'crossfade ' + sec };
        }
      }
      return null;
    }

    /* ---- 75.1.2: the questions, answered from the library --------------------- */
    function askInfo(low){
      var list = tracks();
      var n = list.length;
      if(/\bhow many (songs|tracks)\b/.test(low) || /\bhow big is my library\b/.test(low)){
        return { reply: n ? ('You have ' + n + ' song' + (n === 1 ? '' : 's') + ' in the library.')
                          : 'The library is empty - add a song and ask me again.' };
      }
      if(/\bhow (much|many) (hours?|time|music)\b/.test(low) || /\bhours? of music\b/.test(low) || /\bhow long is my library\b/.test(low)){
        var secs = 0;
        for(var i = 0; i < list.length; i++) secs += Number(list[i].duration || 0) || 0;
        if(!secs) return { reply: 'None of the songs have a length stored yet, so there is nothing to add up.' };
        var h = Math.floor(secs / 3600), mm = Math.round((secs % 3600) / 60);
        return { reply: 'About ' + (h ? h + ' h ' : '') + mm + ' m of music across ' + n + ' song' + (n === 1 ? '' : 's') + '.' };
      }
      if(/\bhow many (playlists|mixes)\b/.test(low)){
        var names = askPlaylistNames();
        return { reply: names.length
          ? (names.length + ' playlist' + (names.length === 1 ? '' : 's') + ' of your own: ' + names.slice(0, 3).join(', ') + (names.length > 3 ? ' and ' + (names.length - 3) + ' more' : '') + '.')
          : 'You have no playlists of your own yet - say "make a playlist called ...".' };
      }
      if(/\bhow many (pinned )?artists\b/.test(low)){
        var pins = call('__scPinnedArtists') || [];
        return { reply: pins.length ? ('You have ' + pins.length + ' pinned artist' + (pins.length === 1 ? '' : 's') + '.') : 'No artists are pinned yet.' };
      }
      if(/\bhow many (albums|records)\b/.test(low)){
        var alb = call('__scGetUserAlbums') || {};
        var nA = Object.keys(alb).length;
        return { reply: nA ? ('You have ' + nA + ' album' + (nA === 1 ? '' : 's') + ' of your own.')
                           : 'No albums of your own yet - say "create an album called ...".' };
      }
      if(/\bwhat'?s? playing\b/.test(low) || /\bwhat (song|track) is (this|on)\b/.test(low) || /\bcurrent (song|track)\b/.test(low)){
        var cur = call('__scCurrentTrack');
        return { reply: cur ? ('"' + String(cur.name || '?') + '"' + (cur.artist ? ' by ' + cur.artist : '') + '.')
                            : 'Nothing is playing right now.' };
      }
      if((/\b(most|top)[ -]?(played|listened)\b/.test(low) && /\b(artist|band|singer)\b/.test(low)) || /\bwho do i (listen|play) to (the )?most\b/.test(low)){
        var counts = {}, order = [];
        for(var j = 0; j < list.length; j++){
          var a = String(list[j].artist || '').trim();
          if(!a) continue;
          if(counts[a] == null){ counts[a] = 0; order.push(a); }
          counts[a] += Number(list[j].playCount || 0) || 0;
        }
        var top = null;
        for(var k = 0; k < order.length; k++){ if(top == null || counts[order[k]] > counts[top]) top = order[k]; }
        if(!top || !counts[top]) return { reply: 'No plays are recorded yet, so there is no artist to rank.' };
        return { reply: 'Your most played artist is ' + top + ' - ' + counts[top] + ' play' + (counts[top] === 1 ? '' : 's') + '.' };
      }
      if(/\b(most|top)[ -]?(played|listened)\b/.test(low) || /\b(favou?rite|best) song\b/.test(low)){
        var bestT = null;
        for(var x = 0; x < list.length; x++){
          if(!bestT || (Number(list[x].playCount || 0) > Number(bestT.playCount || 0))) bestT = list[x];
        }
        if(!bestT || !Number(bestT.playCount || 0)) return { reply: 'No plays are recorded yet, so there is nothing to rank.' };
        return { reply: 'Your most played song is "' + String(bestT.name || '?') + '"' +
          (bestT.artist ? ' by ' + bestT.artist : '') + ' - ' + bestT.playCount + ' play' + (Number(bestT.playCount) === 1 ? '' : 's') + '.' };
      }
      if(/^(what can you do|what can i ask|what can you|help|commands)\b/.test(low)) return { reply: askCanDo() };
      return null;
    }

    /* ---- 75.1.2: the sentence AFTER a plan ------------------------------------ */
    function askFollow(raw, low){
      // A question is not a follow-up. "how do i add songs" is asked in the drawer
      // right after a plan has run, and without this it was read as "add these to
      // the playlist I just touched" - the help question turned into a plan.
      var qText = String(raw == null ? '' : raw).trim();
      if(/\?$/.test(qText)) return null;
      if(/^(how|what|why|when|where|who|which|is|are|do|does|did|can|could|should|will|would)\b/i.test(qText)) return null;
      var sel = selection();
      var t = String(low || '');
      if(/\b(undo|revert|roll ?back)\b/.test(t) && /\b(that|it|this|last|plan|change)\b/.test(t)){
        if(!lastUndo){
          return { reply: 'I have not changed anything in this drawer yet, so there is nothing of mine to undo. The Undo on the toast works the same way.', steps: [] };
        }
        return { reply: 'Undo the last plan.',
          steps: [{ kind: 'undo', label: 'Undo ' + (lastRun && lastRun.summary ? lastRun.summary : 'the last plan') }] };
      }
      var wantsAdd = /\b(add|include|put|throw)\b/.test(t) && /\b(these|them|those|this|selected|selection|songs|tracks)\b/.test(t);
      var wantsRemove = (/\b(remove|drop|delete)\b/.test(t) && /\b(these|them|those|selected|selection)\b/.test(t)) ||
                        /\btake (these|them|those) out\b/.test(t);
      if(wantsAdd || wantsRemove){
        var name = (lastRun && lastRun.playlist) ? lastRun.playlist : '';
        var saidTo = /\b(?:to|into|in|from)\b\s+(\S.*)$/i.exec(String(raw));
        if(saidTo){
          var tail = saidTo[1].replace(/\bplaylists?\b/gi, ' ').replace(/^\s*(?:my|the)\s+/i, ' ').trim();
          var pl = askBest(tail, askPlaylistNames(), function(x){ return x; });
          if(pl.item && pl.score >= 45) name = pl.item;
        }
        if(!name){
          return { reply: sel.length
            ? 'Tell me which playlist - "add these to Night Drive" - or make one first: "make a playlist called Night Drive from these songs".'
            : 'Tick the songs in the library first, then tell me which playlist they go in.', steps: [] };
        }
        if(!sel.length){
          return { reply: 'Tick the songs in the library first - then I can ' + (wantsRemove ? 'take them out of "' : 'add them to "') + name + '".', steps: [] };
        }
        var have = (playlists()[name] || []).slice();
        if(wantsRemove){
          var left = have.filter(function(id){ return sel.indexOf(id) === -1; });
          var gone = have.length - left.length;
          if(!gone) return { reply: 'None of the selected songs are in "' + name + '".', steps: [] };
          return { reply: 'Take ' + gone + ' song' + (gone === 1 ? '' : 's') + ' out of "' + name + '".',
            steps: [{ kind: 'playlist', name: name, ids: left, add: false,
                      label: 'Remove ' + gone + ' selected song' + (gone === 1 ? '' : 's') + ' from "' + name + '"' }] };
        }
        var fresh = sel.filter(function(id){ return have.indexOf(id) === -1; });
        if(!fresh.length) return { reply: 'Those songs are already in "' + name + '".', steps: [] };
        return { reply: 'Add the selection to "' + name + '".',
          steps: [{ kind: 'playlist', name: name, ids: sel.slice(), add: true,
                    label: 'Add ' + fresh.length + ' song' + (fresh.length === 1 ? '' : 's') + ' to "' + name + '"' }] };
      }
      // "make it 8", right after a crossfade plan, means the crossfade.
      var mNum = String(raw).match(/\b(?:make it|set it to|change it to)\s+(.+)$/i);
      if(mNum && lastRun && lastRun.kinds && lastRun.kinds.indexOf('crossfade') !== -1){
        var secs = askNumber(mNum[1]);
        if(secs != null){
          var sec = Math.max(0, Math.min(12, Math.round(secs)));
          return { reply: 'Set the crossfade to ' + sec + 's.',
            steps: [{ kind: 'crossfade', sec: sec, label: 'Set the crossfade to ' + sec + 's' }] };
        }
      }
      return null;
    }

    /* ---- 75.1.2: what it can honestly do -------------------------------------- */
    function askCanDo(){
      return 'I do not have a command for that sentence yet. I can make a playlist or add to one, ' +
        'make an album, play a song, an artist or a playlist, shuffle, repeat, skip, set the crossfade, ' +
        'turn DJ mode on or off, switch the theme, open Studio, undo my last plan, and answer questions ' +
        'about your library. Say it the way you would say it to a person.';
    }
    // The one leftover sentence the acting layer (window.SCACT) really knows. 74.1.9
    // offered "Do it" for ANY leftover sentence, and Do it then did nothing and said
    // "Nothing was changed" - the drawer pretending. A sentence is only offered as a
    // Do it when it is one of these shapes.
    function askActHint(low){
      if(/(crop|clip|trim|cut|export)\b/.test(low) && /\d{1,2}:\d{2}/.test(low)) return true;
      if(/\b(ringtone|story clip|clip maker)\b/.test(low)) return true;
      if(/(theme|look)\b/.test(low) && /(turn on|switch to|use |set |enable|change to|put on)/.test(low)) return true;
      if(/\bkaraoke\b/.test(low)) return true;
      if(/(slow(ed)?( down)?|nightcore|chipmunk|lo-?fi)\b/.test(low) && /(slow|reverb|down|speed|pitch|play)/.test(low)) return true;
      if(/(storage|space|biggest|large files|disk)\b/.test(low) && /(clean|free|space|biggest|largest|what|show|open|taking)/.test(low)) return true;
      if(/\bstudio\b/.test(low) && /(open|show|go to|take me)/.test(low)) return true;
      if(/(auto[- ]?dj|beat[- ]?match|crossfade on the beat|blend)\b/.test(low)) return true;
      if(/(fix|change|edit|set)\s+(the\s+)?(artist|album|genre|cover|tags)\b/.test(low)) return true;
      return false;
    }
"""

FOLLOW_ANCHOR = """      if(!low) return { reply: 'Ask me to make a playlist, set a crossfade, or turn DJ mode on.', steps: steps };
"""
FOLLOW = """      if(!low) return { reply: 'Ask me to make a playlist, set a crossfade, or turn DJ mode on.', steps: steps };
      // 75.1.2 - the follow-up sentence is read first: "add these too", "undo that"
      // and "make it 8" point at the plan the drawer just ran, and they would
      // otherwise be answered by the rules below as if they were brand new asks.
      var follow = askFollow(raw, low);
      if(follow) return follow;
"""

FALLBACK_START = "      // 4. Nothing in the grammar: let the existing acting layer carry one sentence,"
FALLBACK_END = "      return { reply: 'I can do that one if you tap Do it - or ask it in Settings "

FALLBACK = r"""      // 4. 75.1.2 - THE VERBS AND THE QUESTIONS. Below this line the drawer reads
      //    the rest of what a person says: play a song, an artist or a playlist,
      //    shuffle, repeat, skip, and answer a question about the library with the
      //    library's own numbers. A sentence that matches none of it is answered
      //    honestly instead of being given a Do it button for work nothing does.
      var verb = askVerb(raw, low);
      if(verb && verb.steps.length) return verb;
      var info = askInfo(low);
      if(info) return { reply: info.reply, steps: [] };

      var kb = '';
      try{ kb = (typeof window.__scAiLookup === 'function') ? window.__scAiLookup(raw) : ''; }catch(_eKb){}
      if(kb){
        return { reply: kb.replace(/\*\*/g, ''), steps: [], fromKB: true };
      }
      // The acting layer can still carry a sentence the grammar has no shape for -
      // but only when it is one of the sentences the acting layer actually knows.
      if(askActHint(low)){
        var action = { kind: 'action', label: 'Carry out: "' + raw + '"', text: raw };
        return { reply: 'I can carry that out - tap Do it.', steps: [action], summary: raw };
      }
      return { reply: askCanDo(), steps: [] };
    }
"""

RUN_ANCHOR = """      var albBefore = call('__scAskAlbumSnap');
"""
RUN_ADD = """      var albBefore = call('__scAskAlbumSnap');
      // 75.1.2 - what the follow-up sentences point at, collected as the plan runs:
      // the playlist it touched, and the kinds of step that ran.
      var touchedPlaylist = null, kinds = [];
"""

PLAYLIST_STEP_OLD = """          if(st.kind === 'playlist'){
            var ids = st.add ? ((before[st.name] || []).slice()) : st.ids.slice();
            if(st.add) st.ids.forEach(function(id){ if(ids.indexOf(id) === -1) ids.push(id); });
            call('__scSetPlaylist', st.name, ids);
            done.push(st.label);
          }
"""
PLAYLIST_STEP_NEW = """          if(st.kind === 'playlist'){
            var ids = st.add ? ((before[st.name] || []).slice()) : st.ids.slice();
            if(st.add) st.ids.forEach(function(id){ if(ids.indexOf(id) === -1) ids.push(id); });
            call('__scSetPlaylist', st.name, ids);
            touchedPlaylist = st.name;
            done.push(st.label);
          }
"""

NEW_KINDS_ANCHOR = """          if(st.kind === 'action'){
"""
NEW_KINDS = r"""          if(st.kind === 'play'){
            // 75.1.2 - the play step goes through the app's own paths: a playlist
            // opens as itself, so the next song is the next song in it, and a song
            // plays in whichever playlist already holds it.
            var played = false;
            if(st.playlist) played = !!call('__scPlayPlaylist', st.playlist);
            else if(st.ids && st.ids.length) played = !!call('__scPlayTrack', st.ids[0]);
            st.played = played;
            if(played) done.push(st.label); else st.failed = true;
          }
          if(st.kind === 'shuffle'){
            st.prev = call('__scShuffleOn');
            call('__scSetShuffle', st.on);
            done.push(st.label);
          }
          if(st.kind === 'repeat'){
            st.prev = call('__scRepeatMode');
            call('__scSetRepeat', st.mode);
            done.push(st.label);
          }
          if(st.kind === 'transport'){
            if(st.verb === 'next') call('__scNext');
            else if(st.verb === 'prev') call('__scPrev');
            else if(st.verb === 'pause') call('__scPause');
            else if(st.verb === 'resume') call('__scResume');
            done.push(st.label);
          }
          if(st.kind === 'undo'){
            if(lastUndo){ lastUndo(); done.push(st.label); }
            else st.failed = true;
          }
          if(st.kind === 'action'){
"""

KINDS_PUSH_OLD = """        try{
          if(st.bad) return;
"""
KINDS_PUSH_NEW = """        try{
          if(st.bad) return;
          kinds.push(st.kind);
"""

UNDO_OLD = """      toastWithUndo('Done - ' + (done[0] || 'that is set'), function(){
"""
UNDO_NEW = """      var undoAll = function(){
        lastUndo = null;
"""

UNDO_TAIL_OLD = """        if(albStep && albBefore) call('__scAskAlbumRestore', albBefore);
      });
      return done;
    }
"""
UNDO_TAIL_NEW = """        if(albStep && albBefore) call('__scAskAlbumRestore', albBefore);
        // 75.1.2 - the two switches a plan can move go back to what they were.
        var shStep = p.steps.filter(function(s){ return s.kind === 'shuffle' && s.prev != null; })[0];
        if(shStep) call('__scSetShuffle', shStep.prev);
        var repStep = p.steps.filter(function(s){ return s.kind === 'repeat' && s.prev != null; })[0];
        if(repStep) call('__scSetRepeat', repStep.prev);
      };
      // A plan where nothing could run says so once, in the Do it handler; it does
      // not also claim "Done" through the toast.
      if(done.length) toastWithUndo('Done - ' + done[0], undoAll);
      // The drawer keeps the same Undo it just offered on the toast, so "undo
      // that" is the toast's Undo by name rather than a second, half-right one.
      lastUndo = done.length ? undoAll : null;
      lastRun = { playlist: touchedPlaylist, kinds: kinds, at: Date.now(), summary: done[0] || '' };
      return done;
    }
"""

CHIPS_OLD = """              '<button data-scai-chip="create an album called MooseTape with all Sidhu Moose Wala songs">make an album</button>' +
"""
CHIPS_NEW = """              '<button data-scai-chip="create an album called MooseTape with all Sidhu Moose Wala songs">make an album</button>' +
              '<button data-scai-chip="shuffle my Favorites">play a playlist</button>' +
              '<button data-scai-chip="how many songs do I have">ask about my library</button>' +
"""

HOOK_ANCHOR = """  window.__scResume = function(){ try{ var _a2 = activeAudio(); if(_a2 && _a2.paused) $('playPauseBtn').click(); }catch(e){} };
"""
HOOKS = r"""  window.__scResume = function(){ try{ var _a2 = activeAudio(); if(_a2 && _a2.paused) $('playPauseBtn').click(); }catch(e){} };

  // ---- 75.1.2: the three player states Ask SideCut can plan ---------------------
  // The drawer is its own IIFE, so it reaches the player through these. Each one
  // writes the SAME state the button on the player writes, and reports the value
  // it had before, which is what a plan's Undo puts back.
  window.__scShuffleOn = function(){ return !!shuffle; };
  window.__scSetShuffle = function(on){
    try{
      var want = !!on;
      if(!!shuffle === want) return true;
      shuffle = want;
      if(shuffle){
        try{ regenerateShuffleOrder(); }catch(_eReg){}
        // Resync the live queue to the shuffled order without restarting the
        // current song - the same thing the shuffle button on the player does.
        try{
          if(queue.length && queueIndex >= 0 && shuffledOrderCache && shuffledOrderCache.ids){
            var curId = queue[queueIndex];
            queue = shuffledOrderCache.ids.slice();
            var newIdx = queue.indexOf(curId);
            queueIndex = newIdx >= 0 ? newIdx : 0;
          }
        }catch(_eSync){}
      }
      else { try{ shuffledOrderCache = null; }catch(_eCache){} }
      try{ var b = $('shuffleBtn'); if(b) b.classList.toggle('active', shuffle); }catch(_eBtn){}
      try{ savePlaybackState(true); }catch(_eSave){}
      try{ renderList(); }catch(_eList){}
      return true;
    }catch(_eShuffle){ return false; }
  };
  window.__scRepeatMode = function(){ return String(repeatMode || 'off'); };
  window.__scSetRepeat = function(mode){
    try{
      var m = String(mode || 'off');
      if(['off', 'one', 'all'].indexOf(m) === -1) return false;
      repeatMode = m;
      try{ var rb = $('repeatBtn'); if(rb) rb.classList.toggle('active', repeatMode !== 'off'); }catch(_eBtn2){}
      try{ savePlaybackState(true); }catch(_eSave2){}
      return true;
    }catch(_eRepeat){ return false; }
  };
  // "play my Night Drive" - the playlist opens as itself, so the queue is that
  // playlist and the next song is the next song in it, exactly like tapping it.
  window.__scPlayPlaylist = function(name){
    try{
      if(!name || !playlists[name]) return false;
      var ids = (playlists[name] || []).slice();
      if(!ids.length) return false;
      activePlaylist = name;
      renderTabs();
      renderList();
      playTrackInPlaylistContext(ids[0]);
      return true;
    }catch(_ePlayList){ return false; }
  };
"""



KB_OLD = """    var entry = _aiFuzzyMatch(String(q || ''));"""
KB_NEW = """    // 75.1.2 - the drawer only takes a knowledge-base answer that actually matched.
    // The matcher's floor is 35 and a single shared word scores 40, so "flibbertigibbet
    // the garden hose" came back as a confident answer about the converter. 60 keeps an
    // exact question, a substring and real word overlap, and lets a sentence the app
    // does not know fall through to the honest list instead.
    var entry = _aiFuzzyMatch(String(q || ''), 60);"""


def main():
    src = open(PAGE, encoding='utf-8').read()
    before = src
    problems = []

    def once(anchor, name):
        n = src.count(anchor)
        if n != 1:
            problems.append('%s: expected 1, found %d' % (name, n))
            return False
        return True

    # 1. helpers + follow-ups + verbs, inserted after askAlbumNames()
    if 'function askVerb(raw, low)' not in src:
        if once(HELPERS_ANCHOR, 'askAlbumNames tail'):
            src = src.replace(HELPERS_ANCHOR, HELPERS, 1)

    # 2. follow-up first in planFor
    if 'var follow = askFollow(raw, low);' not in src:
        if once(FOLLOW_ANCHOR, 'planFor empty-sentence line'):
            src = src.replace(FOLLOW_ANCHOR, FOLLOW, 1)

    # 3. the fallback, spliced from its comment line to the end of planFor
    if 'var verb = askVerb(raw, low);' not in src:
        i = src.find(FALLBACK_START)
        j = src.find(FALLBACK_END)
        if i < 0 or j < 0 or j < i:
            problems.append('the planFor fallback is not where it was')
        else:
            end = src.find('\n    }\n', j)
            if end < 0:
                problems.append('the end of planFor is not where it was')
            else:
                src = src[:i] + FALLBACK.rstrip('\n') + src[end:]

    # 4. runPlan: bookkeeping, the new step kinds, the shared undo
    if 'touchedPlaylist' not in src:
        if once(RUN_ANCHOR, 'runPlan album snapshot'):
            src = src.replace(RUN_ANCHOR, RUN_ADD, 1)
    if 'touchedPlaylist = st.name;' not in src:
        if once(PLAYLIST_STEP_OLD, 'runPlan playlist step'):
            src = src.replace(PLAYLIST_STEP_OLD, PLAYLIST_STEP_NEW, 1)
    if "if(st.kind === 'play'){" not in src:
        if once(NEW_KINDS_ANCHOR, 'runPlan action step'):
            src = src.replace(NEW_KINDS_ANCHOR, NEW_KINDS, 1)
    if 'kinds.push(st.kind);' not in src:
        if once(KINDS_PUSH_OLD, 'runPlan step loop head'):
            src = src.replace(KINDS_PUSH_OLD, KINDS_PUSH_NEW, 1)
    if 'var undoAll = function(){' not in src:
        if once(UNDO_OLD, 'runPlan toast'):
            src = src.replace(UNDO_OLD, UNDO_NEW, 1)
    if 'undoAll);' not in src:
        if once(UNDO_TAIL_OLD, 'runPlan undo tail'):
            src = src.replace(UNDO_TAIL_OLD, UNDO_TAIL_NEW, 1)

    # 5. two more chips
    if 'data-scai-chip="how many songs do I have"' not in src:
        if once(CHIPS_OLD, 'the drawer chips'):
            src = src.replace(CHIPS_OLD, CHIPS_NEW, 1)

    # 6. page hooks
    if 'window.__scPlayPlaylist' not in src:
        if once(HOOK_ANCHOR, 'window.__scResume'):
            src = src.replace(HOOK_ANCHOR, HOOKS, 1)

    # 7. the knowledge-base answer has to be a real match
    if "var entry = _aiFuzzyMatch(String(q || ''), 60);" not in src:
        if once(KB_OLD, 'the Ask knowledge-base lookup'):
            src = src.replace(KB_OLD, KB_NEW, 1)

    if problems:
        print('patch-7512-ask: ' + '; '.join(problems))
        return 1

    changed = src != before
    if CHECK:
        print('patch-7512-ask --check: ' + ('already applied' if not changed else 'NOT applied yet'))
        return 0 if not changed else 1
    if changed:
        open(PAGE, 'w', encoding='utf-8').write(src)
        print('patch-7512-ask: the drawer reads the rest of the sentence')
    else:
        print('patch-7512-ask: already applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
