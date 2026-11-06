// Drives the Other apps tab on the patched page rather than grepping it.
//   NODE_PATH=/tmp/h/node_modules node dev/check-8302.cjs
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'index.html');
const fails = [];
let passes = 0;

function check(label, ok, detail) {
  if (ok) { passes++; console.log('ok    ' + label + (detail ? '  ' + detail : '')); }
  else { fails.push(label); console.log('FAIL  ' + label + (detail ? '  ' + detail : '')); }
}

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push(String(e && e.message || e)));
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
});

setTimeout(() => {
  const { document } = dom.window;
  const strip = document.getElementById('settingsTabStrip');
  const tabs = strip ? [...strip.querySelectorAll('.tab')] : [];
  const names = tabs.map((t) => (t.textContent || '').trim());

  check('the strip is there', !!strip, names.join(' | '));
  check('Other apps is in the strip', names.includes('Other apps'));
  check('Other apps sits right before More',
    names.indexOf('Other apps') === names.indexOf('More') - 1,
    '#' + (names.indexOf('Other apps') + 1) + ' of ' + names.length);
  check('every tab that was there is still there',
    ['Theme', 'Donate', 'Important', 'Glow', 'Sandbox', 'Support', 'Widget', 'More'].every((n) => names.includes(n)));

  const pane = document.getElementById('settingsPaneOther');
  check('the pane exists', !!pane);
  const cards = pane ? pane.querySelectorAll('a[href]') : [];
  const cardNames = pane ? [...pane.querySelectorAll('div[style*="font-weight:600"]')].map((d) => d.textContent.trim()) : [];
  check('three cards', cards.length === 3, cards.length + ' links');
  check('the three apps are named',
    ['FamTM', 'UJournal', 'MeasureT'].every((n) => cardNames.includes(n)),
    cardNames.join(', '));
  check('the three links are the three store pages',
    [...cards].map((a) => a.getAttribute('href')).join(' ').match(/com\.FamTM\.app/) &&
    [...cards].map((a) => a.getAttribute('href')).join(' ').match(/app\.ujournal/) &&
    [...cards].map((a) => a.getAttribute('href')).join(' ').match(/com\.CompassEDC\.myapp/) &&
    ![...cards].map((a) => a.getAttribute('href')).join(' ').match(/My-Hub/));

  // The tap: open the settings sheet the way the gear does, then click the tab.
  try { dom.window.showSettingsTab && dom.window.showSettingsTab('more'); } catch (e) { errors.push('showSettingsTab: ' + e.message); }
  const btn = document.getElementById('settingsTabOther');
  const before = pane ? pane.style.display : null;
  try { btn.click(); } catch (e) { errors.push('click: ' + e.message); }

  const shown = [...document.querySelectorAll('#settingsPanesWrap > div[id^="settingsPane"]')]
    .filter((d) => d.style.display !== 'none').map((d) => d.id);
  check('the pane starts hidden', before === 'none', 'display=' + before);
  check('a tap on Other apps shows it', shown.includes('settingsPaneOther'), shown.join(', ') || 'nothing shown');
  check('and only it', shown.filter((id) => id !== 'settingsPaneOther').length === 0);
  check('the tab wears active', btn.classList.contains('active'));
  check('More does not', !document.getElementById('settingsTabMore').classList.contains('active'));

  const ver = (fs.readFileSync(PAGE, 'utf8').match(/const APP_VERSION = '([^']+)'/) || [])[1];
  check('the page says 83.0.2', ver === '83.0.2', ver);

  const real = errors.filter((e) => !/Not implemented|indexedDB|Audio|play\(\)|mediaDevices|matchMedia|css/i.test(e));
  check('no page errors from the change', real.length === 0, real.slice(0, 3).join(' / '));

  console.log('\n' + passes + ' passed, ' + fails.length + ' failed');
  if (fails.length) process.exit(1);
  process.exit(0);
}, 1200);
