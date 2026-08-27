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

const STORAGE_KEY = 'cv_messages_seen_v2';
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

function createServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Strip ?v= cache-busting keys before resolving on disk.
      const urlPath = req.url.split('?')[0];
      let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
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
  t => t === 'Check out my work',
  t => t.includes('youtu.be/CNY_cEXMnwE'),
];
const MESSAGE_COUNT = ALL_TEXTS.length;

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

// Geometry of the desktop phone mockup, measured from the live layout.
function readFrame() {
  const device = document.querySelector('.device');
  const screen = document.querySelector('.screen');
  const fab = document.querySelector('.fab');
  const messages = document.querySelector('.messages');
  const d = device.getBoundingClientRect();
  const s = screen.getBoundingClientRect();
  const f = fab.getBoundingClientRect();
  const m = messages.getBoundingClientRect();
  return {
    device: { w: d.width, h: d.height, top: d.top, left: d.left, right: d.right, bottom: d.bottom },
    screen: { w: s.width, h: s.height, top: s.top, left: s.left, right: s.right, bottom: s.bottom },
    fab: { top: f.top, left: f.left, right: f.right, bottom: f.bottom },
    messages: { w: m.width, scrollW: messages.scrollWidth },
    // Bezel thickness per side — the gap between the outer shell and the screen.
    bezel: {
      left: s.left - d.left,
      right: d.right - s.right,
      top: s.top - d.top,
      bottom: d.bottom - s.bottom,
    },
    deviceDisplay: getComputedStyle(device).display,
    screenDisplay: getComputedStyle(screen).display,
    fabPosition: getComputedStyle(fab).position,
    bodyOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    bodyOverflowsY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
}

// Installed before the page's own scripts so it can stamp the first frame at
// which each entrance milestone becomes true.
function recordEntrance() {
  const marks = { start: performance.now() };
  const seen = (name) => { if (marks[name] === undefined) marks[name] = performance.now(); };
  const sample = () => {
    const device = document.querySelector('.device');
    if (device) {
      const mobile = getComputedStyle(device).display === 'contents';
      if (marks.initialTransform === undefined) {
        marks.initialTransform = getComputedStyle(device).transform;
      }
      // At rest means the transform has settled at identity. Testing merely
      // for "inside the viewport" fires partway through the slide.
      const ty = (getComputedStyle(device).transform.match(/matrix\(.*,\s*([-\d.]+)\)$/) || [])[1];
      if (mobile || ty === undefined || Math.abs(parseFloat(ty)) < 0.5) {
        seen('deviceAtRest');
      }
    }
    const fab = document.querySelector('.fab > a');
    // The FAB rests at scale(0); any other matrix means it has started to pop.
    if (fab && !/matrix\(0,\s*0,\s*0,\s*0/.test(getComputedStyle(fab).transform)) {
      seen('fabVisible');
    }
    if (document.querySelector('.bubble')) seen('firstBubble');
    // Text revealed, not merely the loading pill on screen.
    if (document.querySelector('.bubble:not(.is-loading)')) seen('firstBubbleSent');
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  window.__entrance = marks;
}

async function waitForDeviceAtRest(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.device');
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'contents') return true;                  // mobile: no frame
    if (style.transform === 'none') return true;
    const ty = (style.transform.match(/matrix\(.*,\s*([-\d.]+)\)$/) || [])[1];
    return ty !== undefined && Math.abs(parseFloat(ty)) < 0.5;
  }, { timeout: 15000 });
}

