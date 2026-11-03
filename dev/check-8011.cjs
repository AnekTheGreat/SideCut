#!/usr/bin/env node
// 80.11 - the laptop desk, and the album chooser named as another way in.
//
// Static: the version, the three notes (through the updater's own filter, with the
// streamed-song framing the owner asked for), the repaired .pane-header rule, the desk
// rung's placement and contents, that it carries no !important, and both OTA bundles.
// Driven: the desk and the ten-foot tail are extracted from the stylesheet by counting
// braces from their own headers (and the extraction is proven by where it lands), then
// their media conditions are evaluated at phone, tablet, laptop and big-monitor widths.
// So this proves which widths the new declarations can reach rather than grepping for a
// number: nothing of the desk applies at 390, 800 or 900; all of it applies at 1024 and
// 1280; none of it applies at 1920, where the ten-foot rung and the tail do.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
const failed = [];
function ok(cond, msg) {
  if (cond) { passed++; return; }
  failed.push(msg);
}
function between(a, b, from) {
  const i = html.indexOf(a, from || 0);
  if (i < 0) throw new Error('missing anchor: ' + a);
  const j = html.indexOf(b, i + a.length);
  if (j < 0) throw new Error('missing end anchor: ' + b);
  return html.slice(i, j);
}
const count = (s, needle) => s.split(needle).length - 1;

// ── the version ──────────────────────────────────────────────────────────────
ok(count(html, "const APP_VERSION = '80.11';") === 1, 'the page says 80.11, once');
ok(count(html, "const APP_VERSION = '80.10';") === 0, 'and no longer says 80.10');

// ── the notes, through the updater's own filter ──────────────────────────────
const entry = between("{ version: '80.11',", "{ version: '80.10',");
const notes = entry.match(/'\[FULL\] ([^']*)'/g) || [];
ok(notes.length === 3, 'three notes ship with this release, not ' + notes.length);
const DROP = /streaming|streams?\b|from the source|pinned artist/i;
const texts = notes.map((n) => n.replace(/^'\[FULL\] /, '').replace(/'$/, ''));
texts.forEach((text, i) => {
  ok(!DROP.test(text), 'note ' + (i + 1) + ' survives the updater filter');
  ok(text.indexOf("'") === -1, 'note ' + (i + 1) + ' carries no apostrophe');
});
ok(/streamed song/.test(texts[0]) && /library/.test(texts[0]),
  'the first note names the album chooser as another way into your library, through a streamed song');
ok(/laptop/.test(texts[1]) && /laptop/.test(texts[2]), 'the other two notes are the laptop');
ok(/title: 'A laptop you can read/.test(entry), 'the title names the laptop');

// ── the head stylesheet, whole ──────────────────────────────────────────────
const headHtml = html.slice(0, html.indexOf('</head>'));
const sheetBlocks = headHtml.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
const css = sheetBlocks
  .map((b) => b.replace(/^<style[^>]*>/, '').replace(/<\/style>$/, ''))
  .join('\n');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok(sheetBlocks.length >= 3, 'the head carries its stylesheets (' + sheetBlocks.length + ')');
ok((bare.match(/\{/g) || []).length === (bare.match(/\}/g) || []).length,
  'every block the head stylesheet opens, it closes - the stray brace is gone');

// ── the repaired .pane-header rule ──────────────────────────────────────────
const phAt = css.indexOf('.pane-header{\n');
const ph = phAt >= 0 ? css.slice(phAt, css.indexOf('}', phAt) + 1) : '';
ok(ph.length > 0, 'the pane header rule is found');
ok(ph.includes('min-width:0; overflow:hidden;'),
  'the pane header carries min-width and overflow again, so a long name cannot widen the page');
ok(!/  \}\n\s*\/\* A long playlist name/.test(css),
  'and the rule no longer closes before that comment, so its declarations are inside it');

