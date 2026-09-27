#!/usr/bin/env node
// SideCut - every reference to a name the app never declares.
//
// The bug this exists for: `updateNpDisplay(cur)` was called from two batch jobs
// and DEFINED NOWHERE, so both ended in a red "updateNpDisplay is not defined"
// banner. Nothing in the suite could see it — the syntax was valid, and the
// gates read strings, not scopes.
//
// This parses every inline <script> block with acorn (already a dependency) and
// walks the AST, so it sees real scopes instead of text. It reports every
// identifier that is READ but never DECLARED anywhere in the file and is not on
// the platform allowlist below — which is exactly a ReferenceError waiting to
// happen at the moment that line runs.
//
// It also checks a second fault the same way, because it is the same fault seen
// from the other side: a LOST LINE BREAK. A `//` comment runs to the end of its
// line, so a patch that joins two lines with a space turns everything after the
// first `//` into comment text. index.html stayed syntactically valid while
// openShareCodeModal() and copyTextToClipboard() were deleted that way (see
// dev/patch-663.mjs). The signature is exact and has no false positives: an
// inner `//` can only appear inside a line comment if two lines were glued
// together (a URL's `//` is preceded by ":", not by whitespace).
//
//   node dev/audit-calls.mjs            # report (exit 1 if anything is found)
//   node dev/audit-calls.mjs --list     # also list every declared name count
//
// Deliberate limits, stated so a pass is not over-read:
//   * it does not model `typeof X === 'undefined'` guards (they read a name that
//     may not exist, which is legal and intended) — those are listed separately
//     and are NOT failures;
//   * it does not follow a name's TYPE, only whether it is declared at all, so
//     it cannot see a method that does not exist on an object it cannot infer;
//   * a name reached only through `window.X` is declared by the assignment, so
//     anything genuinely missing shows up here as an unresolved read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const LIST = process.argv.includes('--list');
const src = fs.readFileSync(HTML, 'utf8');

// ---- everything the platform itself provides ------------------------------
// Anything the app may legitimately use without declaring it. Kept generous on
// purpose: a false "failure" is worse than a miss here, because the point is to
// find APP names, not to re-derive the Web platform.
const PLATFORM = new Set([
  // globals / language
  'globalThis', 'undefined', 'NaN', 'Infinity', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Symbol', 'BigInt', 'Math', 'JSON', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError',
  'SyntaxError', 'EvalError', 'URIError', 'AggregateError', 'Promise', 'Proxy', 'Reflect', 'Map',
  'WeakMap', 'Set', 'WeakSet', 'WeakRef', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Int8Array',
  'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'Function', 'arguments', 'eval',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'escape', 'unescape', 'structuredClone', 'queueMicrotask', 'atob', 'btoa',
  'Intl', 'AbortController', 'AbortSignal', 'TextEncoder', 'TextDecoder', 'TextDecoderStream',
  'ReadableStream', 'WritableStream', 'TransformStream', 'Blob', 'File', 'FileReader', 'FormData',
  'URL', 'URLSearchParams', 'ImageData', 'ImageBitmap', 'OffscreenCanvas', 'Path2D', 'DOMMatrix',
  'AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'AudioBuffer', 'GainNode', 'BiquadFilterNode',
  'DOMException', 'Event', 'EventTarget', 'CustomEvent', 'MessageChannel', 'MessagePort', 'Proxy',
  // window / document / DOM
  'window', 'self', 'document', 'navigator', 'location', 'history', 'screen', 'frames', 'parent', 'top',
  'console', 'alert', 'confirm', 'prompt', 'fetch', 'Request', 'Response', 'Headers', 'XMLHttpRequest',
  'WebSocket', 'Worker', 'SharedWorker', 'ServiceWorker', 'Notification', 'ClipboardEvent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'getSelection', 'matchMedia', 'scroll',
  'scrollTo', 'scrollBy', 'open', 'close', 'focus', 'blur', 'print', 'stop', 'getComputedStyle',
  'postMessage', 'localStorage', 'sessionStorage', 'indexedDB', 'IDBKeyRange', 'caches', 'origin',
  'CSS', 'customElements', 'performance', 'crypto', 'MediaMetadata', 'MediaSession', 'MediaSessionAction',
  'Audio', 'Image', 'Option', 'HTMLElement', 'EventSource', 'ResizeObserver', 'IntersectionObserver',
  'MutationObserver', 'SpeechSynthesisUtterance', 'speechSynthesis', 'visualViewport', 'devicePixelRatio',
  'innerWidth', 'innerHeight', 'outerWidth', 'outerHeight', 'scrollX', 'scrollY', 'pageXOffset', 'pageYOffset',
  'name', 'status', 'length', 'closed', 'opener', 'isSecureContext', 'matchMedia',
  'CanvasRenderingContext2D', 'WebGLRenderingContext', 'FontFace', 'FileReaderSync', 'DOMParser',
  // Capacitor / Cordova plugins and the libs the page loads with <script src>
  'Capacitor', 'cordova', 'plugins', 'JSZip', 'lamejs', 'CapacitorUpdater', 'NativePurchases',
  'NativeAudio', 'StatusBar', 'SplashScreen', 'Device', 'App', 'Keyboard', 'Haptics', 'Share',
  'Filesystem', 'Clipboard', 'InAppBrowser', 'SwipeBack', 'FrameCallback',
  // names the second <script> block, an inline onclick, or a stylesheet reaches
  'webkit', 'msIndexedDB', 'mozIndexedDB', 'indexedDB',
  // more platform names the app legitimately uses without declaring them
  'Storage', 'Element', 'Node', 'NodeList', 'HTMLInputElement', 'HTMLAudioElement', 'HTMLVideoElement',
  'HTMLCanvasElement', 'HTMLDivElement', 'HTMLImageElement', 'HTMLAnchorElement', 'HTMLElement',
  'MediaRecorder', 'MediaStream', 'MediaStreamTrack', 'MediaSource', 'DecompressionStream',
  'CompressionStream', 'DataTransfer', 'DataTransferItem', 'DataTransferItemList', 'DragEvent',
  'PointerEvent', 'TouchEvent', 'KeyboardEvent', 'InputEvent', 'ClipboardItem', 'Notification',
  'GainNode', 'StereoPannerNode', 'AnalyserNode', 'DynamicsCompressorNode', 'ConvolverNode',
  'ChannelSplitterNode', 'ChannelMergerNode', 'DelayNode', 'WaveShaperNode', 'IIRFilterNode',
  'ConstantSourceNode', 'OscillatorNode', 'PannerNode', 'PeriodicWave', 'MediaElementAudioSourceNode',
  'MediaStreamAudioSourceNode', 'MediaStreamAudioDestinationNode', 'ScriptProcessorNode',
  'reportError', 'find', 'ActiveXObject',
]);

