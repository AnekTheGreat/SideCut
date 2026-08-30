// Verify the inline encodeAudioBufferToFlac() produces a spec-valid, lossless FLAC:
// walks every frame, checks sync + CRC-8 + CRC-16, decodes subframes back to PCM
// and compares against the original quantized audio.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const start = html.indexOf('function encodeAudioBufferToFlac(audioBuffer){');
const marker = '\n  // Import converted file directly into library';
const end = html.indexOf(marker, start);
if (start < 0 || end < 0) { console.error('encoder not found'); process.exit(1); }
const src = html.slice(start, end);
const encoder = new Function(src + '\n;return encodeAudioBufferToFlac;')();

// ------------- FLAC bit reader / decoder -------------
function Signed(bits, v){ if (v & (1 << (bits - 1))) v -= (1 << bits); return v; }
function unfold(u){ return (u & 1) ? -((u >>> 1) + 1) : (u >>> 1); }
function crc8(bytes){ let c = 0; for (const x of bytes){ c ^= x; for (let b = 0; b < 8; b++){ c = (c & 0x80) ? ((c << 1) ^ 0x07) : (c << 1); c &= 0xFF; } } return c & 0xFF; }
function crc16(bytes){ let c = 0; for (const x of bytes){ c ^= (x << 8); for (let b = 0; b < 8; b++){ c = (c & 0x8000) ? ((c << 1) ^ 0x8005) : (c << 1); c &= 0xFFFF; } } return c & 0xFFFF; }
function makeR(bytes, off){ let pos = off, bit = 0; return {
  _cnt: 0,
  read(n){ let v = 0; for (let i = 0; i < n; i++){ v = (v << 1) | this.read1(); } return v >>> 0; },
  read1(){ const b = (bytes[pos] >>> (7 - bit)) & 1; this._cnt++; if (++bit === 8){ bit = 0; pos++; } return b; },
  byteOffset(){ return bit === 0 ? pos : pos + 1; },
  aligned(){ return bit === 0; },
}; }

function blocksizeCode(c){ const t = {1:192,2:576,3:1152,4:2304,5:4608,7:256,8:512,9:1024,10:2048,11:4096,12:8192,13:16384,14:32768}; return t[c] || 0; }

function decode(bytes){
  if (String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3]) !== 'fLaC') throw new Error('missing fLaC marker');
  if (bytes[4] !== 0x80 || bytes[5] !== 0 || bytes[6] !== 0 || bytes[7] !== 0x22) throw new Error('bad metadata block header');
  // STREAMINFO payload starts at byte 8 (after "fLaC" + 4-byte metadata header).
  // Field offsets within it: sample-rate/channels/bps at payload[10..13]=file[18..21], total at [21..25].
  const total = (((bytes[21] & 0x0F) * 0x100000000) >>> 0) + ((bytes[22] << 24) >>> 0) + (bytes[23] << 16) + (bytes[24] << 8) + bytes[25];
  const sr = (bytes[18] << 12) + (bytes[19] << 4) + (bytes[20] >>> 4);
  const channels = ((bytes[20] >>> 1) & 0x7) + 1;
  const bps = (((bytes[20] & 1) << 4) | (bytes[21] >>> 4)) + 1;
  let out = []; for (let c = 0; c < channels; c++) out.push([]);
  let pos = 42, frameNo = 0, samplesSoFar = 0;
  while (pos < bytes.length){
    const frameStart = pos;
    const r = makeR(bytes, pos);
    const sync = r.read(14); if (sync !== 0x3FFE) throw new Error('bad sync 0x' + sync.toString(16) + ' @' + pos);
    r.read(1); r.read(1); const bsc = r.read(4); r.read(4); const ch = r.read(4); const ss = r.read(3); r.read(1);
    const bs = blocksizeCode(bsc); if (!bs) throw new Error('unhandled blocksize code ' + bsc);
    if ((ch & 0x8)) throw new Error('stereo decorrelation not supported @' + pos);
    const b0 = r.read(8); let nbytes = 1;
    if ((b0 & 0xE0) === 0xC0) nbytes = 2; else if ((b0 & 0xF0) === 0xE0) nbytes = 3; else if ((b0 & 0xF8) === 0xF0) nbytes = 4;
    for (let i = 1; i < nbytes; i++) r.read(8);
    const hdrEnd = pos + 4 + nbytes;
    const crcByte = bytes[hdrEnd];
    const hdrBytes = bytes.slice(frameStart, hdrEnd);
    if (crc8(hdrBytes) !== crcByte) throw new Error('crc8 mismatch @frame ' + frameNo);
    const nSamples = Math.min(bs, total - samplesSoFar);
    let subR = makeR(bytes, hdrEnd + 1);
    const frameOut = [];
    for (let c = 0; c < channels; c++){
      const s = decodeSub(subR, bytes, nSamples, ss, bps);
      frameOut.push(s);
    }
    // FLAC zero-pads the frame to a byte boundary, so subframes may end mid-byte.
    // byteOffset() rounds up to that boundary, which is where the frame CRC-16 sits.
    const crcIdx = subR.byteOffset();
    const crcVal = bytes[crcIdx] | (bytes[crcIdx + 1] << 8);
    const frameBytes = bytes.slice(frameStart, crcIdx);
    if (crc16(frameBytes) !== crcVal){ console.error('DEBUG frame', frameNo, 'channels', channels, 'nSamples', nSamples, 'crcIdx', crcIdx, 'frameStart', frameStart, 'storedLE', crcVal.toString(16), 'frameLen', frameBytes.length, 'computed', crc16(frameBytes).toString(16), 'subframeLens', frameOut.map(s=>s.length).join(',')); throw new Error('crc16 mismatch @frame ' + frameNo); }
    for (let c = 0; c < channels; c++) for (let i = 0; i < nSamples; i++) out[c].push(frameOut[c][i]);
    samplesSoFar += nSamples; frameNo++; pos = crcIdx + 2;
  }
  if (samplesSoFar !== total) throw new Error('decoded ' + samplesSoFar + ' != ' + total);
  return { channels, sr, bps, out, total };
}

