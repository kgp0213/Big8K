const puppeteer = require('puppeteer-core');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1200, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle0' });
  await sleep(1500);

  const buttons = await page.$$('button');
  for (const button of buttons) {
    const text = await page.evaluate((el) => el.textContent || '', button);
    if (text.includes('点屏配置')) {
      await button.click();
      break;
    }
  }

  await sleep(1200);
  await page.screenshot({ path: 'mipi-layout.png', fullPage: true });
  console.log('Screenshot saved to mipi-layout.png');
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
