// 80.0 - visual check, not a gate. Boots the page in a real browser and shoots
// the new arrangements so the layout can be looked at instead of inferred from
// computed CSS. Run it with the repository served on :3000:
//
//   python3 -m http.server 3000 --bind 0.0.0.0 &
//   node dev/shots-800.cjs
const { chromium } = require('/tmp/h/node_modules/playwright');
const path = require('path');

const OUT = process.env.OUT || path.join(__dirname, '..', '..', 'artifacts');
const URL = process.env.URL || 'http://127.0.0.1:3000/index.html';

async function settle(page, ms) { await page.waitForTimeout(ms || 700); }

async function dismiss(page) {
  await page.evaluate(() => { try { window.__scTutorialGate = false; } catch (e) {} });
  for (const sel of ['#howToUseClose', '#notifClose', '.modal-btns .confirm']) {
    const el = await page.$(sel);
    try { if (el && await el.isVisible()) { await el.click(); await page.waitForTimeout(200); } } catch (e) {}
  }
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await phone.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  await dismiss(page);
  await settle(page, 600);

  await page.screenshot({ path: path.join(OUT, 'home-classic.png') });

  await page.evaluate(() => window.SC80 && window.SC80.setLayout('cloud'));
  await settle(page, 900);
  await page.screenshot({ path: path.join(OUT, 'home-cloud.png') });

  await page.evaluate(() => window.SC80 && window.SC80.setLayout('classic'));
  await settle(page, 400);
  await page.click('#studioBtn');
  await settle(page, 1000);
  await page.screenshot({ path: path.join(OUT, 'studio-studio.png') });

  await page.click('.sc80-tab[data-tab="tools"]');
  await settle(page, 600);
  await page.screenshot({ path: path.join(OUT, 'studio-tools.png') });

  await page.evaluate(() => window.SC80 && window.SC80.celebrate(50));
  await settle(page, 700);
  await page.screenshot({ path: path.join(OUT, 'milestone.png') });
  await page.evaluate(() => { const h = document.getElementById('sc80Milestone'); if (h) h.classList.remove('show'); });

  await page.evaluate(() => window.SC80 && window.SC80.setPinnedLayout('grid'));
  await page.click('#discoverBtn');
  await settle(page, 900);
  await page.screenshot({ path: path.join(OUT, 'pinned-grid.png') });
  await page.evaluate(() => window.SC80 && window.SC80.setPinnedLayout('row'));

  const desk = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  const wide = await desk.newPage();
  await wide.goto(URL, { waitUntil: 'load' });
  await wide.waitForTimeout(6000);
  await dismiss(wide);
  await wide.evaluate(() => window.SC80 && window.SC80.setLayout('cloud'));
  await settle(wide, 900);
  await wide.screenshot({ path: path.join(OUT, 'desktop-cloud.png') });

  await browser.close();
  console.log('shots written to ' + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
