const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const downloadPath = path.join(__dirname, 'downloads');

// Excel serial date to JS Date (SGT -> UTC)
function excelDateToJS(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const fractionalDay = serial - Math.floor(serial);
  const millisecondsInDay = fractionalDay * 86400 * 1000;
  const sgtDate = new Date(utcValue + millisecondsInDay);
  // Subtract 8 hours to convert SGT to UTC for database storage
  return new Date(sgtDate.getTime() - (8 * 60 * 60 * 1000));
}

async function downloadExcel() {
  console.log('[1/4] Launching browser...');

  // Create downloads folder if it doesn't exist
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  // Clear old files
  const oldFiles = fs.readdirSync(downloadPath).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
  oldFiles.forEach(f => fs.unlinkSync(path.join(downloadPath, f)));

  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode for cron
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set download behavior
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    console.log('[1/4] Navigating to admin.ojuiceservice.com...');
    await page.goto('https://admin.ojuiceservice.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await delay(2000);

    console.log('[1/4] Logging in...');
    const inputs = await page.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].type('93286966');
      await inputs[1].type('332211');
    }

    await delay(1000);
    await page.click('uni-button.uni-btn');
    await delay(3000);

    console.log('[1/4] Navigating to order list...');
    await page.goto('https://admin.ojuiceservice.com/#/pages/order/list', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await delay(3000);

    console.log('[1/4] Clicking Export Excel button...');
    await page.click('uni-button.uni-button[size="mini"]');

    // Wait for download
    console.log('[1/4] Waiting for download...');
    await delay(10000);

    // Find the downloaded file
    const files = fs.readdirSync(downloadPath);
    const xlsFiles = files.filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

    if (xlsFiles.length === 0) {
      throw new Error('No Excel file downloaded');
    }

    const latestFile = xlsFiles[xlsFiles.length - 1];
    const filePath = path.join(downloadPath, latestFile);

    console.log('[1/4] Downloaded:', latestFile);
    return filePath;

  } finally {
    await browser.close();
  }
}

// Normalize row to handle both English and Chinese column names
function normalizeRow(row) {
  return {
    Id: row.Id || row['订单号'],
    TerminalId: row.TerminalId || row['设备编号'],
    CreateTime: row.CreateTime || row['创建时间'],
    IsSuccess: row.IsSuccess || row['订单结果'],
    PayWay: row.PayWay || row['支付方式'],
    PayAmount: row.PayAmount || row['支付金额'],
    TotalCount: row.TotalCount || row['购买数量'],
    DeliverCount: row.DeliverCount || row['出货数量'],
    RefundAmount: row.RefundAmount || row['退款金额'],
  };
}

async function importOrders(filePath) {
  console.log('[2/4] Reading Excel file...');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet);

  // Normalize all rows to handle Chinese/English columns
  const data = rawData.map(normalizeRow);

  console.log('[2/4] Total rows in Excel:', data.length);

  if (data.length === 0) {
    console.log('[2/4] No data to import');
    return { imported: 0, skipped: 0, fixed: 0 };
  }

  // Build device price lookup from successful orders
  console.log('[3/4] Building device price lookup...');
  const devicePrices = {};
  data.forEach(row => {
    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';
    if (isSuccess && row.DeliverCount > 0 && row.PayAmount > 0) {
      const deviceId = String(row.TerminalId);
      let payAmount = row.PayAmount;
      if (payAmount > 0 && payAmount < 100) payAmount = payAmount * 100;
      const pricePerUnit = Math.round(payAmount / row.DeliverCount);
      if (!devicePrices[deviceId]) devicePrices[deviceId] = {};
      devicePrices[deviceId][pricePerUnit] = (devicePrices[deviceId][pricePerUnit] || 0) + 1;
    }
  });

  const deviceMostCommonPrice = {};
  Object.entries(devicePrices).forEach(([deviceId, prices]) => {
    let maxCount = 0, mostCommonPrice = 280;
    Object.entries(prices).forEach(([price, count]) => {
      if (count > maxCount) { maxCount = count; mostCommonPrice = parseInt(price); }
    });
    deviceMostCommonPrice[deviceId] = mostCommonPrice;
  });

  // Fix problem rows (Success with 0 counts)
  let fixedCount = 0;
  data.forEach(row => {
    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';
    if (isSuccess && (!row.TotalCount || row.TotalCount === 0) && (!row.DeliverCount || row.DeliverCount === 0) && row.PayAmount > 0) {
      const deviceId = String(row.TerminalId);
      const devicePrice = deviceMostCommonPrice[deviceId] || 280;
      let payAmount = row.PayAmount;
      if (payAmount > 0 && payAmount < 100) payAmount = payAmount * 100;
      const count = Math.round(payAmount / devicePrice);
      row.TotalCount = count;
      row.DeliverCount = count;
      fixedCount++;
    }
  });

  if (fixedCount > 0) {
    console.log('[3/4] Fixed', fixedCount, 'rows with 0 counts');
  }

  // Prepare orders for import
  const ordersToImport = data.map(row => {
    let orderId = String(row.Id || '');
    if (orderId.startsWith('="') && orderId.endsWith('"')) orderId = orderId.slice(2, -1);

    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';

    let payWay = String(row.PayWay || '');
    if (payWay === 'Cashless' || payWay === '刷卡') payWay = '2';
    else if (payWay === 'Free' || payWay === '免费') payWay = 'Free';

    let amount = row.PayAmount || 0;
    if (amount > 0 && amount < 100) amount = Math.round(amount * 100);
    else amount = Math.round(amount);

    return {
      orderId,
      deviceId: String(row.TerminalId),
      deviceName: String(row.TerminalId),
      amount,
      quantity: row.TotalCount || 1,
      payWay,
      isSuccess,
      createdAt: excelDateToJS(row.CreateTime),
      deliverCount: row.DeliverCount || 0,
      payAmount: amount,
      refundAmount: row.RefundAmount ? Math.round(row.RefundAmount) : null,
      totalCount: row.TotalCount || 0,
    };
  });

  // Check for existing orders
  console.log('[4/4] Checking for duplicates...');
  const existingOrders = await db.orderImport.findMany({ select: { orderId: true } });
  const existingIds = new Set(existingOrders.map(o => o.orderId));

  const newOrders = ordersToImport.filter(o => !existingIds.has(o.orderId));
  const skipped = ordersToImport.length - newOrders.length;

  if (newOrders.length === 0) {
    console.log('[4/4] No new orders to import (all', skipped, 'already exist)');
    return { imported: 0, skipped, fixed: fixedCount };
  }

  // Import in batches
  console.log('[4/4] Importing', newOrders.length, 'new orders...');
  const batchSize = 500;
  let imported = 0;

  for (let i = 0; i < newOrders.length; i += batchSize) {
    const batch = newOrders.slice(i, i + batchSize);
    await db.orderImport.createMany({ data: batch, skipDuplicates: true });
    imported += batch.length;
  }

  return { imported, skipped, fixed: fixedCount };
}

async function main() {
  const startTime = new Date();
  console.log('='.repeat(50));
  console.log('OJuice Order Sync -', startTime.toISOString());
  console.log('='.repeat(50));

  try {
    // Step 1: Download Excel
    const filePath = await downloadExcel();

    // Step 2-4: Import orders
    const result = await importOrders(filePath);

    // Summary
    const duration = ((new Date() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log('='.repeat(50));
    console.log('SYNC COMPLETE');
    console.log('  Imported:', result.imported);
    console.log('  Skipped:', result.skipped);
    console.log('  Fixed:', result.fixed);
    console.log('  Duration:', duration, 'seconds');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('SYNC FAILED:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
