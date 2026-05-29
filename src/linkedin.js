const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const PROFILE_DIR = path.join(__dirname, '..', 'data', 'browser-profile');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PAGES_FILE  = path.join(__dirname, '..', 'data', 'pages.json');

fs.mkdirSync(PROFILE_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Shared persistent context — opened once, reused for all actions
let _context     = null;
let _launchingP  = null;   // Promise<context> while a launch is in progress
                            // Shared by all concurrent callers so only ONE
                            // launchPersistentContext() ever runs at a time.

let _profileScraped = false;

async function isContextAlive(ctx) {
  if (!ctx) return false;
  try {
    const browser = ctx.browser?.();
    if (browser && typeof browser.isConnected === 'function' && !browser.isConnected()) {
      return false;
    }
    ctx.pages();
    return true;
  } catch {
    return false;
  }
}

async function getContext() {
  // Fast path — context exists and is alive
  if (_context && await isContextAlive(_context)) return _context;

  // ── Race-condition guard ──────────────────────────────────────────────────
  // The profile-scraping startup task and the scheduler both call getContext()
  // at server startup, both see _context === null, and both race to call
  // launchPersistentContext() — which throws "Opening in existing browser
  // session" when two processes try to use the same profile directory.
  //
  // Fix: store the in-flight launch Promise in _launchingP. Any concurrent
  // caller that arrives while a launch is in progress returns that same
  // Promise instead of starting a second launch.
  if (_launchingP) return _launchingP;

  // Stale / dead context — clean up before relaunching
  if (_context) {
    try { await _context.close(); } catch {}
    _context = null;
    _profileScraped = false;
  }

  _launchingP = (async () => {
    try {
      const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
        channel: 'msedge',
        headless: false,
        slowMo: 30,
        viewport: { width: 1280, height: 800 },
        args: [
          '--disable-blink-features=AutomationControlled',
          '--window-position=0,0',
          '--window-size=1,1'
        ]
      });

      ctx.on('close', () => { _context = null; _profileScraped = false; });
      _context = ctx;
      return ctx;
    } finally {
      _launchingP = null;   // always release the lock, success or failure
    }
  })();

  return _launchingP;
}

// One-time login — opens a visible Edge window, user logs in, profile is saved
async function login() {
  console.log('\n[LinkedIn] Opening Edge for login...');
  console.log('[LinkedIn] Log in normally. Window closes automatically once done.\n');

  // Close any existing headless context first
  if (_context) { await _context.close(); _context = null; }

  const ctx  = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    slowMo: 40,
    viewport: { width: 1280, height: 800 }
  });

  const page = await ctx.newPage();
  await page.goto('https://www.linkedin.com/login');

  await page.waitForURL('**/feed/**', { timeout: 180_000 });
  console.log('[LinkedIn] Logged in! Saving profile…');

  // Scrape profile right after login while the feed page is open
  await scrapeAndCacheProfile(page);

  await ctx.close();
  _context = null; // will be re-opened headlessly next time
}

async function isLoggedIn() {
  // Profile folder exists = user has logged in at least once
  return fs.existsSync(path.join(PROFILE_DIR, 'Default'));
}

// ─── Helpers shared by all post types ────────────────────────────────────────

async function openPostComposer(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Save debug screenshot so we can see what the browser loaded
  await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_feed.png'), fullPage: false });
  console.log('[LinkedIn] Feed loaded. URL:', page.url());

  // If redirected to login, the session expired — tell the user clearly
  if (page.url().includes('/login') || page.url().includes('/authwall')) {
    throw new Error('SESSION_EXPIRED: LinkedIn asked to log in again. Please run: node login.js');
  }

  // Use JS to find and click the "Start a post" button — works regardless of class names
  const clicked = await page.evaluate(() => {
    // Look for any clickable element whose text is "Start a post"
    const all = Array.from(document.querySelectorAll('button, [role="button"], input[placeholder]'));
    for (const el of all) {
      const text  = (el.innerText || el.placeholder || el.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('start a post') || text.includes('want to talk') || text.includes('share an update')) {
        el.click();
        return true;
      }
    }
    return false;
  });

  if (!clicked) {
    // Last resort: try CSS selectors one by one
    const selectors = [
      '.share-box-feed-entry__trigger',
      '[data-control-name="share.sharebox_trigger"]',
      '.share-creation-state__placeholder',
      'div.feed-shared-create-feed-sharing-trigger'
    ];
    let found = false;
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.click();
        found = true;
        break;
      }
    }
    if (!found) {
      await page.screenshot({ path: path.join(UPLOADS_DIR, 'error_no_composer.png') });
      throw new Error('Could not find "Start a post" button. Check uploads/error_no_composer.png');
    }
  }

  // Wait for any contenteditable editor to appear (LinkedIn changes class names)
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_composer.png') });
  console.log('[LinkedIn] Composer opened.');
}

// ─── Identity ("Post as") helpers ────────────────────────────────────────────
// LinkedIn's composer has an identity selector at the top — typically showing
// "Your Name ▼" with "Post to Anyone" beneath it. Clicking opens a popover
// listing your personal profile + every Company/Showcase page you can post as.

function readPagesCache() {
  try {
    if (!fs.existsSync(PAGES_FILE)) return null;
    return JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8'));
  } catch { return null; }
}

function writePagesCache(payload) {
  fs.writeFileSync(PAGES_FILE, JSON.stringify(payload, null, 2), 'utf-8');
}

