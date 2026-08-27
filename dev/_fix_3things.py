import re

with open('index.html', 'r') as f:
    lines = f.readlines()

# Find toastWithCancel and __ahCancelToast
twc_start = twc_end = cancel_start = cancel_end = -1
for i, line in enumerate(lines):
    if 'window.toastWithCancel = function' in line and twc_start < 0:
        twc_start = i
    if twc_start >= 0 and twc_end < 0 and line.strip() == '};' and i > twc_start + 2:
        twc_end = i
    if 'window.__ahCancelToast = function' in line and cancel_start < 0:
        cancel_start = i
    if cancel_start >= 0 and cancel_end < 0 and line.strip() == '};' and i > cancel_start + 2:
        cancel_end = i

print(f"toastWithCancel: lines {twc_start+1}-{twc_end+1}")
print(f"__ahCancelToast: lines {cancel_start+1}-{cancel_end+1}")

# Extract the emoji from original toast line
original_toast = lines[twc_start + 4]  # the toast(...) line
emoji_match = re.search(r"toast\('(.)", original_toast)
emoji = emoji_match.group(1) if emoji_match else '\U0001F4C0'
print(f"Emoji char: {repr(emoji)}")

# New toastWithCancel: inline cancel below subtitle
new_twc_lines = [
    'window.toastWithCancel = function(){\n',
    "  // Show inline cancel button below the popup subtitle\n",
    "  var td = document.getElementById('toast');\n",
    "  if(td){ td.style.display = 'none'; clearTimeout(td._timer); }\n",
    "  var sub = document.getElementById('discPopupSub');\n",
    "  if(sub){\n",
    "    var existingCancel = document.getElementById('ahInlineCancel');\n",
    "    if(!existingCancel){\n",
    "      var cancelWrap = document.createElement('div');\n",
    "      cancelWrap.id = 'ahInlineCancel';\n",
    "      cancelWrap.style.cssText = 'text-align:center;padding:4px 0 2px;';\n",
    "      cancelWrap.innerHTML = '<span style=\"font-size:11px;color:var(--ink-dim);\">" + emoji + " Fetching albums\\u2026</span> <button id=\"ahCancelBtnInline\" style=\"padding:3px 10px;border-radius:6px;border:1px solid var(--line);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;margin-left:6px;\">Cancel</button>';\n",
    "      sub.parentNode.insertBefore(cancelWrap, sub.nextSibling);\n",
    "      document.getElementById('ahCancelBtnInline').addEventListener('click', function(e){ e.stopPropagation(); window.__ahCancelToast(); });\n",
    "    }\n",
    "  } else {\n",
    "    toast('" + emoji + " Fetching albums\\u2026', 3000);\n",
    "  }\n",
    "};\n",
]

new_cancel_lines = [
    'window.__ahCancelToast = function(){\n',
    "  if(!window.__ahFetching) return;\n",
    "  window.__ahCancelled = true;\n",
    "  window.__ahFetching = false;\n",
    "  try{ localStorage.removeItem('sidecut_ahPending'); }catch(e){}\n",
    "  var ic = document.getElementById('ahInlineCancel');\n",
    "  if(ic) ic.remove();\n",
    "  if(typeof toast === 'function') toast('" + emoji + " Fetch cancelled.', 2000);\n",
    "};\n",
]

# Replace toastWithCancel
lines[twc_start:twc_end+1] = new_twc_lines
delta = len(new_twc_lines) - (twc_end - twc_start + 1)
cancel_start += delta
cancel_end += delta
lines[cancel_start:cancel_end+1] = new_cancel_lines

with open('index.html', 'w') as f:
    f.writelines(lines)
print("Done")
