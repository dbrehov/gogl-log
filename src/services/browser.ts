import { chromium, Page } from 'playwright';
import os from 'os';

async function enableStealth(page: Page) {
  const context = page.context();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
  });
}

export async function launchBrowser(headless: boolean) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    executablePath: os.platform() === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined,
  });

  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  await enableStealth(page);

  return { browser, page };
}