// Scrape the list of Company / Showcase pages the user manages.
// LinkedIn lists them in the "Me ▼" menu under the "Manage" section, each
// row being an <a> linking to /company/<slug>/admin/. We open the menu,
// pull every such link, and cache to data/pages.json.
async function scrapePages() {
  const ctx  = await getContext();
  const page = await ctx.newPage();
  try {
    console.log('[LinkedIn] Scraping managed pages from the "Me" menu…');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    if (page.url().includes('/login') || page.url().includes('/authwall')) {
      throw new Error('SESSION_EXPIRED: LinkedIn asked to log in again. Please run: node login.js');
    }

    // Click the "Me ▼" nav button to open the dropdown.
    // We do the click via page.evaluate() rather than Playwright's locator
    // so a) we can match by exact visible text "Me" (not substring like "Menu")
    // and b) the synthetic .click() bypasses the overlay obstruction checks
    // that fail when LinkedIn renders things like the Learning popover on top.
    const opened = await page.evaluate(() => {
      // Try the well-known specific class first
      const specific = document.querySelector('button.global-nav__primary-link-me-menu-trigger')
                    || document.querySelector('.global-nav__me button')
                    || document.querySelector('button.global-nav__me-photo');
      if (specific) { specific.click(); return true; }

      // Fallback: find a nav button whose label/visible text is exactly "Me"
      // (not "Menu", not "Messaging", not "Notifications")
      const all = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const el of all) {
        const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const text = (el.innerText || '').trim().toLowerCase();
        if (aria === 'me' || text === 'me' || aria.startsWith('me, ')) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (!opened) {
      await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_no_me_menu.png') });
      throw new Error('Could not open the "Me" menu — LinkedIn UI may have changed');
    }
    console.log('[LinkedIn] Opened "Me" menu via JS click');
    await page.waitForTimeout(1500);

    // Only pages the user MANAGES have a "Company: <Name>" label in the
    // "Me" dropdown's Manage section. Everywhere else /company/ links appear
    // (sidebars, suggestions, news widgets) the label is just the company
    // name with no prefix — so the "Company:" prefix is a clean filter for
    // the dropdown items only.
    const pages = await page.evaluate(() => {
      const out  = [];
      const seen = new Set();
      const links = Array.from(document.querySelectorAll('a[href*="/company/"]'));
      for (const a of links) {
        const raw = (a.innerText || '').trim();
        // Must start with "Company:" (case-insensitive) — that's the only
        // signal LinkedIn gives us that this link is in the Manage section
        if (!/^company\s*:/i.test(raw)) continue;

        const href = a.getAttribute('href') || '';
        const m = href.match(/\/company\/([^\/?#]+)/);
        if (!m) continue;
        const slug = m[1];
        if (!slug || slug === 'setup' || slug === 'products' || slug.length < 2) continue;
        if (seen.has(slug)) continue;

        const name = raw.replace(/^\s*company\s*:\s*/i, '').trim();
        if (!name) continue;
        seen.add(slug);
        out.push({
          id:   slug,
          slug,
          name,
          adminUrl: `https://www.linkedin.com/company/${slug}/admin/`,
          kind: 'page'
        });
      }
      return out;
    });

    // Dismiss the menu so the browser is left in a clean state
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    const payload = {
      scrapedAt: new Date().toISOString(),
      identities: pages
    };
    writePagesCache(payload);
    console.log(`[LinkedIn] Scraped ${pages.length} managed page(s):`,
      pages.map(p => `${p.name} (${p.slug})`).join(', '));

    await page.close();
    return payload;
  } catch (err) {
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'error_scrape_pages.png') });
    await page.close();
    throw err;
  }
}

// Open the composer for a specific Company Page.
// Flow:
//   1. Navigate to /company/<slug>/admin/
//   2. Click the page's "+ Create" button (left sidebar or top action bar)
//   3. In the "Create" modal that opens, click "Start a post"
//   4. Wait for the composer's contenteditable to appear
async function openCompanyPageComposer(page, slug) {
  const adminUrl = `https://www.linkedin.com/company/${slug}/admin/`;
  console.log(`[LinkedIn] Opening company page composer for: ${slug}`);

  // Use 'commit' (fires on first byte received) instead of 'domcontentloaded'
  // because LinkedIn's admin page is React-heavy and the domcontentloaded
  // event can stall for minutes waiting for JS bundles. After commit we wait
  // explicitly for any clickable element to appear.
  await page.goto(adminUrl, { waitUntil: 'commit', timeout: 20000 });

  // Wait for the page to actually render (React mounts buttons/nav after hydration)
  await page.waitForSelector('button, [role="button"], a', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // Always screenshot at load — critical for debugging when the button isn't found
  await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_admin_loaded.png') });
  console.log('[LinkedIn] Admin page loaded. URL:', page.url());

  if (page.url().includes('/login') || page.url().includes('/authwall')) {
    throw new Error('SESSION_EXPIRED: LinkedIn asked to log in again. Please run: node login.js');
  }

  // ── Step 1: click the page's "+ Create" button ───────────────────────────
  // The button lives in the left nav sidebar of the page admin UI.
  // Its exact label varies — "Create", "+ Create", "Create post" — and the
  // element may be a <button>, <a>, or <div role="button">. We try several
  // strategies in priority order.
  const createResult = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll(
      'button, a[role="button"], div[role="button"], [role="button"], a, [role="menuitem"]'
    ));

    // Strategy A: data-control-name attribute (LinkedIn's internal label)
    for (const el of candidates) {
      const ctrl = (el.getAttribute('data-control-name') || '').toLowerCase();
      if (ctrl && ctrl.includes('create') && !ctrl.includes('article') && !ctrl.includes('newsletter')) {
        el.click();
        return `ctrl-attr:${ctrl}`;
      }
    }

    // Strategy B: short text match — "create" or "+ create" (≤20 chars, no longer phrases)
    for (const el of candidates) {
      const raw = ((el.innerText || el.getAttribute('aria-label') || el.textContent || '') + '')
        .replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      // Accept labels ≤20 chars containing "create" but not "create article/newsletter/event/job"
      if (raw.length <= 20 && /\bcreate\b/.test(raw) &&
          !/article|newsletter|event|job/.test(raw)) {
        el.click();
        return `text:${raw}`;
      }
    }

    // Strategy C: any element whose label STARTS with "create" (catches "Create post", etc.)
    for (const el of candidates) {
      const raw = ((el.innerText || el.getAttribute('aria-label') || el.textContent || '') + '')
        .replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (/^[+\s]*create(\s+post)?$/.test(raw)) {
        el.click();
        return `regex:${raw}`;
      }
    }

    return null;
  });

  if (!createResult) {
    // Log every button/link text so we can see what's actually on the page
    const allBtnTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, [role="button"], a'))
        .map(el => (el.innerText || el.getAttribute('aria-label') || '').replace(/\n/g, ' ').trim())
        .filter(t => t && t.length < 80)
        .slice(0, 60)
    );
    console.log('[LinkedIn] All clickable elements on admin page:', JSON.stringify(allBtnTexts, null, 2));
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_no_create_btn.png') });
    throw new Error('Could not find page "+ Create" button — check uploads/debug_no_create_btn.png and server logs');
  }

  console.log(`[LinkedIn] Clicked "+ Create" via strategy: ${createResult}`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_after_create_click.png') });

  // ── Step 2: click "Start a post" in the modal (if it appeared) ───────────
  // After clicking "+ Create" LinkedIn shows a modal with content-type options:
  //   "Start a post", "Write article", "Share that you're hiring", etc.
  // If the composer opens directly (some page admin variants skip the modal),
  // we detect that and skip this step.
  const editorAlreadyOpen = await page.locator('[contenteditable="true"]')
    .isVisible({ timeout: 2000 }).catch(() => false);

  if (!editorAlreadyOpen) {
    const startPostResult = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll(
        'button, a, [role="button"], [role="menuitem"], div[role="option"]'
      ));
      for (const el of all) {
        const t = ((el.innerText || el.getAttribute('aria-label') || el.textContent || '') + '')
          .replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (t.includes('start a post') || t === 'post' || t === 'write a post') {
          el.click();
          return t;
        }
      }
      return null;
    });

    if (!startPostResult) {
      await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_no_start_post.png') });
      // Log all visible modal options for debugging
      const modalItems = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="dialog"] button, [role="dialog"] a, [role="menu"] li, [role="listbox"] [role="option"]'))
          .map(el => (el.innerText || '').trim())
          .filter(Boolean)
      );
      console.log('[LinkedIn] Modal items found:', modalItems);
      throw new Error('Could not find "Start a post" in the Create modal — check uploads/debug_no_start_post.png');
    }

    console.log(`[LinkedIn] Clicked "Start a post" (matched: "${startPostResult}")`);
  } else {
    console.log('[LinkedIn] Composer already open after Create click — skipping "Start a post" step');
  }

  // ── Step 3: wait for the composer's contenteditable to appear ────────────
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_page_composer.png') });
  console.log(`[LinkedIn] Page composer ready for "${slug}".`);
}