function decodeSub(r, bytes, nSamples, ss, bps){
  const pad = r.read(1); if (pad) throw new Error('subframe pad bit not zero');
  const type = r.read(6); let wasted = r.read(1);
  if (wasted){ while (r.read1() === 0) wasted++; }
  const out = [];
  if (type === 0b000000){ // constant
    const v = Signed(bps, r.read(bps)); for (let i = 0; i < nSamples; i++) out.push(v); return out;
  }
  if (type === 0b000001){ // verbatim
    for (let i = 0; i < nSamples; i++) out.push(Signed(bps, r.read(bps))); return out;
  }
  if ((type & 0b111000) === 0b001000){ // fixed predictor
    const order = type & 0x7;
    for (let i = 0; i < order; i++) out.push(Signed(bps, r.read(bps)));
    const part = r.read(4); if (part !== 0) throw new Error('partition order ' + part + ' unsupported');
    const resid = nSamples - order;
    if (resid > 0){
      const k = r.read(4);
      if (k === 15) throw new Error('escape partition not supported');
      for (let i = 0; i < resid; i++){
        let q = 0; while (r.read1() === 1) q++;
        const low = k > 0 ? r.read(k) : 0;
        const residVal = unfold((q << k) | low);
        let pred;
        if (order === 1) pred = out[out.length - 1];
        else if (order === 2) pred = 2 * out[out.length - 1] - out[out.length - 2];
        else if (order === 3) pred = 3 * out[out.length - 1] - 3 * out[out.length - 2] + out[out.length - 3];
        else if (order === 4) pred = 4 * out[out.length - 1] - 6 * out[out.length - 2] + 4 * out[out.length - 3] - out[out.length - 4];
        else pred = 0;
        out.push(residVal + pred);
      }
    }
    return out;
  }
  throw new Error('unknown subframe type 0b' + type.toString(2));
}

function q16(f){ if (!isFinite(f)) f = 0; f = Math.max(-1, Math.min(1, f)); return f < 0 ? Math.round(f * 0x8000) : Math.round(f * 0x7FFF); }

// ------------- run several cases -------------
let failures = 0;

async function main(){
  const cases = [
    ['stereo-multi-block', 2, 44100, 10000],
    ['mono-one-block', 1, 44100, 4096],
    ['tiny', 2, 48000, 500],
    ['stereo-exact-two-blocks', 2, 32000, 8192],
  ];
  for (const [name, ch, sr, len] of cases){
    const data = [];
    for (let c = 0; c < ch; c++){
      const arr = new Float32Array(len);
      for (let i = 0; i < len; i++) arr[i] = 0.8 * Math.sin(2 * Math.PI * (220 + c * 110) * i / sr);
      data.push(arr);
    }
    const buf = { numberOfChannels: ch, sampleRate: sr, length: len, getChannelData: (c) => data[c] };
    const blob = encoder(buf);
    if (!blob) throw new Error('encoder returned null');
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const info = decode(bytes);
    // compare
    let ok = true;
    for (let c = 0; c < ch; c++){
      const got = info.out[c];
      if (got.length !== len) { ok = false; console.error(name, 'ch', c, 'len mismatch', got.length, len); continue; }
      for (let i = 0; i < len; i++){
        const expected = q16(data[c][i]);
        if (got[i] !== expected){ ok = false; if (i < 5) console.error(name, 'ch', c, 'sample', i, got[i], expected); break; }
      }
    }
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  ch=' + ch + ' sr=' + sr + ' len=' + len + ' -> ' + bytes.length + ' bytes' + (ok ? '' : ''));
    if (!ok) failures++;
  }
  console.log(failures ? ('FAILURES: ' + failures) : 'ALL FLAC DECODE CHECKS PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error('HARNESS ERROR:', e.message); process.exit(1); });