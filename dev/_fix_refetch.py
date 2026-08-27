with open('index.html', 'r') as f:
    content = f.read()

# Add inline cancel to __refetchArtistAlbums
old = """window.__refetchArtistAlbums = async function(artistName){
  if(window.__ahFetching){ if(typeof toast === 'function') toast('Already fetching albums\u2026'); return; }
  if(!isPremiumActive()){ toast('Premium feature \u2014 unlock in Settings!'); openSettingsTo('premium'); return; }
  window.__ahFetching = true;
  window.__ahCancelled = false;
  try {
    if(typeof toast === 'function') toast('\U0001F4C0 Fetching albums for ' + artistName + '\u2026', 3000);"""

new = """window.__refetchArtistAlbums = async function(artistName){
  if(window.__ahFetching){ if(typeof toast === 'function') toast('Already fetching albums\u2026'); return; }
  if(!isPremiumActive()){ toast('Premium feature \u2014 unlock in Settings!'); openSettingsTo('premium'); return; }
  window.__ahFetching = true;
  window.__ahCancelled = false;
  try {
    // Show inline cancel below subtitle
    var _sub = document.getElementById('discPopupSub');
    if(_sub && !document.getElementById('ahInlineCancel')){
      var _cb = document.createElement('div');
      _cb.id = 'ahInlineCancel'; _cb.style.cssText = 'text-align:center;padding:4px 0 2px;';
      _cb.innerHTML = '<span style="font-size:11px;color:var(--ink-dim);">\\U0001F4C0 Fetching ' + artistName + '\\u2026</span> <button id="ahCancelBtnInline" style="padding:3px 10px;border-radius:6px;border:1px solid var(--line);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;margin-left:6px;">Cancel</button>';
      _sub.parentNode.insertBefore(_cb, _sub.nextSibling);
      document.getElementById('ahCancelBtnInline').addEventListener('click', function(e){ e.stopPropagation(); window.__ahCancelled = true; window.__ahFetching = false; var _x = document.getElementById('ahInlineCancel'); if(_x) _x.remove(); toast('\\U0001F4C0 Fetch cancelled.', 2000); });
    }"""

count = content.count(old)
print(f"Found {count} matches")
if count == 1:
    content = content.replace(old, new, 1)

with open('index.html', 'w') as f:
    f.write(content)
print("Done")