async function typeIntoEditor(page, text) {
  // Try multiple editor selectors — LinkedIn changes these frequently
  const editorSelectors = [
    '.ql-editor[contenteditable="true"]',
    '.editor-content[contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
    'div[contenteditable="true"].slate-editor',
    'div[contenteditable="true"]'
  ];

  let editor = null;
  for (const sel of editorSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      editor = el;
      console.log('[LinkedIn] Editor found with selector:', sel);
      break;
    }
  }

  if (!editor) throw new Error('Could not find post text editor');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);

  // ── CRITICAL: use insertText (not .type) ──
  // .type() simulates real keystrokes and silently DROPS characters that aren't
  // on a physical keyboard — e.g. Unicode math-bold (𝗛𝗲𝗹𝗹𝗼), italic (𝘏𝘦𝘭𝘭𝘰), emojis,
  // smart quotes, em-dashes. That used to cause whole paragraphs to vanish or
  // truncate mid-word when the formatted post hit a bold span.
  //
  // insertText() fires a single composition/input event into the focused
  // contenteditable, so the browser inserts the text verbatim. Newlines map to
  // soft line breaks the same way a real paste does, which is exactly what
  // LinkedIn's editor expects.

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) {
      await page.keyboard.insertText(lines[i]);
      // Tiny pause between chunks so Slate/Quill can reconcile each insert
      await page.waitForTimeout(40);
    }
    if (i < lines.length - 1) {
      await page.keyboard.press('Shift+Enter');
      await page.waitForTimeout(30);
    }
  }

  // Verify everything actually landed — guard against silent truncation
  await page.waitForTimeout(600);
  const typedLen = await editor.evaluate(el => (el.innerText || '').length).catch(() => 0);
  const expectedLen = text.length;
  if (typedLen < expectedLen * 0.9) {
    console.warn(`[LinkedIn] ⚠ Editor only has ${typedLen}/${expectedLen} chars — retrying with clipboard paste fallback`);
    // Fallback: clear and paste via clipboard (most reliable for Unicode-heavy text)
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    try {
      await page.evaluate(async (t) => {
        await navigator.clipboard.writeText(t);
      }, text);
      await page.keyboard.press('Control+V');
      await page.waitForTimeout(500);
      const after = await editor.evaluate(el => (el.innerText || '').length).catch(() => 0);
      console.log(`[LinkedIn] After clipboard paste: ${after}/${expectedLen} chars`);
    } catch (e) {
      console.warn('[LinkedIn] Clipboard paste failed:', e.message);
    }
  } else {
    console.log(`[LinkedIn] Editor populated: ${typedLen}/${expectedLen} chars ✓`);
  }
}

async function clickPostButton(page) {
  const selectors = [
    'button.share-actions__primary-action',
    'button[aria-label="Post"]',
    '.share-creation-state__footer button.artdeco-button--primary',
    'button:has-text("Post")'
  ];

  for (const sel of selectors) {
    const btn = page.locator(sel).last();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      return;
    }
  }
  throw new Error('Could not find Post button');
}

// Extract plain alphabetic words (4+ chars) — strips emojis, Unicode bold/italic, hashtags
function extractMatchWords(text) {
  return (text.replace(/[^\x00-\x7F]/g, ' ').toLowerCase().match(/[a-z]{4,}/g) || []).slice(0, 6);
}

