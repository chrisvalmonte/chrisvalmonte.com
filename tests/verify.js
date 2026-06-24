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
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else { console.error(`  ✗  ${label}`); failed++; }
}

const ALL_TEXTS = [
  t => t === 'Hey 👋',
  t => t === "I'm Christopher",
  t => t === 'I build experiences on the web',
  t => t === 'Check out some of my work',
  t => t.includes('behance.net/chrisvalmonte') && t.includes('github.com/chrisvalmonte'),
  t => t.startsWith('Currently '),
  t => t.length > 0,
];

async function assertMessages(page, expectedCount, label) {
  console.log(`\n── ${label} ──────────────────────────────────────────`);
  const count = await page.$$eval('.bubble', els => els.length);
  assert(count === expectedCount, `${expectedCount} bubbles rendered (got ${count})`);
  const texts = await page.$$eval('.bubble .message', els => els.map(el => el.textContent.trim()));
  ALL_TEXTS.slice(0, expectedCount).forEach((check, i) =>
    assert(check(texts[i] || ''), `Msg ${i + 1}: "${texts[i]}"`)
  );
  const stillLoading = await page.$$eval('.bubble.is-loading', els => els.length);
  assert(stillLoading === 0, `No bubbles stuck in loading (got ${stillLoading})`);
}

(async () => {
  const server = await createServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });

  // ── First visit: full animation, each bubble persisted as it appears ────
  console.log(`\nOpening ${url}`);
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 1280, height: 800 });
  await p1.goto(url, { waitUntil: 'networkidle0' });

  console.log('\n── Loading state (first visit) ───────────────────────────────');
  await p1.waitForSelector('.bubble.is-loading', { timeout: 5000 });
  assert(true, 'First bubble enters loading state');

  // Wait for first bubble to be revealed and check the count increments
  await p1.waitForFunction(
    () => parseInt(localStorage.getItem('cv_messages_seen') || '0', 10) >= 1,
    { timeout: 10000 }
  );
  const countAfterFirst = await p1.evaluate(() => parseInt(localStorage.getItem('cv_messages_seen'), 10));
  assert(countAfterFirst === 1, `localStorage count = 1 after first bubble revealed (got ${countAfterFirst})`);

  // Wait for all 7 messages
  console.log('\n── Waiting for all 7 messages (up to 35s)… ──────────────────');
  await p1.waitForFunction(
    () => document.querySelectorAll('.bubble:not(.is-loading)').length >= 7,
    { timeout: 35000 }
  );
  await new Promise(r => setTimeout(r, 800));

  await assertMessages(p1, 7, 'First visit — all messages');

  const finalCount = await p1.evaluate(() => parseInt(localStorage.getItem('cv_messages_seen'), 10));
  assert(finalCount === 7, `localStorage count = 7 after all revealed (got ${finalCount})`);

  const hrefs = await p1.$$eval('.bubble .message a', els => els.map(el => el.getAttribute('href')));
  assert(hrefs.includes('https://behance.net/chrisvalmonte'), 'Behance link present');
  assert(hrefs.includes('https://github.com/chrisvalmonte'), 'GitHub link present');

  await p1.screenshot({ path: path.join(__dirname, 'screenshots/first-visit.png'), fullPage: true });

  // ── Partial visit: 3 bubbles persisted, rest animate in ─────────────────
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1280, height: 800 });
  await p2.evaluateOnNewDocument(() => localStorage.setItem('cv_messages_seen', '3'));
  await p2.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  console.log('\n── Partial visit: 3 persisted ─────────────────────────────');
  const earlyCount = await p2.$$eval('.bubble', els => els.length);
  assert(earlyCount >= 3, `At least 3 bubbles immediately present (got ${earlyCount})`);

  await p2.waitForFunction(
    () => document.querySelectorAll('.bubble:not(.is-loading)').length >= 7,
    { timeout: 35000 }
  );
  await new Promise(r => setTimeout(r, 800));
  await assertMessages(p2, 7, 'Partial visit — all messages after animation');
  await p2.screenshot({ path: path.join(__dirname, 'screenshots/partial-visit.png'), fullPage: true });

  // ── Full return visit: all 7 persisted, no animation ───────────────────
  const p3 = await browser.newPage();
  await p3.setViewport({ width: 1280, height: 800 });
  await p3.evaluateOnNewDocument(() => localStorage.setItem('cv_messages_seen', '7'));
  await p3.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  console.log('\n── Full return visit: no loading dots ─────────────────────');
  const loadingOnReturn = await p3.$$eval('.bubble.is-loading', els => els.length);
  assert(loadingOnReturn === 0, 'No loading dots on full return visit');
  await assertMessages(p3, 7, 'Full return visit — all messages');
  await p3.screenshot({ path: path.join(__dirname, 'screenshots/return-visit.png'), fullPage: true });

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─'.repeat(60) + '\n');

  await browser.close();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
})();