const DECLARED = new Set();
const READS = new Map();      // name -> [{ line, kind }]
const TYPEOF_GUARDED = new Map();
const LINE_COMMENTS = [];     // // comments, for the lost-line-break check
let blocks = 0;

function addRead(name, line, kind, typeofGuarded) {
  const map = typeofGuarded ? TYPEOF_GUARDED : READS;
  if (!map.has(name)) map.set(name, []);
  map.get(name).push({ line, kind });
}

function declarePattern(node) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier': DECLARED.add(node.name); break;
    case 'ObjectPattern': node.properties.forEach((p) => declarePattern(p.value || p.argument || p)); break;
    case 'ArrayPattern': node.elements.forEach(declarePattern); break;
    case 'AssignmentPattern': declarePattern(node.left); break;
    case 'RestElement': declarePattern(node.argument); break;
    default: break;
  }
}

// ---- walk ------------------------------------------------------------------
// A hand-rolled walker: this only needs every node, not scope-accurate
// resolution, because the file is one page and the check is "is this name
// declared ANYWHERE".
function walk(node, parent, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) { for (const c of value) if (c && typeof c.type === 'string') walk(c, node, visit); }
    else if (value && typeof value.type === 'string') walk(value, node, visit);
  }
}

// Line number for an absolute source offset. The obvious
// `src.slice(0, pos).split('\n').length` is O(n) per call, and this walk asks
// for a line on every identifier in a ~2.5 MB page — that is quadratic and
// used to take minutes. One pass over the file up front, then binary search.
const LINE_STARTS = [0];
for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) LINE_STARTS.push(i + 1);
function lineAt(pos) {
  let lo = 0;
  let hi = LINE_STARTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (LINE_STARTS[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function lineOf(node) {
  return lineAt(node.start);
}

const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = scriptRe.exec(src))) {
  if (/\bsrc\s*=/.test(m[1])) continue;
  const body = m[2];
  if (!body.trim()) continue;
  blocks++;
  const offset = m.index + m[0].indexOf('>') + 1;
  let ast;
  try {
    ast = acorn.parse(body, {
      ecmaVersion: 2022, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true,
      onComment: (isBlock, text, start) => { if (!isBlock) LINE_COMMENTS.push({ text, at: offset + start }); },
    });
  } catch (e) {
    console.error('PARSE FAILURE in a script block: ' + e.message);
    process.exit(1);
  }
  const lineInBlock = (node) => lineAt(offset + node.start);

  walk(ast, null, (node, parent) => {
    switch (node.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (node.id) DECLARED.add(node.id.name);
        node.params.forEach(declarePattern);
        if (node.type === 'FunctionExpression' && node.id) DECLARED.add(node.id.name);
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (node.id) DECLARED.add(node.id.name);
        break;
      case 'VariableDeclarator':
        declarePattern(node.id);
        break;
      case 'CatchClause':
        declarePattern(node.param);
        break;
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
      case 'ImportSpecifier':
        if (node.local) DECLARED.add(node.local.name);
        break;
      case 'AssignmentExpression': {
        // `window.foo = ...` (and `globalThis.foo = ...`) IS a declaration of
        // `foo` for every consumer in the page: that is how this file exposes a
        // whole IIFE's internals to the second <script> block and to inline
        // handlers, and calling `foo()` afterwards is correct, not a bug.
        const L = node.left;
        if (L && L.type === 'MemberExpression' && !L.computed && L.property && L.property.type === 'Identifier' &&
            L.object && L.object.type === 'Identifier' && (L.object.name === 'window' || L.object.name === 'globalThis')) {
          DECLARED.add(L.property.name);
        }
        declarePattern(L && L.type === 'Identifier' ? L : null);
        break;
      }
      case 'Property':
        // `{ foo: 1 }` where the key is an identifier is NOT a read
        break;
      case 'LabeledStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        break;
      default:
        break;
    }
  });

  walk(ast, null, (node, parent) => {
    if (node.type !== 'Identifier') return;
    if (parent) {
      if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
      if (parent.type === 'Property' && parent.key === node && !parent.computed) return;
      if (parent.type === 'VariableDeclarator' && parent.id === node) return;
      if ((parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' ||
           parent.type === 'ArrowFunctionExpression' || parent.type === 'ClassDeclaration' ||
           parent.type === 'ClassExpression') && parent.id === node) return;
      if (parent.type === 'CatchClause' && parent.param === node) return;
      if (parent.type === 'UnaryExpression' && parent.operator === 'typeof') {
        addRead(node.name, lineInBlock(node), 'typeof', true);
        return;
      }
      if ((parent.type === 'AssignmentExpression' || parent.type === 'AssignmentPattern') && parent.left === node) {
        // A bare `x = 1` with no declaration is an implicit global: it does not
        // throw, so it is reported apart from a genuine missing reference.
        return;
      }
      if (parent.type === 'ObjectPattern' || parent.type === 'ArrayPattern' || parent.type === 'RestElement') return;
      if ((parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' ||
           parent.type === 'ImportNamespaceSpecifier') && parent.local === node) return;
      if (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' ||
          parent.type === 'ArrowFunctionExpression') {
        if (parent.params.includes(node)) return;
      }
      if (parent.type === 'LabeledStatement' && parent.label === node) return;
    }
    const isCallee = node.type === 'Identifier';
    addRead(node.name, lineInBlock(node), 'read', false);
  });
}

// ---- report ----------------------------------------------------------------
const unresolved = [];
for (const [name, uses] of READS) {
  if (DECLARED.has(name) || PLATFORM.has(name)) continue;
  unresolved.push({ name, uses });
}
unresolved.sort((a, b) => b.uses.length - a.uses.length);

if (LIST) {
  console.log('declared names: ' + DECLARED.size + ', script blocks: ' + blocks);
}

const guarded = [...TYPEOF_GUARDED.keys()].filter((n) => !DECLARED.has(n) && !PLATFORM.has(n));

// A line comment that swallowed the rest of a joined line: it carries an inner
// "//" that whitespace precedes, and code-like punctuation follows it.
const swallowed = LINE_COMMENTS
  .filter((c) => /\s\/\//.test(c.text) && /[;{}]/.test(c.text.slice(c.text.search(/\s\/\//))))
  .map((c) => ({ line: lineAt(c.at), text: c.text }));

const failed = unresolved.length > 0 || swallowed.length > 0;

if (unresolved.length) {
  console.error('audit-calls: ' + unresolved.length + ' UNDECLARED name(s) are read by the app:');
  for (const { name, uses } of unresolved) {
    console.error('  ' + name + '  (' + uses.length + ' reference' + (uses.length === 1 ? '' : 's') +
      ', first at line ' + uses[0].line + ')');
    for (const u of uses.slice(0, 4)) console.error('      line ' + u.line);
  }
  if (guarded.length) console.error('  (typeof-guarded, not declared, legal: ' + guarded.join(', ') + ')');
}

if (swallowed.length) {
  console.error('audit-calls: ' + swallowed.length + ' line comment(s) have swallowed code - a lost line break:');
  for (const s of swallowed) {
    console.error('  line ' + s.line + ': //' + s.text.slice(0, 150).replace(/\s+/g, ' '));
  }
  console.error('  Fix: give the line a real newline (see dev/patch-663.mjs), never a space.');
}

if (failed) process.exit(1);

console.log('audit-calls: OK - every name the app reads is declared (' + DECLARED.size +
  ' declared names across ' + blocks + ' script blocks)');
console.log('  and no line comment has swallowed code (' + LINE_COMMENTS.length + ' line comments checked)');
if (guarded.length) console.log('  typeof-guarded, not declared (legal, listed for the record): ' + guarded.join(', '));
process.exit(0);
