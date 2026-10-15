  console.log('[6g] a re-encode really runs: the encoders can reach what they call');
  {
    // 74.1.8, from the owner's phone: "Re-encode failed: scBackSliceMul is not
    // defined" - on every song, at every rate, from the moment 74.1.7 shipped.
    //
    // 74.1.7 added the hidden-slice multiplier to the Studio module's <script> while
    // the two encoders that read it live in the app's own <script>. A bare identifier
    // is resolved lexically, in the scope of the function that USES it, never in the
    // scope of whichever block published a reference to it, so both encoders threw -
    // and they threw on the FIRST block of the loop, because the slice test is
    // `Date.now() - sliceStart >= SC_ENCODE_SLICE_MS * scBackSliceMul()` and `>=`
    // evaluates both sides.
    //
    // IT SHIPPED GREEN, AND THAT IS THE PART WORTH DRIVING. [6f] ran the job with
    // win.__scEncodeMp3 STUBBED, so the real encoder never ran, and its question about
    // the multiplier went through SC70.backSliceMul() - the module's own copy, which
    // was defined and answered correctly. The gate asked the module about itself. So
    // this block asks the page three questions instead, in order of how general they
    // are, and the last one runs the real encoder with nothing stubbed but lamejs -
    // the CDN script jsdom never loads, the same stand-in the phone's own engine is.

    // (1) THE GENERAL READING OF THE RULE: no script block may call an sc-prefixed
    // helper that only another block defines. This is what a scope bug looks like from
    // outside, it needs no list of names to keep up to date, and on 74.1.7 it named
    // scBackSliceMul and nothing else in the whole 3.2 MB page.
    const blockRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
    const scripts = [];
    let bm;
    while ((bm = blockRe.exec(html))) {
      if (/\bsrc=/.test(bm[1])) continue;
      scripts.push({ at: html.slice(0, bm.index).split('\n').length, src: bm[2] });
    }
    ok(scripts.length >= 3,
      'the page still boots from its own inline scripts (' + scripts.length + ' blocks)');
    const scNames = (text, kind) => {
      const set = new Set();
      let d;
      const re = kind === 'def'
        ? /\bfunction\s+(sc[A-Za-z0-9_]*)\s*\(|\b(?:var|let|const)\s+(sc[A-Za-z0-9_]*)\s*=/g
        : /(?<![.\w$])(sc[A-Z][A-Za-z0-9_]*)\s*\(/g;
      while ((d = re.exec(text))) set.add(d[1] || d[2]);
      return set;
    };
    const definedHere = scripts.map((s) => scNames(s.src, 'def'));
    const known = new Set();
    definedHere.forEach((names) => names.forEach((n) => known.add(n)));
    const cross = [];
    scripts.forEach((s, i) => {
      scNames(s.src, 'call').forEach((n) => {
        // A name nothing defines is not this rule's business: it is a browser global,
        // a parameter, or something a CDN script brings.
        if (definedHere[i].has(n) || !known.has(n)) return;
        cross.push(n + ' (called near line ' + s.at + ')');
      });
    });
    ok(cross.length === 0,
      'no script block calls an sc-helper that only another block defines (' +
      (cross.join(', ') || 'none') + ')');
    const encoderBlock = scripts.filter((s) => s.src.indexOf('SC_ENCODE_SLICE_MS * scBackSliceMul()') !== -1)[0];
    ok(!!encoderBlock && scNames(encoderBlock.src, 'def').has('scBackSliceMul'),
      'and the sliced encoders have the slice multiplier in their own block');
    ok(/window\.__scBackSliceMul = scBackSliceMul;/.test(html),
      'the app publishes it on the window, the way it publishes __scEncodeMp3');

    // (2) THE PUBLISHED FUNCTION IS THE REAL ONE. Not "a function exists here" and not
    // "the value agrees": the Studio's copy is asked to prove it goes through the app's
    // function at CALL time, which is the difference between sharing one and keeping a
    // second copy that can drift.
    // Every call below is guarded on the function EXISTING first: on 74.1.7 it does
    // not, and a probe that calls it anyway throws out of the whole suite - which would
    // cost the reader the eleven blocks after this one, and turn a red into a crash.
    const realMul = win.__scBackSliceMul;
    const haveMul = typeof realMul === 'function';
    ok(haveMul, 'the app publishes the hidden-slice rule');
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => true });
    ok(haveMul && realMul() === 3, 'hidden, one wake-up does three slices of work');
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => false });
    ok(haveMul && realMul() === 1, 'visible, a slice is the 90ms the screen cannot tell apart');
    let asked = 0;
    win.__scBackSliceMul = function () { asked++; return 1; };
    const viaStudio = typeof win.SC70.backSliceMul === 'function' ? win.SC70.backSliceMul() : null;
    win.__scBackSliceMul = realMul;
    ok(viaStudio === 1 && asked === 1,
      'and the Studio asks the app for it every time, so the two cannot drift apart (' + asked + ')');

    // (3) A RE-ENCODE THAT REALLY RUNS. Only lamejs is stood in for, because jsdom does
    // not load the CDN script - everything else is the app's own: its decoder, its
    // cooperative block loop, its slice boundary, its job record, its Web Lock path and
    // its file swap. On 74.1.7 this is where the phone's own message appears, on the
    // toast, word for word.
    const all = win.__scGetAllTracks().filter((t) => t.file && t.file.size && t.duration);
    const victim = all.slice().sort((a, b) => b.file.size - a.file.size)[0];
    ok(!!victim, 'a song to compress');
    const oldFile = victim.file, oldDuration = victim.duration;
    const toastEl = doc.getElementById('toast');
    if (toastEl) toastEl.textContent = '';
    // A 4 MB file that says it is 2:37 - 214 kbps - so 128 wins space back.
    victim.file = new win.Blob([new win.Uint8Array(4194304)], { type: 'audio/mpeg' });
    victim.duration = 157;
    const askedFor = [];
    win.lamejs = {
      Mp3Encoder: function (ch, sr, kbps) {
        askedFor.push(kbps);
        this.encodeBuffer = function () { return new win.Int8Array([1, 2, 3, 4]); };
        this.flush = function () { return new win.Int8Array([5, 6]); };
      },
    };
    win.SC70.renderStudio();
    let threw = null;
    try {
      await win.SC70.pickRate(victim.id, 128);
    } catch (e) {
      threw = String((e && e.message) || e);
    }
    await wait(200);
    const said = toastEl ? toastEl.textContent : '';
    ok(said.indexOf('Re-encode failed') === -1,
      'a re-encode through the real encoder does not report a failure (' + (said || 'nothing said') + ')');
    ok(threw === null, 'and nothing was thrown out of it (' + (threw || 'no throw') + ')');
    ok(askedFor.length === 1 && askedFor[0] === 128,
      'the real encoder ran, at the rate that was asked for (' + askedFor.join(',') + ')');
    ok(victim.reencoded === true && victim.file !== oldFile,
      'the smaller file really replaced the one the song held');
    ok(String(win.localStorage.getItem('sidecut_encodeJob')) === 'null',
      'the job record is cleared, so a finished run is not left looking killed');
    ok(!win.SC70.encodeJob() && !doc.querySelector('#studioView [data-job]'),
      'and no strip is left behind for a run that is over');

    delete win.lamejs;
    win.SC70.undoReencode(victim.id);
    victim.file = oldFile;
    victim.duration = oldDuration;
    win.SC70.renderStudio();
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => false });
  }