async function verifyAndGetPostId(page, postText) {
  // ── Step 1: dismiss any duplicate-post warning (counts as success) ────────
  await page.waitForTimeout(1500);
  const afterClickText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const DUPE_SIGNALS = ['already shared', 'duplicate', 'posted this before', 'share it again'];
  if (DUPE_SIGNALS.some(s => afterClickText.toLowerCase().includes(s))) {
    console.log('[LinkedIn] Duplicate warning detected — post already live');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }

  // ── Step 2: poll the activity feed with refresh-and-retry ────────────────
  // LinkedIn can take anywhere from 1s to ~15s to surface a brand-new post on
  // /recent-activity/shares/. Instead of a single 5.5s wait + guess, we poll
  // up to 4 times, hard-refreshing the page between attempts.
  //
  //   Attempt 1:  initial 2s settle, then match
  //   Attempt 2:  +3s wait, hard reload, match
  //   Attempt 3:  +4s wait, hard reload, match
  //   Attempt 4:  +6s wait, hard reload, match
  //
  // Worst-case total: ~17s before giving up. Best case (post propagates
  // immediately): ~4s. We return the moment we find a confident match.

  const matchWords = extractMatchWords(postText);
  console.log(`[LinkedIn] Matching with words: ${matchWords.join(', ')}`);

  // Navigate to recent activity once; subsequent attempts use page.reload()
  await page.goto('https://www.linkedin.com/in/me/recent-activity/shares/', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });

  const attempts = [
    { settleMs: 2000, label: 'initial' },
    { settleMs: 3000, label: 'retry-1', reload: true },
    { settleMs: 4000, label: 'retry-2', reload: true },
    { settleMs: 6000, label: 'retry-3', reload: true }
  ];

  for (const attempt of attempts) {
    if (attempt.reload) {
      console.log(`[LinkedIn] [${attempt.label}] Reloading activity feed…`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(attempt.settleMs);

    const result = await page.evaluate((matchWords) => {
      const posts = Array.from(document.querySelectorAll(
        '[data-urn], .feed-shared-update-v2, .occludable-update'
      ));
      for (const post of posts) {
        const text = (post.innerText || '')
          .replace(/[^\x00-\x7F]/g, ' ').toLowerCase();
        const hits = matchWords.filter(w => text.includes(w)).length;
        // At least 2 words must match (guards against false positives)
        if (hits >= Math.min(2, matchWords.length)) {
          const urn   = post.getAttribute('data-urn') || '';
          const match = urn.match(/activity:(\d+)/) ||
                        (post.querySelector('a[href*="activity-"]')?.href || '')
                          .match(/activity-(\d+)/);
          return { found: true, activityId: match?.[1] || null, hits };
        }
      }
      return { found: false, activityId: null };
    }, matchWords);

    if (result.found && result.activityId) {
      console.log(`[LinkedIn] ✓ Post confirmed on [${attempt.label}] (${result.hits}/${matchWords.length} words matched). Activity ID: ${result.activityId}`);
      return result.activityId;
    }
    console.log(`[LinkedIn] [${attempt.label}] no match yet…`);
  }

  // ── Step 3: word-match never succeeded — fall back to topmost activity ───
  console.warn('[LinkedIn] Word match failed across all attempts — falling back to topmost activity link');
  const firstLink = await page.locator('a[href*="activity-"]').first()
    .getAttribute('href').catch(() => null);
  const fallbackId = firstLink?.match(/activity-(\d+)/)?.[1] || null;
  if (fallbackId) {
    console.log(`[LinkedIn] Fallback activity ID: ${fallbackId}`);
    return fallbackId;
  }

  console.warn('[LinkedIn] ⚠ Could not get activity ID — post is published but comment monitor won\'t track it');
  return null;
}

// Same verification logic as verifyAndGetPostId, but scoped to a Company
// Page's posts feed instead of the personal activity feed. Page posts never
// appear under /in/me/recent-activity/shares/ so we have to look in the
// page's own feed at /company/<slug>/posts/?feedView=all.
async function verifyAndGetPagePostId(page, slug, postText) {
  const matchWords = extractMatchWords(postText);
  console.log(`[Page ${slug}] Matching with words: ${matchWords.join(', ')}`);

  const feedUrl = `https://www.linkedin.com/company/${slug}/posts/?feedView=all`;
  await page.goto(feedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const attempts = [
    { settleMs: 2500, label: 'initial' },
    { settleMs: 3000, label: 'retry-1', reload: true },
    { settleMs: 4000, label: 'retry-2', reload: true },
    { settleMs: 6000, label: 'retry-3', reload: true }
  ];

  for (const attempt of attempts) {
    if (attempt.reload) {
      console.log(`[Page ${slug}] [${attempt.label}] Reloading page feed…`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(attempt.settleMs);

    const result = await page.evaluate((matchWords) => {
      const posts = Array.from(document.querySelectorAll(
        '[data-urn], .feed-shared-update-v2, .occludable-update'
      ));
      for (const post of posts) {
        const text = (post.innerText || '')
          .replace(/[^\x00-\x7F]/g, ' ').toLowerCase();
        const hits = matchWords.filter(w => text.includes(w)).length;
        if (hits >= Math.min(2, matchWords.length)) {
          const urn = post.getAttribute('data-urn') || '';

          // LinkedIn page posts use various URN types:
          //   urn:li:activity:12345       (personal & page posts)
          //   urn:li:ugcPost:12345        (page posts via UGC API)
          //   urn:li:share:12345          (reshares)
          // All end with a numeric ID — extract the last segment regardless of type.
          const urnId = urn.match(/:(\d{10,20})$/)?.[1] || null;

          // Also search all <a> hrefs on the post card
          const hrefs = Array.from(post.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href') || '');
          // activity-123, ugcPost:123, /posts/slug-123-suffix/, etc.
          const hrefId = hrefs.map(h =>
            h.match(/activity[-:](\d{10,20})/)?.[1] ||
            h.match(/ugcPost[:_](\d{10,20})/)?.[1]  ||
            h.match(/share[:_](\d{10,20})/)?.[1]     ||
            null
          ).find(Boolean) || null;

          const activityId = urnId || hrefId;
          return { found: true, activityId, hits };
        }
      }
      return { found: false, activityId: null };
    }, matchWords);

    if (result.found && result.activityId) {
      console.log(`[Page ${slug}] ✓ Page post confirmed on [${attempt.label}] (${result.hits}/${matchWords.length} words). Activity ID: ${result.activityId}`);
      return result.activityId;
    }
    if (result.found && !result.activityId) {
      // Post text matched but no ID could be extracted — log for debugging
      console.warn(`[Page ${slug}] [${attempt.label}] Post text matched but could not extract activity ID — will retry`);
    }
    console.log(`[Page ${slug}] [${attempt.label}] no match yet…`);
  }

  // Fallback: topmost post on the page feed should be the one just published.
  // Check multiple link patterns since page post URLs vary.
  const fallbackHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    for (const a of links) {
      const h = a.getAttribute('href') || '';
      if (/activity[-:](\d{10,20})/.test(h) || /ugcPost[:_](\d{10,20})/.test(h)) return h;
    }
    // Also check data-urn on top-level post containers
    const urns = Array.from(document.querySelectorAll('[data-urn]'))
      .map(el => el.getAttribute('data-urn') || '');
    return urns.find(u => /:(\d{10,20})$/.test(u)) || null;
  }).catch(() => null);

  const fallbackId = fallbackHref
    ? (fallbackHref.match(/activity[-:](\d{10,20})/)?.[1] ||
       fallbackHref.match(/ugcPost[:_](\d{10,20})/)?.[1]  ||
       fallbackHref.match(/:(\d{10,20})$/)?.[1] || null)
    : null;

  if (fallbackId) {
    console.log(`[Page ${slug}] Fallback activity ID: ${fallbackId}`);
    return fallbackId;
  }
  console.warn(`[Page ${slug}] ⚠ Could not get page activity ID`);
  return null;
}

// ─── File payload helper ─────────────────────────────────────────────────────
// LinkedIn's media editor sniffs file extensions and rejects files without a
// known one ("Something went wrong — File(s) not supported"). Multer stores
// uploaded files with a random hash and historically with NO extension, so
// we read the raw bytes here, sniff the magic number, and present the file
// to Playwright with a proper {name, mimeType, buffer} payload. This way
// LinkedIn always sees e.g. "image.jpg" instead of "abc123def456".
function sniffMime(buf) {
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47)
    return { mime: 'image/png',  ext: '.png'  };
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF)
    return { mime: 'image/jpeg', ext: '.jpg'  };
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return { mime: 'image/gif',  ext: '.gif'  };
  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50)
    return { mime: 'image/webp', ext: '.webp' };
  // PDF: 25 50 44 46
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return { mime: 'application/pdf', ext: '.pdf' };
  return null;
}

function pathToFilePayload(p, fallbackName) {
  const buf = fs.readFileSync(p);
  let ext  = path.extname(p).toLowerCase();
  let mime = null;

  const sniffed = sniffMime(buf.slice(0, 16));
  if (sniffed) {
    mime = sniffed.mime;
    if (!ext) ext = sniffed.ext;        // use sniffed ext only if file on disk lacks one
  } else {
    // Fallback by extension
    const map = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf'
    };
    mime = map[ext] || 'application/octet-stream';
  }

  // Build a clean display name with proper extension
  const base = fallbackName
    ? path.basename(fallbackName, path.extname(fallbackName))
    : path.basename(p, path.extname(p));
  return { name: base + (ext || '.bin'), mimeType: mime, buffer: buf };
}

// ─── Post types ───────────────────────────────────────────────────────────────

async function createTextPost(text, opts = {}) {
  const ctx  = await getContext();
  const page = await ctx.newPage();
  try {
    if (opts.postAsPageId) {
      await openCompanyPageComposer(page, opts.postAsPageId);
    } else {
      await openPostComposer(page);
    }
    await typeIntoEditor(page, text);
    await clickPostButton(page);
    // Personal posts: look in /in/me/recent-activity/shares/
    // Page posts:     look in /company/<slug>/posts/?feedView=all
    const activityId = opts.postAsPageId
      ? await verifyAndGetPagePostId(page, opts.postAsPageId, text)
      : await verifyAndGetPostId(page, text);
    await page.close();
    return activityId;
  } catch (err) {
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'error_screenshot.png') });
    await page.close();
    throw err;
  }
}

