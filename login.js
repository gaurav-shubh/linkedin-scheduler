const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const PROFILE_DIR = path.join(__dirname, 'data', 'browser-profile');
fs.mkdirSync(PROFILE_DIR, { recursive: true });

(async () => {
  console.log('\n Opening Edge for LinkedIn login...');
  console.log(' Log in normally. Window closes automatically once you reach the feed.\n');

  const ctx  = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    slowMo: 40,
    viewport: { width: 1280, height: 800 }
  });

  const page = await ctx.newPage();
  await page.goto('https://www.linkedin.com/login');

  console.log(' Waiting for login...');
  await page.waitForURL('**/feed/**', { timeout: 180_000 });

  console.log('\n Done! Your login is saved permanently in the browser profile.');
  console.log(' You will NOT need to log in again.\n');

  await ctx.close();
})();