// ── extract a media block by counting from its own header ───────────────────
function mediaBlock(header) {
  const at = css.lastIndexOf(header);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  let depth = 1;
  let i = open + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return { header: header.replace(/^@media\s*/, '').replace(/\{$/, '').trim(), body: css.slice(open + 1, i - 1), start: at, end: i };
}
const DESK = mediaBlock('@media (min-width:1024px) and (max-width:1799px){');
const TAIL = mediaBlock('@media (min-width:1800px) and (min-height:900px), (min-width:2400px){');
ok(!!DESK, 'the laptop rung is in the stylesheet');
ok(!!TAIL, 'the tail above it is too');
ok(DESK.header === '(min-width:1024px) and (max-width:1799px)', 'the laptop rung is really bounded: ' + (DESK && DESK.header));
// Between the two rungs there is only whitespace and the comment that explains
// the tail; anything else would mean a brace was miscounted.
const gap = css.slice(DESK.end, TAIL.start).replace(/\/\*[\s\S]*?\*\//g, '');
ok(gap.trim() === '' && TAIL.start > DESK.end,
  'the extraction lands exactly where the rungs meet, so the braces were counted right');
ok(DESK.start > css.indexOf('@media (min-width:1440px){'), 'it is written after the 1440 rung');
ok(DESK.start > css.indexOf('@media (min-width:1800px) and (min-height:900px)'),
  'and after the ten-foot rung, so nothing it declares is overwritten later');
ok(count(DESK.body, '!important') === 0, 'it uses no !important, so a more specific theme or sandbox rule still wins');

// ── driven: what each width can reach ──────────────────────────────────────
function mediaHolds(media, w) {
  return media.split(',').some((alt) => alt.split(/\s+and\s+/).every((c) => {
    const m = c.match(/\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)/);
    if (!m) return true; // height and orientation are not what this release changes
    return m[1] === 'min' ? w >= +m[2] : w <= +m[2];
  }));
}
function decl(block, prop) {
  if (!block) return null;
  const m = new RegExp('(?:^|;|\\n)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(block);
  return m ? m[1].trim() : null;
}
function ruleIn(blockBody, selector) {
  const at = blockBody.indexOf(selector + '{');
  if (at < 0) return null;
  return blockBody.slice(at + selector.length + 1, blockBody.indexOf('}', at) + 1);
}
function val(which, selector, prop) {
  const inner = which === 'desk' ? DESK.body : TAIL.body;
  return decl(ruleIn(inner, selector), prop);
}

// a phone and a tablet cannot reach any of it
[390, 800, 900, 1023].forEach((w) => {
  ok(!mediaHolds(DESK.header, w), 'driven: at ' + w + ' not one line of the laptop rung applies');
});
ok(mediaHolds('(min-width:768px)', 800) && !mediaHolds(DESK.header, 800),
  'driven: a tablet still gets its own rung and not the laptop one');
ok(!mediaHolds(TAIL.header, 1280), 'driven: and the tail above starts where the laptop rung stops');

// a laptop is what changed
[1024, 1280, 1440, 1799].forEach((w) => {
  ok(mediaHolds(DESK.header, w), 'driven: at ' + w + ' the laptop rung applies');
});
ok(mediaHolds(DESK.header, 1280) && !mediaHolds(DESK.header, 1800),
  'driven: 1280 gets the laptop rung, 1800 does not');
ok(val('desk', '.track-info .t', 'font-size') === '15.5px', 'driven: a laptop row title is 15.5px');
ok(val('desk', '.track-info .a', 'font-size') === '13px', 'driven: its artist line 13px');
ok(val('desk', '.pane-header h2', 'font-size') === '21px', 'driven: the list heading is 21px');
ok(val('desk', '#npInfo .t', 'font-size') === '17px', 'driven: the player title is 17px');
ok(val('desk', '.action-pill', 'font-size') === '14.5px', 'driven: the dock pill is 14.5px');
ok(val('desk', '#tabs .tab', 'font-size') === '13.5px', 'driven: a tab is 13.5px');
ok(val('desk', '.track', 'padding') === '14px 26px', 'driven: a row is given more room');
ok(val('desk', '.track-art', 'width') === '56px', 'driven: and its art');
ok(val('desk', '#library', 'max-width') === '1040px', 'driven: the library keeps a 1040px measure');
ok(val('desk', '#homeBubbles', 'max-width') === '1120px', 'driven: the bubble wall is capped at 1120px');
ok(val('desk', '.modal', 'max-width') === '600px', 'driven: a dialog gets 600px');
const floatRule = ruleIn(DESK.body, 'body:not(.sc80-cloud) #nowPlaying');
ok(decl(floatRule, 'left') === '24px' && decl(floatRule, 'right') === '24px' && decl(floatRule, 'bottom') === '16px',
  'driven: the player floats off the edges instead of filling the bottom of the window');
ok(decl(floatRule, 'border-radius') === '22px', 'driven: as a rounded card');
ok(decl(floatRule, 'box-shadow') !== null, 'driven: with a shadow to sit on');
ok(mediaHolds(DESK.header, 1280), 'driven: and a 1280 window is one of the widths that gets it');
const scoped = (DESK.body.match(/body:not\(\.sc80-cloud\)[^{]*/g) || []).map((s) => s.trim());
ok(scoped.length > 0 && scoped.every((s) => /^body:not\(\.sc80-cloud\) (#nowPlaying|#miniBar)/.test(s)),
  'driven: every cloud-sensitive rule in the rung is the player, and nothing else: ' + JSON.stringify(scoped));
ok(DESK.body.indexOf('.sc80-cloud #nowPlaying') === -1, 'driven: the cloud layout bar is never restyled');

// a big monitor keeps the ten-foot rung, now with the rows finished
ok(mediaHolds(TAIL.header, 1920) && mediaHolds(TAIL.header, 2400), 'driven: the tail covers 1920 and 2400');
ok(val('tail', '.track-info .t', 'font-size') === '17px', 'driven: past 1800 a row title grows to 17px, never shrinks');
ok(val('tail', '.track-info .a', 'font-size') === '14px', 'driven: and its artist line');
ok(val('tail', '#library', 'max-width') === '1200px', 'driven: and the library keeps a measure there too');

// ── every inline script still compiles ─────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc8011-'));
const scripts = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
  if (/\bsrc\s*=/.test(m[1])) continue;
  if (!m[2].trim()) continue;
  scripts.push(m[2]);
}
ok(scripts.length >= 5, 'the page carries its inline scripts (' + scripts.length + ')');
scripts.forEach((src, i) => {
  const f = path.join(tmp, 'script-' + i + '.js');
  fs.writeFileSync(f, src);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    ok(false, 'inline script ' + i + ' compiles: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' '));
  }
});
ok(true, 'all ' + scripts.length + ' inline scripts compile');

// ── both bundles ────────────────────────────────────────────────────────────
function zipEntry(zip, name) {
  return execFileSync('unzip', ['-p', zip, name], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
}
['ota', 'ota-play'].forEach((dir) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'updates.json'), 'utf8'));
  const zip = path.join(ROOT, dir, 'update.zip');
  ok(manifest.version === '80.11', dir + ': the bundle is 80.11');
  ok(manifest.size === fs.statSync(zip).size, dir + ': its recorded size is the zip');
  const inner = zipEntry(zip, 'index.html');
  ok(inner.includes("const APP_VERSION = '80.11';"), dir + ': the zip carries the 80.11 page');
  ok(inner.includes('80.11: THE LAPTOP DESK'), dir + ': with the laptop desk');
});

console.log('check-8011: ' + passed + ' passed, ' + failed.length + ' failed');
failed.forEach((f) => console.log('  x ' + f));
process.exit(failed.length ? 1 : 0);