async function createImagePost(text, imagePaths, opts = {}) {
  const ctx  = await getContext();
  const page = await ctx.newPage();
  // Convert disk paths → payloads with sniffed MIME + proper filename.
  // This is what makes LinkedIn accept files that multer saved without an
  // extension (the cause of "File(s) not supported" errors).
  const imagePayloads = imagePaths.map(p => pathToFilePayload(p));
  console.log(`[LinkedIn] Image payloads:`, imagePayloads.map(f => `${f.name} (${f.mimeType}, ${f.buffer.length}b)`).join(', '));
  try {
    if (opts.postAsPageId) {
      await openCompanyPageComposer(page, opts.postAsPageId);
    } else {
      await openPostComposer(page);
    }

    // Intercept the OS file chooser BEFORE clicking the button
    // This prevents the native file dialog from opening and blocking automation
    const mediaSelectors = [
      '[aria-label="Add a photo"]',
      '[aria-label="Add media"]',
      '[aria-label*="photo" i]',
      '[aria-label*="media" i]',
      'button:has-text("Photo")',
      '.share-creation-state__attach-images'
    ];

    let uploaded = false;

    for (const sel of mediaSelectors) {
      const btn = page.locator(sel).first();
      if (!(await btn.isVisible({ timeout: 2000 }).catch(() => false))) continue;

      try {
        // waitForEvent('filechooser') intercepts the native picker before it opens
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 6000 }),
          btn.click()
        ]);
        await fileChooser.setFiles(imagePayloads);
        uploaded = true;
        console.log('[LinkedIn] Image files set via file chooser interceptor');
        break;
      } catch (e) {
        console.log(`[LinkedIn] filechooser not triggered by "${sel}", trying next…`);
      }
    }

    if (!uploaded) {
      // Last-resort: set files directly on hidden file input (no button click needed)
      console.log('[LinkedIn] Falling back to direct setInputFiles on hidden input');
      await page.locator('input[type="file"]').first().setInputFiles(imagePayloads);
    }

    // Wait for LinkedIn to process/upload the image(s)
    await page.waitForTimeout(4000);

    // LinkedIn may show a media confirmation modal — dismiss it to get back to editor
    for (const closeSel of [
      'button:has-text("Done")',
      'button:has-text("Next")',
      'button:has-text("Save")',
      '[aria-label="Done"]'
    ]) {
      const btn = page.locator(closeSel).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1500);
        console.log(`[LinkedIn] Dismissed media modal via "${closeSel}"`);
        break;
      }
    }

    // Screenshot so we can see what state we're in before typing
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_after_image.png') });

    await typeIntoEditor(page, text);
    await clickPostButton(page);
    // Personal posts: look in /in/me/recent-activity/shares/
    // Page posts:     look in /company/<slug>/posts/?feedView=all
    const activityId = opts.postAsPageId
      ? await verifyAndGetPagePostId(page, opts.postAsPageId, text)
      : await verifyAndGetPostId(page, text);
    await page.close();
    return activityId;
  } catch (err) {
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'error_screenshot.png') });
    await page.close();
    throw err;
  }
}

async function createCarouselPost(text, documentPath, title, opts = {}) {
  const ctx  = await getContext();
  const page = await ctx.newPage();
  // Use a payload with proper {.pdf, application/pdf} so LinkedIn accepts
  // the extension-less hashes multer historically wrote to disk.
  const docPayload = pathToFilePayload(documentPath, title ? `${title}.pdf` : 'carousel.pdf');
  console.log(`[LinkedIn] PDF payload: ${docPayload.name} (${docPayload.mimeType}, ${docPayload.buffer.length}b)`);
  try {
    if (opts.postAsPageId) {
      await openCompanyPageComposer(page, opts.postAsPageId);
    } else {
      await openPostComposer(page);
    }

    // ── Find the "Add a document" button ─────────────────────────────────────
    // LinkedIn now hides the document/PDF button inside the "+" (more options)
    // overflow menu in the composer toolbar. Photo & event buttons remain
    // directly on the toolbar, but document does not. We must open that menu
    // first, then click the document item inside it.

    const docButtonSelectors = [
      '[aria-label="Add a document"]',
      '[aria-label*="add a document" i]',
      '[aria-label*="document" i]',
      'button:has-text("Add a document")',
      'div[role="button"]:has-text("Add a document")',
      'button:has-text("Document")',
      '[data-test-icon="document-medium"]',
      '.share-creation-state__attach-document'
    ];

    async function findDocButton() {
      for (const sel of docButtonSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) return { btn, sel };
      }
      return null;
    }

    // Step 1: look for the document button directly on the toolbar
    let docBtn = await findDocButton();

    // Step 2: if not found, open the "+" / "More" overflow menu and look again
    if (!docBtn) {
      console.log('[LinkedIn] Document button not on toolbar — opening "+" menu');
      const moreSelectors = [
        '[aria-label="More"]',
        '[aria-label="Show more"]',
        '[aria-label*="more" i]',
        'button:has-text("More")',
        // The "+" icon button at the end of the composer toolbar
        '.share-box-footer__main-actions button:last-child',
        'button[aria-haspopup="true"]'
      ];
      let menuOpened = false;
      for (const sel of moreSelectors) {
        const moreBtn = page.locator(sel).first();
        if (await moreBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
          await moreBtn.click();
          await page.waitForTimeout(800);
          console.log(`[LinkedIn] Clicked "More" via "${sel}"`);
          menuOpened = true;
          break;
        }
      }
      if (!menuOpened) {
        console.warn('[LinkedIn] Could not find "+" / More button');
        await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_no_more_button.png') });
      }
      docBtn = await findDocButton();
    }

    let uploaded = false;

    if (docBtn) {
      try {
        // Intercept the OS file chooser before it opens
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 6000 }),
          docBtn.btn.click()
        ]);
        await fileChooser.setFiles(docPayload);
        uploaded = true;
        console.log(`[LinkedIn] PDF set via file chooser interceptor (selector: ${docBtn.sel})`);
      } catch (e) {
        console.warn(`[LinkedIn] filechooser not triggered after clicking document button: ${e.message}`);
      }
    } else {
      console.warn('[LinkedIn] Could not find "Add a document" button anywhere');
      await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_no_doc_button.png') });
    }

    if (!uploaded) {
      // Last-ditch fallback: write directly to a hidden file input
      console.log('[LinkedIn] Falling back to direct setInputFiles on hidden input');
      const fileInputs = page.locator('input[type="file"]');
      const count = await fileInputs.count();
      console.log(`[LinkedIn] Found ${count} file input(s) on page`);
      if (count > 0) {
        await fileInputs.first().setInputFiles(docPayload);
        uploaded = true;
      } else {
        throw new Error('Could not find document upload button or file input — LinkedIn UI may have changed');
      }
    }

    // PDF upload takes longer — wait for processing
    await page.waitForTimeout(5000);

    // Fill in the carousel title if LinkedIn shows a title field
    const titleInput = page.locator('input[placeholder*="title" i], input[aria-label*="title" i]').first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill(title || 'Carousel');
      await page.waitForTimeout(500);
    }

    // Click Next/Done to exit the document upload modal
    for (const closeSel of [
      'button:has-text("Done")',
      'button:has-text("Next")',
      'button:has-text("Save")',
      '[aria-label="Done"]'
    ]) {
      const btn = page.locator(closeSel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1500);
        console.log(`[LinkedIn] Dismissed document modal via "${closeSel}"`);
        break;
      }
    }

    await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_after_carousel.png') });

    await typeIntoEditor(page, text);
    await clickPostButton(page);
    // Personal posts: look in /in/me/recent-activity/shares/
    // Page posts:     look in /company/<slug>/posts/?feedView=all
    const activityId = opts.postAsPageId
      ? await verifyAndGetPagePostId(page, opts.postAsPageId, text)
      : await verifyAndGetPostId(page, text);
    await page.close();
    return activityId;
  } catch (err) {
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'error_screenshot.png') });
    await page.close();
    throw err;
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

