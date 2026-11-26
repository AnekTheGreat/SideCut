// Comparing release numbers, for the gates that ask "this release or newer".
//
// The numbering rule (top of AGENTS.md): a version is two numbers, and a third only ever runs
// 0-9 - after 85.0.9 comes 85.1, never 85.0.10. So a gate may NOT compare this app's versions by
// testing that the first two parts are 85.3 and the third is a number: the third part stops
// existing at the roll-over and eleven gates went red the first time 85.3.9 became 85.4.
//
// atLeast('85.4', '85.3.19') is true: 4 is greater than 3, so the missing third part is irrelevant.
function parts(v) {
  return String(v == null ? '' : v)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map(function (n) { return Number(n); });
}

function atLeast(v, want) {
  const a = parts(v), b = parts(want);
  if (!a.length || !b.length) return false;
  if (a.some(function (n) { return !Number.isFinite(n); })) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
}

module.exports = { atLeast: atLeast, parts: parts };
