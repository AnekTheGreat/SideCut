#!/usr/bin/env python3
"""v60.4b — the two DJ-mode poll loops that ran at vsync from the moment the app
started, DJ mode open or not.

vuLoop() and djAutoCrossfadeWatcher() both began at boot and both re-requested an
animation frame unconditionally, checking `#djModeBackdrop` and returning. That is
two frame callbacks per vsync for ever (measured: 187 in 1.5 s with DJ mode shut),
which is the same "the page never goes idle" cost the RGB loops were charging — and
it is charged on every launch, on every theme. While DJ mode is closed they now
re-check from a timer; inside DJ mode nothing changes, they still run per frame.
"""
import io, sys

p = 'index.html'
src = io.open(p, encoding='utf-8').read()


def rep(label, old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit('ANCHOR FAIL %s: expected %d, found %d\n---\n%s' % (label, count, n, old[:400]))
    src = src.replace(old, new, count)
    print('ok  ' + label)


rep('vuLoop', '''  function vuLoop(){
    if($('djModeBackdrop').style.display !== 'flex'){ requestAnimationFrame(vuLoop); return; }
    ensureVUAnalyser();''', '''  function vuLoop(){
    // Only DJ mode draws a VU meter, so only DJ mode should pay for one. This used
    // to re-request an animation frame for ever — DJ mode open or closed — so from
    // the moment the app started, on any theme, the page produced a frame every
    // vsync for a meter that was not on screen. Closed, it now re-checks on a timer
    // (and half as often again while the app is not being looked at).
    if($('djModeBackdrop').style.display !== 'flex'){ setTimeout(vuLoop, document.hidden ? 2000 : 500); return; }
    ensureVUAnalyser();''')

rep('djAutoCrossfadeWatcher', '''  function djAutoCrossfadeWatcher(){
    if($('djModeBackdrop').style.display !== 'flex'){ requestAnimationFrame(djAutoCrossfadeWatcher); return; }''', '''  function djAutoCrossfadeWatcher(){
    // Same as the VU loop above: while DJ mode is closed there is nothing to watch,
    // so it waits on a timer instead of claiming a frame every vsync for the whole
    // time the app is open.
    if($('djModeBackdrop').style.display !== 'flex'){ setTimeout(djAutoCrossfadeWatcher, document.hidden ? 2000 : 500); return; }''')

io.open(p, 'w', encoding='utf-8').write(src)
print('\npatched index.html')