async function getPostComments(activityId) {
  const ctx  = await getContext();
  const page = await ctx.newPage();
  try {
    const url = `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
    console.log(`[LinkedIn] Fetching comments from: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_comments.png') });
    console.log('[LinkedIn] Post page loaded. URL:', page.url());

    // Detect deleted / unavailable post
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('This post cannot be displayed') ||
        bodyText.includes('post is no longer available') ||
        bodyText.includes("content isn't available")) {
      await page.close();
      throw new Error('POST_DELETED');
    }

    // Dump full page text so we can see what's there
    const pageText = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(UPLOADS_DIR, 'debug_comments_text.txt'), pageText, 'utf-8');
    console.log('[LinkedIn] Page text dumped → uploads/debug_comments_text.txt');

    // Expand load-more buttons
    for (let i = 0; i < 5; i++) {
      const moreBtn = page.locator([
        'button:has-text("Load more comments")',
        'button:has-text("Show more comments")',
        'button:has-text("View more comments")'
      ].join(','));
      if (await moreBtn.first().isVisible({ timeout: 800 }).catch(() => false)) {
        await moreBtn.first().click();
        await page.waitForTimeout(1500);
      } else break;
    }

    // Scroll to render lazy content
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(2000);

    // ── Strategy 1: Playwright locator — find every element whose text is "Reply" ──
    const replyLocator = page.locator('button, span, a').filter({ hasText: /^Reply$/ });
    let count = await replyLocator.count();
    console.log(`[LinkedIn] Reply elements found by locator: ${count}`);

    // ── Strategy 2 fallback: page.evaluate scanning all elements ──────────────────
    let rawContainers = [];
    if (count === 0) {
      console.log('[LinkedIn] Locator found 0 — falling back to evaluate scan');
      rawContainers = await page.evaluate(() => {
        const results = [];
        const seen    = new Set();

        // Only look for "Reply" buttons that are INSIDE the comments section.
        // Walking too far up the DOM from a "Reply" nav element can reach the
        // entire page wrapper — which includes the post author block
        // ("Strategy Unchained · 97 followers") and gets parsed as a false comment.
        //
        // Guard: stop climbing if the container exceeds 20 lines — that means
        // we've overshot the comment block and are now in a page-level wrapper.
        const MAX_LINES = 20;

        for (const el of document.querySelectorAll('*')) {
          const t = (el.textContent || '').trim();
          if (t !== 'Reply') continue;

          // Only consider leaf/near-leaf Reply elements (actual buttons/spans)
          if ((el.children?.length || 0) > 2) continue;

          let container = el.parentElement;
          for (let i = 0; i < 12; i++) {  // reduced from 18 → stays closer to the comment
            if (!container) break;
            const lines = (container.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
            // A real comment container needs: author + metadata + text + Like + Reply
            // = ≥ 5 lines. Stopping at 3 (e.g. "text / Like / Reply") loses the author.
            if (lines.length >= 5 && lines.length <= MAX_LINES) break;
            if (lines.length > MAX_LINES) { container = null; break; } // overshot — discard
            container = container.parentElement;
          }
          if (!container) continue;

          const text = container.innerText || '';
          // Final guard: reject containers that are the POST header, not a comment.
          // Distinguishers:
          //   • "Repost" is a post-level action — never appears on comments
          //   • "Boost" / "Get up to N more impressions" / "1 comment" — post-only chrome
          // NOTE: do NOT reject on "followers" alone — real comments from Pages
          // (e.g. "Vivify Synergy InfoTech / 16 followers / 1m / [text]") have that.
          if (/\bRepost\b|\bBoost\b|Get up to .* impressions/i.test(text)) continue;
          // Must contain a "Reply" button (sanity — we got a comment-level container)
          if (!/\bReply\b/.test(text)) continue;

          if (!seen.has(text.slice(0, 50))) {
            seen.add(text.slice(0, 50));
            results.push(text);
          }
        }
        return results;
      });
      console.log(`[LinkedIn] Evaluate fallback found ${rawContainers.length} containers`);
    }

    // ── Parse helper ──────────────────────────────────────────────────────────────
    // Lines to strip before analysis (timestamps, reaction counts, UI chrome).
    // CRITICAL: must strip the expand-replies link patterns BEFORE author detection.
    // LinkedIn renders "1 reply" / "2 Replies on X's comment" / "View 3 more replies"
    // and when our walker climbs past them, they land at the top of the container.
    // If not stripped, parseContainer takes "2 replies" as the author and re-posts
    // a phantom reply every cycle (the count increments → new ID every time).
    const noiseRe = new RegExp([
      String.raw`^\d+[smhd]$`,                                            // timestamps: 1s, 4m, 2h, 3d
      String.raw`^\d+ impressions?$`,
      String.raw`^\d+ Likes?$`,
      String.raw`^Like \(\d+\)$`,
      String.raw`^\d+[\s,]+followers?$`,
      String.raw`^\d+[\s,]+connections?$`,
      String.raw`^\d+[\s,]+members?$`,
      String.raw`^\d+\s+(replies?|comments?)(\s+on\b.*)?$`,                // "1 reply", "2 Replies on X's comment"
      String.raw`^\d+\s+(more\s+)?(replies?|comments?)$`,                  // "3 more replies"
      String.raw`^(View|Load|Show|Hide)(\s+\d+)?(\s+more)?\s+(replies?|comments?)\b.*$`, // "View more replies"
      String.raw`^(1st|2nd|3rd|Follow|Author|Like|Reply|•|See more|Open Emoji Keyboard|Add a comment|Post)$`
    ].join('|'), 'i');

    // Patterns that definitively mark a block as page/post metadata, NOT a comment
    const metadataRe = /^\d+[\s,]+(followers?|connections?|members?|views?|impressions?)$/i;

    // Lone "N replies"/"N comments" lines that survived noiseRe (e.g. via odd spacing)
    const expandLinkRe = /^\d+\s+(replies?|comments?)\b/i;

    function parseContainer(rawText) {
      const lines   = rawText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      const cleaned = lines.filter(s => !noiseRe.test(s));
      if (cleaned.length < 2) return null;

      const authorName  = cleaned[0];

      // Final guard: if the "author" is itself an expand-link, this whole container
      // is junk — bail before generating a phantom comment ID.
      if (expandLinkRe.test(authorName)) return null;

      // Skip headline lines (contain • or @) to get to the actual comment body
      const commentText = cleaned.find((l, i) =>
        i > 0 &&
        !l.includes('•') &&
        !l.includes('@') &&
        l.length > 8 &&           // must be more than a word or two
        !metadataRe.test(l) &&    // not "97 followers", "1,234 connections", etc.
        !expandLinkRe.test(l)     // not "1 reply", "2 Replies on X's comment"
      ) || '';

      if (!commentText) return null;
      if (authorName === commentText) return null;
      // Reject if the "comment" is just a number + word (pure metadata slipping through)
      if (/^\d[\d,\s]*\w{0,15}$/.test(commentText)) return null;

      const rawId = (authorName + commentText).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
      return { id: rawId, text: commentText, authorName };
    }

    // ── Build final comment list ──────────────────────────────────────────────────
    const comments = [];
    const seen     = new Set();

    if (count > 0) {
      // Locator path
      for (let i = 0; i < count; i++) {
        try {
          const containerText = await replyLocator.nth(i).evaluate(el => {
            let node = el.parentElement;
            for (let j = 0; j < 18; j++) {
              if (!node) break;
              const lines = (node.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
              if (lines.length >= 4) break;
              node = node.parentElement;
            }
            return node ? (node.innerText || '') : '';
          });
          const parsed = parseContainer(containerText);
          if (parsed && !seen.has(parsed.id) && parsed.id) {
            seen.add(parsed.id);
            comments.push(parsed);
          }
        } catch (e) {
          console.log(`[LinkedIn] Skipping Reply element ${i}: ${e.message}`);
        }
      }
    } else {
      // Evaluate fallback path
      for (const rawText of rawContainers) {
        const parsed = parseContainer(rawText);
        if (parsed && !seen.has(parsed.id) && parsed.id) {
          seen.add(parsed.id);
          comments.push(parsed);
        }
      }
    }

    console.log(`[LinkedIn] Parsed ${comments.length} unique comment(s)`);
    comments.forEach(c => console.log(`  → [${c.authorName}]: ${c.text.slice(0, 70)}`));

    await page.close();
    return comments;
  } catch (err) {
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'error_comments.png') }).catch(() => {});
    await page.close();
    throw err;
  }
}

