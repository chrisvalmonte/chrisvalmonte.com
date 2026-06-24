/**
 * Puppeteer verification: confirms the GSAP rewrite produces the same
 * experience as the original anime.js implementation.
 *
 * Checks:
 *  1. Page structure (messages container, FAB)
 *  2. FAB animates in (scale > 0 after load)
 *  3. All 7 bubbles appear with correct text content
 *  4. Bubbles start in loading state then transition to visible message
 *  5. Links in message 5 have correct hrefs
 *  6. Screenshots captured at end for visual inspection
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal static file server
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const server = await createServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log(`\nOpening ${url}\n`);
  await page.goto(url, { waitUntil: 'networkidle0' });

  // -------------------------------------------------------------------------
  // 1. DOM structure
  // -------------------------------------------------------------------------
  console.log('── 1. DOM structure ──────────────────────────────────────────');
  assert(await page.$('.messages') !== null, '.messages container exists');
  assert(await page.$('.fab') !== null, '.fab exists');
  assert(await page.$('.fab > a') !== null, '.fab > a (email link) exists');

  // -------------------------------------------------------------------------
  // 2. FAB animated in (GSAP set scale → 1)
  // -------------------------------------------------------------------------
  console.log('\n── 2. FAB animation ──────────────────────────────────────────');
  // Give the onload animation a moment to complete
  await new Promise(r => setTimeout(r, 800));
  const fabScale = await page.evaluate(() => {
    const el = document.querySelector('.fab > a');
    const style = window.getComputedStyle(el);
    const mat = new DOMMatrix(style.transform);
    return Math.round(mat.a * 100) / 100; // scaleX ≈ 1
  });
  assert(fabScale > 0.9, `FAB scale after animation = ${fabScale} (expected ~1)`);

  // -------------------------------------------------------------------------
  // 3. First bubble appears quickly (loading state)
  // -------------------------------------------------------------------------
  console.log('\n── 3. Loading state ──────────────────────────────────────────');
  // Wait for the first bubble to appear
  await page.waitForSelector('.bubble.is-loading', { timeout: 5000 });
  assert(true, 'First bubble appears in loading state');

  // Verify loading dots are present
  const dotCount = await page.$eval('.bubble.is-loading .loading', el =>
    el.querySelectorAll('b').length
  );
  assert(dotCount === 3, `Loading indicator has 3 dots (got ${dotCount})`);

  // -------------------------------------------------------------------------
  // 4. Wait for all 7 messages to finish animating
  // -------------------------------------------------------------------------
  console.log('\n── 4. All messages appear ────────────────────────────────────');
  console.log('   (waiting up to 35 seconds for all 7 bubbles…)');

  await page.waitForFunction(
    () => document.querySelectorAll('.bubble:not(.is-loading)').length >= 7,
    { timeout: 35000 }
  );
  // Give the last expand animation a moment to settle
  await new Promise(r => setTimeout(r, 1000));

  const bubbleCount = await page.$$eval('.bubble', els => els.length);
  assert(bubbleCount === 7, `7 bubbles rendered (got ${bubbleCount})`);

  // -------------------------------------------------------------------------
  // 5. Message text content (order & content)
  // -------------------------------------------------------------------------
  console.log('\n── 5. Message text content ───────────────────────────────────');
  const texts = await page.$$eval('.bubble .message', els =>
    els.map(el => el.textContent.trim())
  );

  assert(texts[0] === 'Hey 👋', `Msg 1: "${texts[0]}"`);
  assert(texts[1] === "I'm Christopher", `Msg 2: "${texts[1]}"`);
  assert(texts[2] === 'I build experiences on the web', `Msg 3: "${texts[2]}"`);
  assert(texts[3] === 'Check out some of my work', `Msg 4: "${texts[3]}"`);
  // Message 5 contains links — just check both handles appear
  assert(
    texts[4].includes('behance.net/chrisvalmonte') &&
      texts[4].includes('github.com/chrisvalmonte'),
    `Msg 5 contains both profile links`
  );
  assert(texts[5].startsWith('Currently '), `Msg 6 starts with "Currently": "${texts[5]}"`);
  assert(texts[6].length > 0, `Msg 7 (goodbye) is non-empty: "${texts[6]}"`);

  // -------------------------------------------------------------------------
  // 6. Links in message 5
  // -------------------------------------------------------------------------
  console.log('\n── 6. Links ──────────────────────────────────────────────────');
  const hrefs = await page.$$eval('.bubble .message a', els =>
    els.map(el => el.getAttribute('href'))
  );
  assert(
    hrefs.includes('https://behance.net/chrisvalmonte'),
    'Behance link present'
  );
  assert(
    hrefs.includes('https://github.com/chrisvalmonte'),
    'GitHub link present'
  );
  const targets = await page.$$eval('.bubble .message a', els =>
    els.map(el => el.getAttribute('target'))
  );
  assert(
    targets.every(t => t === '_blank'),
    'All links open in new tab'
  );

  // -------------------------------------------------------------------------
  // 7. No bubble remains in loading state
  // -------------------------------------------------------------------------
  console.log('\n── 7. No stuck loading states ────────────────────────────────');
  const stillLoading = await page.$$eval('.bubble.is-loading', els => els.length);
  assert(stillLoading === 0, `No bubbles stuck in loading state (got ${stillLoading})`);

  // -------------------------------------------------------------------------
  // 8. Screenshots
  // -------------------------------------------------------------------------
  const screenshotDir = path.join(__dirname, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, 'final-state.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\n   Screenshot saved → tests/screenshots/final-state.png`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─'.repeat(60) + '\n');

  await browser.close();
  server.close();

  process.exit(failed > 0 ? 1 : 0);
})();
