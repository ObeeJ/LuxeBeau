const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "spotlight-screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 304 || res.status === 404) {
        return true;
      }
    } catch (e) {
      // Keep polling
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  const PORT = "3005";
  console.log(`Starting Next.js dev server on port ${PORT} for visual screenshot capture...`);
  const devServer = spawn("npx", ["next", "dev", "-p", PORT], {
    cwd: path.join(__dirname, "..", "web"),
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: PORT,
      NEXT_PUBLIC_API_URL: "https://luxebeau-api.onrender.com/api/v1",
    },
  });

  try {
    const targetUrl = `http://localhost:${PORT}`;
    console.log(`Waiting for ${targetUrl} to be ready...`);
    await waitForServer(targetUrl, 60000);
    console.log("Dev server is ready!");

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      deviceScaleFactor: 2, // High resolution retina capture
    });

    const page = await context.newPage();

    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(3000);

    // 1. Screenshot of Hero + Spotlight Card (Business Profile)
    console.log("Capturing Hero + Spotlight Card (Business Profile)...");
    const spotlightSection = page.locator("section[aria-label='Featured Partner Spotlight']");
    await spotlightSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Viewport screenshot showing Hero and Spotlight card together
    await page.evaluate(() => window.scrollTo(0, 160));
    await page.waitForTimeout(1000);
    const heroSpotlightPath = path.join(SCREENSHOT_DIR, "01_hero_and_spotlight_card.png");
    await page.screenshot({ path: heroSpotlightPath });
    console.log(`Saved: ${heroSpotlightPath}`);

    // High-res element screenshot of Spotlight Card itself
    const spotlightCardPath = path.join(SCREENSHOT_DIR, "02_spotlight_card_business_profile.png");
    await spotlightSection.screenshot({ path: spotlightCardPath });
    console.log(`Saved: ${spotlightCardPath}`);

    // 2. Switch to Featured Product Card
    console.log("Switching to second featured item (Product)...");
    const dots = page.locator("button[aria-label*='View featured promotion']");
    const dotCount = await dots.count();
    if (dotCount > 1) {
      await dots.nth(1).click();
      await page.waitForTimeout(1200);
      const productCardPath = path.join(SCREENSHOT_DIR, "03_spotlight_card_featured_product.png");
      await spotlightSection.screenshot({ path: productCardPath });
      console.log(`Saved: ${productCardPath}`);
    }

    // 3. Open Pricing & Annual Math Analysis Dialog
    console.log("Opening Pricing & Annual Math Analysis Dialog...");
    const pricingTrigger = page.locator("button:has-text('View Pricing & ROI'), button:has-text('Want your brand featured here')");
    await pricingTrigger.first().click();
    await page.waitForTimeout(1500);

    // Capture the open Pricing & Annual Math Modal
    const pricingDialogPath = path.join(SCREENSHOT_DIR, "04_paid_ads_pricing_and_annual_math.png");
    await page.screenshot({ path: pricingDialogPath });
    console.log(`Saved: ${pricingDialogPath}`);

    // Element screenshot of dialog modal
    const dialogModal = page.locator("[role='dialog'], [data-slot='dialog-content']");
    if (await dialogModal.isVisible()) {
      const dialogElementPath = path.join(SCREENSHOT_DIR, "05_pricing_analysis_modal_detail.png");
      await dialogModal.screenshot({ path: dialogElementPath });
      console.log(`Saved: ${dialogElementPath}`);
    }

    await browser.close();
    console.log("\nAll visual screenshots captured successfully in:", SCREENSHOT_DIR);
  } finally {
    console.log("Stopping local Next.js dev server...");
    devServer.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
