const puppeteer = require('puppeteer-core');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:1421', { waitUntil: 'networkidle0' });
  
  // Wait for the page to fully load
  await new Promise(r => setTimeout(r, 2000));
  
  // Take screenshot
  await page.screenshot({ path: 'mipi-layout.png', fullPage: true });
  
  console.log('Screenshot saved to mipi-layout.png');
  
  await browser.close();
}

main().catch(console.error);
