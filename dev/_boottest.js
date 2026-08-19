// Boot harness: run the main IIFE with a DOM/IDB mock, print the first runtime error.
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)];
if (!blocks.length) { console.error('no inline scripts'); process.exit(1); }
const src = blocks[0][1];
console.log('script block 0 length:', src.length);

// ---------------- element mock ----------------
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [],
    parent: null,
    style: {},
    dataset: {},
    _listeners: {},
    className: '',
    id: '',
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    disabled: false,
    type: '',
    title: '',
    src: '',
    href: '',
    placeholder: '',
    autocomplete: '',
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { if (c) { c.parent = this; this.children.push(c); } return c; },
    insertBefore(c, ref) { if (c) { c.parent = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); } return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    replaceChild(n, o) { const i = this.children.indexOf(o); if (i >= 0) this.children[i] = n; if (n) n.parent = this; return o; },
    remove() { if (this.parent) this.parent.removeChild(this); },
    contains(c) { return this === c; },
    // Simulate "the queried element exists": return a fresh stub so boot code
    // that queries known-in-HTML elements doesn't crash on null.
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    setAttribute(k, v) { this[k] = String(v); if (k === 'class') this.className = String(v); },
    getAttribute(k) { return this[k]; },
    removeAttribute(k) { delete this[k]; },
    closest() { return makeEl('div'); },
    focus() {}, blur() {}, click() {},
    scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }; },
    classList: {
      _set: new Set(),
      add() {}, remove() {}, toggle() { return false; },
      contains() { return false; },
    },
    insertAdjacentHTML() {},
    setPointerCapture() {}, releasePointerCapture() {},
    hasPointerCapture() { return false; },
    matches() { return false; },
  };
  return el;
}

// ---------------- IDB mock ----------------
function makeIDB() {
  const stores = { tracks: new Map(), meta: new Map() };
  // Seed realistic user data so data-dependent boot crashes surface too.
  const meta = stores.meta;
  meta.set('pinnedArtists', { key: 'pinnedArtists', value: [
    { name: 'The Weeknd', art: 'https://example.com/w.jpg', addedAt: 1755000000000 },
    { name: 'Drake', art: 'https://example.com/d.jpg', addedAt: 1755000000000 },
    { name: 'Post Malone', art: 'https://example.com/p.jpg', addedAt: 1755000000000 },
    { name: 'Taylor Swift', art: 'https://example.com/t.jpg', addedAt: 1755000000000 },
  ] });
  meta.set('pinnedReleases', { key: 'pinnedReleases', value: {
    'The Weeknd': [
      { title: 'Dancing In The Flames', date: '2026-08-10', art: 'https://example.com/a.jpg', url: 'https://open.spotify.com/track/1', previewUrl: null, seen: false },
      { title: 'Open Hearts', date: '2026-07-01', art: 'https://example.com/b.jpg', url: 'https://open.spotify.com/track/2', previewUrl: null, seen: true },
    ],
    'Drake': [ { title: 'Somebody Loves Me', date: '2026-08-01', art: null, url: null, previewUrl: null, seen: false } ],
  } });
  meta.set('homeOrder', { key: 'homeOrder', value: ['nowplaying', 'shortcuts', 'pinnedartists', 'newreleases', 'playlists', 'stats', 'library', 'custom-1'] });
  meta.set('homeHidden', { key: 'homeHidden', value: {} });
  meta.set('homeBubbleSize', { key: 'homeBubbleSize', value: 100 });
  meta.set('refreshRate', { key: 'refreshRate', value: 'max' });
  meta.set('customQuickActions', { key: 'customQuickActions', value: [] });
  meta.set('actionPillOrder', { key: 'actionPillOrder', value: ['homeBtn', 'libraryBtn', 'discoverBtn', 'addSongsToggle'] });
  meta.set('playlists', { key: 'playlists', value: { 'All Songs': [], 'Favorites': [] } });
  meta.set('idCounter', { key: 'idCounter', value: 0 });
  meta.set('lyricsWordByWord', { key: 'lyricsWordByWord', value: true });
  function storeOf(name) { if (!stores[name]) stores[name] = new Map(); return stores[name]; }
  return {
    open() {
      const req = {
        result: null, error: null,
        onupgradeneeded: null, onsuccess: null, onerror: null,
      };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: (n) => !!stores[n] },
          createObjectStore(name) { if (!stores[name]) stores[name] = new Map(); return {}; },
          transaction(storeName) {
            const map = storeOf(storeName);
            return {
              objectStore() {
                return {
                  put(v) { map.set(v.key ?? v.id, v); },
                  delete(k) { map.delete(k); },
                  get(k) {
                    const r = { result: map.get(k) ?? null, onsuccess: null, onerror: null };
                    setTimeout(() => r.onsuccess && r.onsuccess());
                    return r;
                  },
                  getAll() {
                    const r = { result: [...map.values()], onsuccess: null, onerror: null };
                    setTimeout(() => r.onsuccess && r.onsuccess());
                    return r;
                  },
                };
              },
              oncomplete: null, onerror: null,
            };
          },
        };
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    },
  };
}

