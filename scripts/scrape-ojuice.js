const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const downloadPath = path.join(__dirname, 'downloads');

async function main() {
  // Create downloads folder if it doesn't exist
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  // Set download behavior
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  console.log('Navigating to admin.ojuiceservice.com...');
  await page.goto('https://admin.ojuiceservice.com/', {
    waitUntil: 'networkidle2'
  });

  await delay(2000);

  console.log('Filling in credentials...');

  const inputs = await page.$$('input');

  if (inputs.length >= 2) {
    await inputs[0].type('93286966');
    await inputs[1].type('332211');
  }

  await delay(1000);

  console.log('Clicking login button...');
  await page.click('uni-button.uni-btn');

  console.log('Waiting for login to complete...');
  await delay(3000);

  console.log('Navigating to order list page...');
  await page.goto('https://admin.ojuiceservice.com/#/pages/order/list', {
    waitUntil: 'networkidle2'
  });

  await delay(3000);

  console.log('Looking for Export Excel button...');

  // Click the Export Excel button
  await page.click('uni-button.uni-button[size="mini"]');

  console.log('Clicked Export Excel button! Waiting for download...');
  await delay(10000); // Wait for download to complete

  // Find the downloaded file
  const files = fs.readdirSync(downloadPath);
  console.log('Files in download folder:', files);

  const xlsFiles = files.filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

  if (xlsFiles.length > 0) {
    const latestFile = xlsFiles[xlsFiles.length - 1];
    const filePath = path.join(downloadPath, latestFile);

    console.log('\n=== Downloaded Excel File ===');
    console.log('File:', latestFile);

    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log('Total rows:', data.length);
    console.log('Columns:', Object.keys(data[0] || {}));
    console.log('\nFirst 3 rows:');
    data.slice(0, 3).forEach((row, i) => {
      console.log(`Row ${i + 1}:`, JSON.stringify(row, null, 2));
    });
  } else {
    console.log('No Excel file found in downloads folder');
  }

  console.log('\nDone! Closing browser.');
  await browser.close();
}

main().catch(console.error);