// `persisted` = the visitor has seen these bubbles before, so they are painted
// synchronously ahead of the entrance rather than animating in after it.
async function assertEntranceOrder(page, { desktop, persisted }) {
  const label = `${desktop ? 'desktop' : 'mobile'}, ${persisted ? 'return visit' : 'first visit'}`;
  console.log(`\n── Entrance sequence (${label}) ──────────────────────`);
  await page.waitForFunction(() => {
    const marks = window.__entrance;
    return marks && marks.fabVisible !== undefined && marks.firstBubbleSent !== undefined;
  }, { timeout: 20000 });
  const m = await page.evaluate(() => window.__entrance);

  assert(m.fabVisible !== undefined, 'Reply button becomes visible');
  assert(m.firstBubbleSent !== undefined, 'First message is delivered');

  if (!desktop) {
    // Below 900px there is no device box to move, so the slide must not exist.
    assert(
      m.initialTransform === 'none',
      `Phone frame has no transform below 900px (${m.initialTransform})`
    );
  } else {
    assert(m.deviceAtRest !== undefined, 'Device reaches its resting position');
    assert(
      /matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*([1-9]\d*)/.test(m.initialTransform),
      `Phone starts translated below the fold (${m.initialTransform})`
    );

    const slide = m.deviceAtRest - m.start;
    assert(slide > 200 && slide < 5000, `Slide runs for a visible beat (${slide.toFixed(0)}ms)`);

    assert(
      m.deviceAtRest <= m.fabVisible + 1,
      `Phone lands before the reply button appears (${(m.fabVisible - m.deviceAtRest).toFixed(0)}ms apart)`
    );

    if (persisted) {
      // The point of splitting Messages.init() from Messages.start(): a
      // returning visitor's phone rises with the conversation already on it.
      assert(
        m.firstBubbleSent <= m.deviceAtRest + 1,
        `Seen bubbles are on screen before the phone lands (${(m.deviceAtRest - m.firstBubbleSent).toFixed(0)}ms earlier)`
      );
    } else {
      assert(
        m.deviceAtRest <= m.firstBubble + 1,
        `Phone lands before the first bubble starts (${(m.firstBubble - m.deviceAtRest).toFixed(0)}ms apart)`
      );
    }
  }

  // The button trails the conversation rather than leading it.
  assert(
    m.firstBubbleSent <= m.fabVisible + 1,
    `Reply button follows the first message (${(m.fabVisible - m.firstBubbleSent).toFixed(0)}ms after)`
  );

  if (!persisted) {
    assert(
      m.firstBubble < m.fabVisible,
      `Bubble is on screen before the button (${(m.fabVisible - m.firstBubble).toFixed(0)}ms apart)`
    );
  }
}

async function assertDesktopFrame(page) {
  console.log('\n── Desktop phone mockup ───────────────────────────────────');
  const f = await page.evaluate(readFrame);

  assert(f.deviceDisplay === 'block', `.device is a real box at desktop (display: ${f.deviceDisplay})`);
  assert(f.screenDisplay === 'flex', `.screen is a real box at desktop (display: ${f.screenDisplay})`);

  const ratio = f.device.h / f.device.w;
  const target = 844 / 390;
  assert(
    Math.abs(ratio - target) < 0.02,
    `Device holds a phone aspect ratio (${ratio.toFixed(3)} vs ${target.toFixed(3)})`
  );

  // Bezels: thin, present on every side, and even all the way around.
  const sides = ['left', 'right', 'top', 'bottom'];
  const thicknesses = sides.map(side => f.bezel[side]);
  const maxBezel = Math.max(...thicknesses);
  const minBezel = Math.min(...thicknesses);

  assert(minBezel > 2, `Bezel visible on all four sides (thinnest ${minBezel.toFixed(1)}px)`);
  assert(maxBezel <= 10, `Bezel is thin in absolute terms (thickest ${maxBezel.toFixed(1)}px)`);
  assert(
    maxBezel - minBezel < 0.5,
    `Bezel is even on all sides (spread ${(maxBezel - minBezel).toFixed(2)}px)`
  );

  // The real test of "thin": bezel relative to device width. 11px on a 390px
  // shell was 2.8%; the mockup wants noticeably slimmer than that.
  const bezelRatio = maxBezel / f.device.w;
  assert(
    bezelRatio < 0.025,
    `Bezel under 2.5% of device width (${(bezelRatio * 100).toFixed(2)}%)`
  );

  // The device must fit the viewport rather than clip or force scrolling.
  assert(f.device.top >= 0 && f.device.bottom <= f.viewport.h + 1, 'Device fits vertically in the viewport');
  assert(!f.bodyOverflowsX, 'No horizontal page scroll');
  assert(!f.bodyOverflowsY, 'No vertical page scroll');

  // Chat content lives inside the screen, not the browser window.
  assert(f.fabPosition === 'absolute', `Reply button is scoped to the screen (position: ${f.fabPosition})`);
  assert(
    f.fab.right <= f.screen.right && f.fab.bottom <= f.screen.bottom &&
    f.fab.left >= f.screen.left && f.fab.top >= f.screen.top,
    'Reply button sits inside the screen bounds'
  );
  assert(
    f.messages.scrollW <= Math.ceil(f.messages.w),
    `Messages do not overflow the screen horizontally (${f.messages.scrollW} <= ${Math.ceil(f.messages.w)})`
  );

  const bubbles = await page.evaluate(() => {
    const s = document.querySelector('.screen').getBoundingClientRect();
    return Array.from(document.querySelectorAll('.bubble')).map((el) => {
      const b = el.getBoundingClientRect();
      return b.left >= s.left && b.right <= s.right && b.top >= s.top && b.bottom <= s.bottom;
    });
  });
  assert(bubbles.length > 0 && bubbles.every(Boolean), `All ${bubbles.length} bubbles render inside the screen`);
}

