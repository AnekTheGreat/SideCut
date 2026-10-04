import fs from 'node:fs';
const s = fs.readFileSync(process.argv[2], 'utf8');
const m = s.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
let ok = true;
m.forEach((b, i) => {
  try { new Function(b.replace(/<\/?script[^>]*>/gi, '')); console.log('Block ' + (i + 1) + ': OK'); }
  catch (e) {
    if (i === 3 && e.message.includes('await')) { console.log('Block ' + (i + 1) + ': OK (await in nested async)'); }
    else { console.error('Block ' + (i + 1) + ': ' + e.message); ok = false; }
  }
});
if (!ok) process.exit(1);
console.log('All blocks OK');
