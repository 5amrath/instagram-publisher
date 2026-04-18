// ─────────────────────────────────────────────────────────────
//  Ascend Deals — Instagram Graph API Setup (Playwright)
//  Run with: node setup-instagram-api.js
//  Requires: npm install playwright (already installed if you ran npx playwright)
// ─────────────────────────────────────────────────────────────

const { chromium } = require('playwright');
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

(async () => {
  console.log('\n🚀 Ascend Deals — Instagram API Setup\n');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // ── STEP 1: Log in ─────────────────────────────────────────
  console.log('Step 1 → Opening Meta for Developers...');
  await page.goto('https://developers.facebook.com/', { waitUntil: 'domcontentloaded' });

  // Click Login
  await page.getByRole('link', { name: 'Login' }).first().click();
  await page.waitForURL('**/login**', { timeout: 10000 });

  console.log('\n⏸  Please log in to Facebook in the browser window.');
  console.log('   Press ENTER here once you\'re logged in and back on developers.facebook.com...\n');
  await ask('');

  await page.waitForURL('**/developers.facebook.com/**', { timeout: 60000 }).catch(() => {});
  console.log('✓ Logged in\n');

  // ── STEP 2: Create App ─────────────────────────────────────
  console.log('Step 2 → Creating a new app...');
  await page.goto('https://developers.facebook.com/apps/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click "Create App"
  const createAppBtn = page.getByRole('button', { name: /create app/i })
    .or(page.getByRole('link', { name: /create app/i }));
  await createAppBtn.first().click();
  await page.waitForTimeout(2000);

  // Select "Business" use case
  const businessOption = page.getByText(/business/i).first();
  if (await businessOption.isVisible()) {
    await businessOption.click();
    await page.waitForTimeout(500);
  }
  await page.getByRole('button', { name: /next/i }).first().click();
  await page.waitForTimeout(1500);

  // Fill in app name
  const appNameInput = page.getByLabel(/display name|app name/i).first()
    .or(page.locator('input[placeholder*="name" i]').first());
  await appNameInput.fill('Ascend Deals Publisher');
  await page.waitForTimeout(500);

  // Click "Create app" / "Next"
  await page.getByRole('button', { name: /create app|next/i }).last().click();
  await page.waitForTimeout(3000);

  // Handle any "for developers" / accept dialog
  const acceptBtn = page.getByRole('button', { name: /accept|continue|confirm/i });
  if (await acceptBtn.first().isVisible().catch(() => false)) {
    await acceptBtn.first().click();
    await page.waitForTimeout(2000);
  }

  console.log('✓ App created\n');

  // ── STEP 3: Add Instagram Graph API product ────────────────
  console.log('Step 3 → Adding Instagram Graph API product...');
  await page.waitForTimeout(2000);

  // Look for "Add Product" or navigate to products dashboard
  const currentUrl = page.url();
  const appIdMatch = currentUrl.match(/\/app\/(\d+)/);
  let appId = appIdMatch ? appIdMatch[1] : null;

  if (!appId) {
    // Try to find app ID from the page
    const idEl = await page.locator('[data-testid="app-id"], .app-id').first().textContent().catch(() => null);
    if (idEl) appId = idEl.replace(/\D/g, '');
  }

  if (appId) {
    console.log(`  App ID: ${appId}`);
    await page.goto(`https://developers.facebook.com/apps/${appId}/add/`, { waitUntil: 'networkidle' });
  }

  await page.waitForTimeout(2000);

  // Find Instagram in the product list
  const instaCard = page.getByText(/instagram graph api/i).first()
    .or(page.locator('[aria-label*="Instagram" i]').first());

  if (await instaCard.isVisible().catch(() => false)) {
    // Click "Set up" next to Instagram
    const setupBtn = instaCard.locator('..').getByRole('button', { name: /set up/i })
      .or(instaCard.locator('..').locator('..').getByRole('button', { name: /set up/i }));
    await setupBtn.first().click();
    await page.waitForTimeout(3000);
    console.log('✓ Instagram Graph API product added\n');
  } else {
    console.log('  ⚠ Could not auto-add Instagram — you may need to add it manually from the Products page.');
    await ask('  Press ENTER once Instagram Graph API is added...\n');
  }

  // ── STEP 4: Connect Instagram account ─────────────────────
  console.log('Step 4 → Navigating to Graph API Explorer to generate token...');
  await page.goto('https://developers.facebook.com/tools/explorer/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n⏸  In the Graph API Explorer:');
  console.log('   1. Select your "Ascend Deals Publisher" app from the top dropdown');
  console.log('   2. Click "Generate Access Token"');
  console.log('   3. Add these permissions: instagram_basic, instagram_content_publish, pages_read_engagement');
  console.log('   4. Authorize and copy the token');
  console.log('\n   Press ENTER here once you have the token...\n');
  await ask('');

  const token = await ask('Paste your access token here: ');
  console.log('\n✓ Token received!\n');

  // ── STEP 5: Get Instagram User ID ─────────────────────────
  console.log('Step 5 → Fetching your Instagram User ID...');
  await page.goto(
    `https://graph.facebook.com/v19.0/me?fields=id,name,instagram_business_account&access_token=${token}`,
    { waitUntil: 'networkidle' }
  );
  await page.waitForTimeout(2000);

  const rawJson = await page.locator('pre, body').first().textContent().catch(() => '{}');
  let userId = null;
  try {
    const data = JSON.parse(rawJson);
    userId = data.instagram_business_account?.id || data.id;
    console.log(`  User data: ${rawJson.slice(0, 200)}`);
  } catch {
    console.log('  Could not auto-parse — check the browser for your ID');
  }

  if (!userId) {
    userId = await ask('  Paste your Instagram User ID (numeric): ');
  }

  // ── STEP 6: Save to .env ───────────────────────────────────
  console.log('\n✓ Writing .env file...');
  const envContent = `INSTAGRAM_ACCESS_TOKEN=${token}\nINSTAGRAM_USER_ID=${userId}\n`;
  fs.writeFileSync('.env', envContent);

  console.log('\n✅ ALL DONE!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  INSTAGRAM_ACCESS_TOKEN = ${token.slice(0, 20)}...`);
  console.log(`  INSTAGRAM_USER_ID      = ${userId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n  .env file saved in the current directory.');
  console.log('  Copy those two values into your Netlify environment variables and you\'re live!\n');

  rl.close();
  await browser.close();
})();