// Each bubble should hug its text evenly. The animation sets an explicit
// width in rem, so any error in that measurement shows up as dead space on
// the right edge — the left side is pinned by padding and can't drift.
async function assertBubblePadding(page, label) {
  console.log(`\n── Bubble padding (${label}) ──────────────────────────────`);
  const bubbles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.bubble')).map((el) => {
      const message = el.querySelector('.message');
      const b = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(message);
      const t = range.getBoundingClientRect();
      const cssPad = parseFloat(getComputedStyle(el).paddingRight);
      return {
        text: el.textContent.trim().slice(0, 24),
        left: t.left - b.left,
        right: b.right - t.right,
        cssPad,
      };
    });
  });

  assert(bubbles.length > 0, `${bubbles.length} bubbles measured`);
  bubbles.forEach((b) => {
    const skew = b.right - b.left;
    assert(
      skew <= 2,
      `"${b.text}" padding even (left ${b.left.toFixed(1)}px, right ${b.right.toFixed(1)}px, skew ${skew.toFixed(1)}px)`
    );
    assert(
      Math.abs(b.left - b.cssPad) < 1,
      `"${b.text}" left padding matches CSS (${b.left.toFixed(1)}px vs ${b.cssPad.toFixed(1)}px)`
    );
  });
}

async function assertMobileFullBleed(page) {
  console.log('\n── Mobile stays full-bleed ────────────────────────────────');
  const f = await page.evaluate(readFrame);

  assert(f.deviceDisplay === 'contents', `.device is inert below 900px (display: ${f.deviceDisplay})`);
  assert(f.screenDisplay === 'contents', `.screen is inert below 900px (display: ${f.screenDisplay})`);
  assert(f.fabPosition === 'fixed', `Reply button stays viewport-fixed (position: ${f.fabPosition})`);
  assert(
    Math.abs(f.messages.w - f.viewport.w) < 1,
    `Chat spans the full viewport width (${f.messages.w.toFixed(0)} vs ${f.viewport.w})`
  );
  assert(!f.bodyOverflowsX, 'No horizontal page scroll');
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
  await p1.setViewport(DESKTOP);
  await p1.evaluateOnNewDocument(recordEntrance);
  await p1.goto(url, { waitUntil: 'networkidle0' });

  console.log('\n── Loading state (first visit) ───────────────────────────────');
  await p1.waitForSelector('.bubble.is-loading', { timeout: 5000 });
  assert(true, 'First bubble enters loading state');

  // Wait for first bubble to be revealed and check the count increments
  await p1.waitForFunction(
    (key) => parseInt(localStorage.getItem(key) || '0', 10) >= 1,
    { timeout: 10000 },
    STORAGE_KEY
  );
  const countAfterFirst = await p1.evaluate((key) => parseInt(localStorage.getItem(key), 10), STORAGE_KEY);
  assert(countAfterFirst === 1, `localStorage count = 1 after first bubble revealed (got ${countAfterFirst})`);

  console.log(`\n── Waiting for all ${MESSAGE_COUNT} messages (up to 35s)… ──────────────────`);
  await p1.waitForFunction(
    (n) => document.querySelectorAll('.bubble:not(.is-loading)').length >= n,
    { timeout: 35000 },
    MESSAGE_COUNT
  );
  await new Promise(r => setTimeout(r, 800));

  await assertMessages(p1, MESSAGE_COUNT, 'First visit — all messages');

  const finalCount = await p1.evaluate((key) => parseInt(localStorage.getItem(key), 10), STORAGE_KEY);
  assert(finalCount === MESSAGE_COUNT, `localStorage count = ${MESSAGE_COUNT} after all revealed (got ${finalCount})`);

  const hrefs = await p1.$$eval('.bubble .message a', els => els.map(el => el.getAttribute('href')));
  assert(hrefs.includes('https://youtu.be/CNY_cEXMnwE'), 'YouTube link present');

  await waitForDeviceAtRest(p1);
  await assertDesktopFrame(p1);
  await assertBubblePadding(p1, 'first visit, animated');
  await assertEntranceOrder(p1, { desktop: true, persisted: false });

  await p1.screenshot({ path: path.join(__dirname, 'screenshots/first-visit.png') });

  // ── Partial visit: 2 bubbles persisted, rest animate in ─────────────────
  const p2 = await browser.newPage();
  await p2.setViewport(DESKTOP);
  await p2.evaluateOnNewDocument((key) => localStorage.setItem(key, '2'), STORAGE_KEY);
  await p2.evaluateOnNewDocument(recordEntrance);
  await p2.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  console.log('\n── Partial visit: 2 persisted ─────────────────────────────');
  const earlyCount = await p2.$$eval('.bubble', els => els.length);
  assert(earlyCount >= 2, `At least 2 bubbles immediately present (got ${earlyCount})`);

  await p2.waitForFunction(
    (n) => document.querySelectorAll('.bubble:not(.is-loading)').length >= n,
    { timeout: 35000 },
    MESSAGE_COUNT
  );
  await new Promise(r => setTimeout(r, 800));
  await assertMessages(p2, MESSAGE_COUNT, 'Partial visit — all messages after animation');
  await p2.screenshot({ path: path.join(__dirname, 'screenshots/partial-visit.png') });

  // ── Full return visit: all persisted, no animation ─────────────────────
  const p3 = await browser.newPage();
  await p3.setViewport(DESKTOP);
  await p3.evaluateOnNewDocument((key, n) => localStorage.setItem(key, String(n)), STORAGE_KEY, MESSAGE_COUNT);
  await p3.evaluateOnNewDocument(recordEntrance);
  await p3.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  console.log('\n── Full return visit: no loading dots ─────────────────────');
  const loadingOnReturn = await p3.$$eval('.bubble.is-loading', els => els.length);
  assert(loadingOnReturn === 0, 'No loading dots on full return visit');
  await assertMessages(p3, MESSAGE_COUNT, 'Full return visit — all messages');
  await waitForDeviceAtRest(p3);
  await assertDesktopFrame(p3);
  await assertEntranceOrder(p3, { desktop: true, persisted: true });
  await p3.screenshot({ path: path.join(__dirname, 'screenshots/return-visit.png') });

  // ── Short desktop viewport: the frame scales instead of clipping ────────
  const p4 = await browser.newPage();
  await p4.setViewport({ width: 1440, height: 700 });
  await p4.evaluateOnNewDocument((key, n) => localStorage.setItem(key, String(n)), STORAGE_KEY, MESSAGE_COUNT);
  await p4.evaluateOnNewDocument(recordEntrance);
  await p4.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  console.log('\n── Short desktop viewport (1440×700) ──────────────────────');
  const shortFrame = await p4.evaluate(readFrame);
  assert(shortFrame.device.h < 844, `Device scales down to fit (${shortFrame.device.h.toFixed(0)}px tall)`);
  await waitForDeviceAtRest(p4);
  await assertDesktopFrame(p4);
  await p4.screenshot({ path: path.join(__dirname, 'screenshots/short-viewport.png') });

  // ── Mobile: no frame, chat stays full-bleed ────────────────────────────
  const p5 = await browser.newPage();
  await p5.setViewport(MOBILE);
  await p5.evaluateOnNewDocument((key, n) => localStorage.setItem(key, String(n)), STORAGE_KEY, MESSAGE_COUNT);
  await p5.evaluateOnNewDocument(recordEntrance);
  await p5.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  await assertMobileFullBleed(p5);
  await assertBubblePadding(p5, 'mobile');
  await assertEntranceOrder(p5, { desktop: false, persisted: true });
  await assertMessages(p5, MESSAGE_COUNT, 'Mobile — all messages');
  await p5.screenshot({ path: path.join(__dirname, 'screenshots/mobile.png') });

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─'.repeat(60) + '\n');

  await browser.close();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
})();
