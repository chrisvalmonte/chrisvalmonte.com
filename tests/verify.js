const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function createServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
      const ext = path.extname(filePath);
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

const EXPECTED_TEXTS = [
  t => t === 'Hey 👋',
  t => t === "I'm Christopher",
  t => t === 'I build experiences on the web',
  t => t === 'Check out some of my work',
  t => t.includes('behance.net/chrisvalmonte') && t.includes('github.com/chrisvalmonte'),
  t => t.startsWith('Currently '),
  t => t.length > 0,
];

async function runChecks(page, label) {
  console.log(`\n── ${label} ──────────────────────────────────────────`);

  const fabScale = await page.evaluate(() => {
    const el = document.querySelector('.fab > a');
    return Math.round(new DOMMatrix(getComputedStyle(el).transform).a * 100) / 100;
  });
  assert(fabScale > 0.9, `FAB scale = ${fabScale} (expected ~1)`);

  const bubbleCount = await page.$$eval('.bubble', els => els.length);
  assert(bubbleCount === 7, `7 bubbles rendered (got ${bubbleCount})`);

  const texts = await page.$$eval('.bubble .message', els => els.map(el => el.textContent.trim()));
  EXPECTED_TEXTS.forEach((check, i) =>
    assert(check(texts[i] || ''), `Msg ${i + 1}: "${texts[i]}"`)
  );

  const hrefs = await page.$$eval('.bubble .message a', els => els.map(el => el.getAttribute('href')));
  assert(hrefs.includes('https://behance.net/chrisvalmonte'), 'Behance link present');
  assert(hrefs.includes('https://github.com/chrisvalmonte'), 'GitHub link present');

  const stillLoading = await page.$$eval('.bubble.is-loading', els => els.length);
  assert(stillLoading === 0, `No bubbles stuck in loading state (got ${stillLoading})`);
}

(async () => {
  const server = await createServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  // ── First visit (full animation path) ────────────────────────────────────
  console.log(`\nOpening ${url}`);
  const page1 = await browser.newPage();
  await page1.setViewport({ width: 1280, height: 800 });
  await page1.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  console.log('\n── DOM structure ─────────────────────────────────────────────');
  assert(await page1.$('.messages') !== null, '.messages container exists');
  assert(await page1.$('.fab > a') !== null, '.fab > a exists');

  console.log('\n── Loading state (first visit) ───────────────────────────────');
  await page1.waitForSelector('.bubble.is-loading', { timeout: 5000 });
  assert(true, 'First bubble appears in loading state');
  const dotCount = await page1.$eval('.bubble.is-loading .loading', el => el.querySelectorAll('b').length);
  assert(dotCount === 3, `Loading indicator has 3 dots (got ${dotCount})`);

  console.log('\n── Waiting for all 7 messages (first visit, up to 35s)… ──────');
  await page1.waitForFunction(
    () => document.querySelectorAll('.bubble:not(.is-loading)').length >= 7,
    { timeout: 35000 }
  );
  await new Promise(r => setTimeout(r, 1000));

  await runChecks(page1, 'First visit — animated path');

  const storedFlag = await page1.evaluate(() => localStorage.getItem('cv_messages_seen'));
  assert(storedFlag === '1', `localStorage flag set after last message (got "${storedFlag}")`);

  fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
  await page1.screenshot({ path: path.join(__dirname, 'screenshots/first-visit.png'), fullPage: true });

  // ── Return visit (persisted path) ────────────────────────────────────────
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1280, height: 800 });

  // Inject the flag before the page loads so it takes the render() branch
  await page2.evaluateOnNewDocument(() => localStorage.setItem('cv_messages_seen', '1'));
  await page2.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  // Should NOT see any loading state on a return visit
  const loadingOnReturn = await page2.$$eval('.bubble.is-loading', els => els.length);
  assert(loadingOnReturn === 0, 'No loading dots on return visit');

  await runChecks(page2, 'Return visit — persisted path');

  await page2.screenshot({ path: path.join(__dirname, 'screenshots/return-visit.png'), fullPage: true });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─'.repeat(60) + '\n');

  await browser.close();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
})();