// ---------------- sandbox ----------------
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: clearTimeout,
  queueMicrotask,
  Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp,
  Error, TypeError, RangeError, ReferenceError, SyntaxError,
  encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, NaN, Infinity,
  Map, Set, WeakMap, WeakSet, Symbol, BigInt, URL, URLSearchParams, TextEncoder, TextDecoder,
  Uint8Array, ArrayBuffer, Float32Array, Uint16Array, Int32Array, Blob, FormData, Headers, Request, Response,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

// document
const doc = {
  _listeners: {},
  hidden: false,
  title: 'SideCut',
  readyState: 'complete',
  documentElement: makeEl('html'),
  body: makeEl('body'),
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
  removeEventListener() {},
  getElementById() { return makeEl('div'); },
  querySelector() { return makeEl('div'); },
  querySelectorAll() { return []; },
  getElementsByClassName() { return []; },
  getElementsByTagName() { return []; },
  createElement(tag) { return makeEl(tag); },
  createElementNS(ns, tag) { return makeEl(tag); },
  createTextNode(t) { return { textContent: t }; },
  createDocumentFragment() { return makeEl('fragment'); },
  execCommand() { return false; },
  exitFullscreen() {}, requestFullscreen() {},
  visibilityState: 'visible',
};
sandbox.document = doc;

sandbox.localStorage = {
  _m: new Map([['sidecut_premium', JSON.stringify({ active: true, granted: true, plan: 'gift', code: 'SC-xxxxxxxx-xxxxxxxx' })]]),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
  clear() { this._m.clear(); },
  key(i) { return [...this._m.keys()][i] ?? null; },
  get length() { return this._m.size; },
};

sandbox.sessionStorage = sandbox.localStorage;
sandbox.navigator = {
  onLine: true,
  userAgent: 'node-test',
  language: 'en-US',
  clipboard: { writeText: async () => {} },
  mediaSession: { setActionHandler() {}, setPositionState() {}, setMetadata() {}, playbackState: 'none' },
  vibrate() {},
};
sandbox.indexedDB = makeIDB();
sandbox.fetch = async (url) => ({ ok: true, status: 200, json: async () => ({ results: [] }), arrayBuffer: async () => new ArrayBuffer(0), text: async () => '', blob: async () => new Blob() });
sandbox.Audio = function () { return { play: async () => {}, pause() {}, load() {}, addEventListener() {}, removeEventListener() {}, currentTime: 0, duration: 0, paused: true, volume: 1, src: '', loop: false }; };
function mkAudioCtx() {
  const node = (extra) => Object.assign({ connect() { return this; }, disconnect() {}, frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 1 }, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, delayTime: { value: 0 }, pan: { value: 0 }, playbackRate: { value: 1 }, buffer: null, loop: false }, extra || {});
  return {
    state: 'running', currentTime: 0, sampleRate: 44100, destination: node(),
    createGain: () => node({ gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} } }),
    createAnalyser: () => node({ getByteFrequencyData() {}, getFloatFrequencyData() {}, frequencyBinCount: 256, fftSize: 256 }),
    createDynamicsCompressor: () => node(),
    createDelay: () => node(),
    createBiquadFilter: () => node(),
    createStereoPanner: () => node(),
    createConvolver: () => node(),
    createOscillator: () => node({ start() {}, stop() {} }),
    createBufferSource: () => node({ start() {}, stop() {} }),
    createMediaElementSource: () => node(),
    createMediaStreamDestination: () => node(),
    createBuffer: () => ({ getChannelData: () => new Float32Array(0), duration: 0, numberOfChannels: 1, sampleRate: 44100 }),
    decodeAudioData: async () => ({ getChannelData: () => new Float32Array(0), duration: 0, numberOfChannels: 1, sampleRate: 44100 }),
    close: async () => {}, resume: async () => {}, suspend: async () => {},
  };
};
sandbox.AudioContext = mkAudioCtx;
sandbox.webkitAudioContext = mkAudioCtx;
sandbox.matchMedia = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
sandbox.location = { href: 'https://sidecut.local/', origin: 'https://sidecut.local', protocol: 'https:', host: 'sidecut.local', pathname: '/', search: '', hash: '', reload() {} };
sandbox.history = { pushState() {}, replaceState() {} };
sandbox.screen = { width: 1080, height: 2400 };
sandbox.addEventListener = doc.addEventListener.bind(doc);
sandbox.removeEventListener = doc.removeEventListener.bind(doc);
sandbox.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
sandbox.devicePixelRatio = 2;
sandbox.scrollTo = () => {};
try {
  const { webcrypto } = require('crypto');
  sandbox.crypto = webcrypto;
} catch (e) { sandbox.crypto = {}; }

vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'inline-block-0.js' });
  console.log('IIFE completed without throwing');
  console.log('typeof window._toggleNR:', typeof sandbox._toggleNR);
  console.log('typeof window._toggleGenres:', typeof sandbox._toggleGenres);
  console.log('typeof window._toggleNR() smoke test:', (() => { try { sandbox._toggleNR(); return 'ok'; } catch (e) { return 'THREW: ' + e.message; } })());
  console.log('typeof window._toggleGenres() smoke test:', (() => { try { sandbox._toggleGenres(); return 'ok'; } catch (e) { return 'THREW: ' + e.message; } })());
} catch (e) {
  console.error('IIFE THREW:', e && e.message);
  console.error(e && e.stack);
  process.exit(1);
}
process.exit(0);
