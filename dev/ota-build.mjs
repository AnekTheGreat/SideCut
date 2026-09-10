import fs from "fs";
const src = fs.readFileSync("index.html","utf8");
const m = src.match(/const APP_VERSION = '([^']+)'/);
const v = m ? m[1] : "0.0.0";
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let notes = []; let dateField = "";
if (block) {
  try {
    const entries = eval("[" + block[1] + "]");
    const e = entries.find(e => String(e.version) === v) || entries[0];
    if (e) { notes = (e.items || []).slice(0, 6); dateField = e.date ? String(e.date) : ""; }
  } catch (err) { console.log("changelog parse failed:", err.message); }
}
const size = fs.statSync("ota/update.zip").size;
const payload = { version: v, url: "update.zip", size: size, notes: notes, date: dateField };
fs.writeFileSync("ota/updates.json", JSON.stringify(payload));
const payload2 = { version: v, url: "SideCut-web.zip", size: size, notes: notes, date: dateField };
fs.writeFileSync("ota/manifest.json", JSON.stringify(payload2));
console.log("OTA manifest:", v, size, "bytes,", notes.length, "notes");