async function replyToComment(activityId, commentId, replyText, commentText) {
  const ctx  = await getContext();
  const page = await ctx.newPage();

  // Build the list of "self" names so we can detect if we've already replied.
  // This is the source-of-truth check — replied_comments.json can get out of
  // sync (deleted, reset, server crash before save), but LinkedIn's DOM never
  // lies: if a reply from us is already visible, we replied before.
  const selfNames = [];
  try {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'profile.json'), 'utf-8'));
    if (p.name) selfNames.push(p.name.toLowerCase().trim());
  } catch {}
  try {
    const pg = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf-8'));
    (pg.identities || []).forEach(i => i.name && selfNames.push(i.name.toLowerCase().trim()));
  } catch {}

  try {
    // LinkedIn accepts both activity and ugcPost IDs at the activity URL — it redirects internally
    await page.goto(`https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`,
      { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Scroll down to make sure comments section renders
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    // ── PRE-FLIGHT: have we already replied to this comment? ──
    // Walk up from each Reply button to find the comment container that
    // matches `commentText`, then look for "View N replies" + click it to
    // expand replies, then scan visible reply authors. If any matches one
    // of our self names, abort BEFORE we post a duplicate.
    const alreadyReplied = await page.evaluate(async (args) => {
      const { targetText, selfNames } = args;
      const sleep = ms => new Promise(r => setTimeout(r, ms));

      const allEls = Array.from(document.querySelectorAll('button, span, a'));
      const replyBtns = allEls.filter(el => el.innerText?.trim() === 'Reply');

      // Find the comment container whose text contains the target comment
      let commentContainer = null;
      for (const btn of replyBtns) {
        let root = btn.parentElement;
        for (let i = 0; i < 12; i++) {
          if (!root) break;
          if ((root.innerText || '').includes(targetText)) { commentContainer = root; break; }
          root = root.parentElement;
        }
        if (commentContainer) break;
      }
      if (!commentContainer) return false;

      // Walk UP one more level so we include the replies block that sits
      // beneath the comment (siblings of the comment body, not descendants).
      const threadRoot = commentContainer.parentElement || commentContainer;

      // Expand collapsed replies — click "Load N more replies" / "View N replies"
      const expanders = Array.from(threadRoot.querySelectorAll('button, span'))
        .filter(el => /^(View|Load|Show)\s+\d*\s*(more\s+)?replies?\b/i.test((el.innerText || '').trim()));
      for (const ex of expanders) { try { ex.click(); } catch {} }
      if (expanders.length) await sleep(1500);

      // Now scan the thread text for our self-name appearing as an author.
      // LinkedIn renders reply authors as a link to /in/ or /company/ with the name.
      const authorLinks = Array.from(threadRoot.querySelectorAll('a[href*="/in/"], a[href*="/company/"]'));
      const selfSet = new Set(selfNames);
      for (const a of authorLinks) {
        const name = (a.innerText || a.getAttribute('aria-label') || '').toLowerCase().trim();
        if (!name) continue;
        if (selfSet.has(name)) return true;
        // Some author names are split across spans; check substring match too
        for (const self of selfNames) {
          if (name.includes(self)) return true;
        }
      }
      return false;
    }, { targetText: commentText, selfNames });

    if (alreadyReplied) {
      console.log(`[LinkedIn] Skipping reply — already replied to: "${commentText.slice(0, 50)}"`);
      await page.close();
      const err = new Error('ALREADY_REPLIED');
      err.code = 'ALREADY_REPLIED';
      throw err;
    }

    // Find the Reply button that belongs to this specific comment.
    // We walk UP from each "Reply" button until we find a container that
    // includes the comment text, then click that button.
    const replyClicked = await page.evaluate((targetText) => {
      const allEls   = Array.from(document.querySelectorAll('button, span, a'));
      const replyBtns = allEls.filter(el => el.innerText?.trim() === 'Reply');

      for (const btn of replyBtns) {
        let root = btn.parentElement;
        for (let i = 0; i < 12; i++) {
          if (!root) break;
          if ((root.innerText || '').includes(targetText)) {
            btn.click();
            return true;
          }
          root = root.parentElement;
        }
      }
      // Fallback: click the first Reply button (when there's only one comment)
      if (replyBtns.length === 1) { replyBtns[0].click(); return true; }
      return false;
    }, commentText);

    if (!replyClicked) throw new Error(`Could not find Reply button for comment: "${commentText.slice(0, 60)}"`);
    await page.waitForTimeout(1500);

    // Type into the reply editor that just appeared.
    // CRITICAL: use insertText() not .type() — .type() uses keyboard simulation
    // which silently drops emoji (🙏 😊 🙌) that appear in all our canned replies.
    // Selector note: `[contenteditable="true"]` alone also matches Quill's hidden
    // `.ql-clipboard` helper (always present, never visible) and `.last()` picks
    // it, causing a "16 × locator resolved to hidden" timeout. Target the actual
    // visible editor (.ql-editor) and exclude the clipboard helper.
    let editor = page.locator('.ql-editor[contenteditable="true"]').last();
    if (!(await editor.isVisible({ timeout: 1500 }).catch(() => false))) {
      editor = page.locator('[contenteditable="true"]:not(.ql-clipboard)').last();
    }
    await editor.waitFor({ state: 'visible', timeout: 8000 });
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.insertText(replyText);
    await page.waitForTimeout(600);

    // Submit — find the Post button that appeared next to the reply editor.
    // CRITICAL: scope to the comments section. Searching all buttons on the page
    // grabs LinkedIn's "Skip to search" screen-reader link (which has type=submit),
    // so the reply never actually posts.
    const submitted = await page.evaluate(() => {
      // Find the visible reply editor first, then walk UP to the form/wrapper
      // that contains both the editor and its submit button.
      const editors = Array.from(document.querySelectorAll('.ql-editor[contenteditable="true"]'))
        .filter(el => el.offsetParent !== null);  // visible only
      const editor = editors[editors.length - 1];
      if (!editor) return false;

      let wrapper = editor;
      for (let i = 0; i < 8 && wrapper; i++) {
        const btns = Array.from(wrapper.querySelectorAll('button'));
        const postBtn = btns.find(b => {
          const t = (b.innerText || '').trim();
          // Strict text match — no falling through to type=submit (catches skip links)
          return (t === 'Post' || t === 'Reply' || t === 'Comment') && !b.disabled;
        });
        if (postBtn) { postBtn.click(); return postBtn.innerText?.trim() || 'clicked'; }
        wrapper = wrapper.parentElement;
      }
      return false;
    });

    if (!submitted) {
      // Fallback: Ctrl+Enter submits the reply editor in LinkedIn
      await page.keyboard.press('Control+Return');
    }

    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'debug_reply_sent.png') });
    console.log(`[LinkedIn] Replied (via "${submitted || 'Ctrl+Return'}") to: "${commentText.slice(0, 40)}"`);
    await page.close();
    return true;
  } catch (err) {
    await page.screenshot({ path: path.join(UPLOADS_DIR, 'error_reply.png') }).catch(() => {});
    await page.close();
    throw err;
  }
}

const PROFILE_FILE = path.join(__dirname, '..', 'data', 'profile.json');

// Scrapes name/headline/photo by following the /in/me redirect to the real profile.
// Called once at login, and once on first getContext() if cache is missing.
async function scrapeAndCacheProfile(page) {
  try {
    // Step 1: navigate to /in/me — LinkedIn JS-redirects to the real /in/username/ URL.
    // Use 'commit' so we don't block on the intermediate redirect page, then wait for
    // the URL to stop containing "/in/me".
    await page.goto('https://www.linkedin.com/in/me', { waitUntil: 'commit', timeout: 15000 }).catch(() => {});
    // Wait for the JS redirect to settle (URL changes from /in/me to /in/real-slug)
    await page.waitForURL(
      url => !url.includes('/in/me') || url.match(/\/in\/[a-zA-Z0-9_%-]{3,}\/?\??/),
      { timeout: 12000 }
    ).catch(() => {});
    await page.waitForTimeout(3000);

    const afterRedirectUrl = page.url();
    console.log('[LinkedIn] Profile scrape — URL after redirect:', afterRedirectUrl);

    // Step 2: if we landed on /in/<real-slug> (with or without query string), read the h1
    // The redirect URL looks like: https://www.linkedin.com/in/gsc/?isSelfProfile=true
    const onRealProfile = afterRedirectUrl.match(/\/in\/[^/?]+/) && !afterRedirectUrl.endsWith('/in/me') && !afterRedirectUrl.includes('/in/me?');
    if (onRealProfile) {
      // Wait longer for React to hydrate the profile page
      await page.waitForSelector('h1, main, section.artdeco-card', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(4000);
    } else {
      // Redirect didn't resolve — fall back to the feed
      console.log('[LinkedIn] /in/me redirect did not resolve — trying feed fallback');
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
    }

    console.log('[LinkedIn] Profile scrape — final URL:', page.url());

    // Debug: dump page title and h1 text
    const debugInfo = await page.evaluate(() => ({
      title: document.title,
      h1s: Array.from(document.querySelectorAll('h1')).map(h => h.innerText?.trim().slice(0, 80)),
      url: location.href
    }));
    console.log('[LinkedIn] Profile debug — title:', debugInfo.title, '| h1s:', JSON.stringify(debugInfo.h1s));

    const profile = await page.evaluate(() => {
      let name = '';

      // ── Strategy 0: document.title — set by server-render before React hydrates ──
      // Profile pages: "Gaurav Singh Chaudhary | LinkedIn"
      const titleRaw = (document.title || '').split('|')[0].trim();
      if (titleRaw && !titleRaw.toLowerCase().includes('linkedin') && titleRaw.length > 2) {
        name = titleRaw;
      }

      // ── Strategy 1: og:title meta tag ──
      if (!name) {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
        const ogName = ogTitle.replace(/\s*[|\-–].*$/, '').trim();
        if (ogName && !ogName.toLowerCase().includes('linkedin')) name = ogName;
      }

      // ── Strategy 2: h1 on profile page (after React hydrates) ──
      if (!name) {
        const h1 = document.querySelector('h1.text-heading-xlarge') || document.querySelector('h1');
        if (h1?.innerText?.trim()) name = h1.innerText.split('\n')[0].trim();
      }

      // ── Strategy 3: feed sidebar (only when on feed page) ──
      if (!name) {
        const sidebar =
          document.querySelector('.feed-identity-module__actor-meta .t-16') ||
          document.querySelector('.feed-identity-module__name-text');
        if (sidebar?.innerText) name = sidebar.innerText.trim();
      }

      // ── Strategy 4: nav "Me" button aria-label e.g. "Gaurav's account" ──
      if (!name) {
        const meBtn = document.querySelector(
          '[aria-label*="account"], button[id*="nav-settings__dropdown-trigger"], .global-nav__me'
        );
        const label = (meBtn?.getAttribute('aria-label') || '').replace(/['']s? account.*$/i, '').trim();
        if (label && !label.toLowerCase().includes('linkedin')) name = label;
      }

      name = name.replace(/[^\p{L}\p{N} .'-]/gu, '').trim();

      const headlineEl =
        document.querySelector('.text-body-medium.break-words') ||
        document.querySelector('.feed-identity-module__headline');
      const headline = headlineEl?.innerText?.trim() || '';

      const imgs = Array.from(document.querySelectorAll(
        '.global-nav__me-photo, img.pv-top-card-profile-picture__image--show, img[class*="profile-picture"]'
      ));
      const photo = imgs.find(img => img.src?.startsWith('http'))?.src || '';

      return { name, headline, photo };
    });

    console.log('[LinkedIn] Profile scraped — name:', profile.name, '| headline:', profile.headline);

    // Sanity-check: reject obvious LinkedIn UI labels that show up when the
    // browser lands somewhere other than the profile page (e.g. notifications,
    // messaging) and document.title becomes the section name instead of the user.
    // A real profile name almost always has at least one space (first + last);
    // single-word UI labels like "Notifications" are never correct.
    const UI_LABEL_RE = /^(notifications?|messaging|messages?|jobs?|home|feed|network|my\s+network|search|profile|settings|premium|learning|sales\s+navigator)$/i;
    const looksLikeUiLabel = !profile.name.includes(' ') || UI_LABEL_RE.test(profile.name.trim());

    if (profile.name && !looksLikeUiLabel) {
      fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
      console.log(`[LinkedIn] Profile cached: ${profile.name}`);
    } else if (looksLikeUiLabel) {
      console.warn(`[LinkedIn] Rejecting bogus profile name "${profile.name}" — looks like a UI label, not a person. Keeping previous cache (if any).`);
    } else {
      console.warn('[LinkedIn] Profile scrape got empty name — could not determine user identity');
    }
    return profile;
  } catch (err) {
    console.error('[LinkedIn] Profile scrape failed:', err.message);
    return null;
  }
}

// Returns cached profile only — no browser open. Scraping happens at login / context init.
function getProfile() {
  if (fs.existsSync(PROFILE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
      if (cached.name) return cached;
    } catch {}
  }
  return { name: '', headline: '', photo: '' };
}

// Called once at server startup — opens context only if profile cache is missing
async function scrapeProfileIfNeeded() {
  if (fs.existsSync(PROFILE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
      if (cached.name) return; // already have it
    } catch {}
  }
  // Only scrape if the user is logged in (browser profile exists)
  if (!fs.existsSync(path.join(PROFILE_DIR, 'Default'))) return;

  console.log('[LinkedIn] No profile cache — scraping on startup…');
  const ctx  = await getContext();
  const page = await ctx.newPage();
  await scrapeAndCacheProfile(page).catch(e => console.error('[LinkedIn] Startup scrape failed:', e.message));
  await page.close();
}

async function closeContext() {
  if (_context) { await _context.close(); _context = null; }
}

module.exports = {
  login, isLoggedIn,
  createTextPost, createImagePost, createCarouselPost,
  getPostComments, replyToComment,
  getProfile, scrapeProfileIfNeeded, closeContext,
  scrapePages, readPagesCache
};
