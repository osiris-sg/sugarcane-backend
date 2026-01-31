const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

// Excel serial date to JS Date
// Excel dates are in SGT (UTC+8), so subtract 8 hours to store as UTC
function excelDateToJS(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const fractionalDay = serial - Math.floor(serial);
  const millisecondsInDay = fractionalDay * 86400 * 1000;
  const sgtDate = new Date(utcValue + millisecondsInDay);
  // Subtract 8 hours to convert SGT to UTC for database storage
  return new Date(sgtDate.getTime() - (8 * 60 * 60 * 1000));
}

async function main() {
  console.log('=== Step 1: Reading Excel file ===');
  const workbook = XLSX.readFile('/Users/guru/Downloads/data (11).xls');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log('Total rows:', data.length);
  console.log('Columns:', Object.keys(data[0]));
  console.log('\nSample row:', JSON.stringify(data[0], null, 2));

  // === Step 2: Build device price lookup from successful orders with counts ===
  console.log('\n=== Step 2: Building device price lookup ===');
  const devicePrices = {};

  data.forEach(row => {
    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';
    if (isSuccess && row.DeliverCount > 0 && row.PayAmount > 0) {
      const deviceId = String(row.TerminalId);
      let payAmount = row.PayAmount;

      // Normalize PayAmount to cents (if < 100, it's in dollars)
      if (payAmount > 0 && payAmount < 100) {
        payAmount = payAmount * 100;
      }

      const pricePerUnit = Math.round(payAmount / row.DeliverCount);

      if (!devicePrices[deviceId]) {
        devicePrices[deviceId] = {};
      }
      devicePrices[deviceId][pricePerUnit] = (devicePrices[deviceId][pricePerUnit] || 0) + 1;
    }
  });

  // Get most common price per device
  const deviceMostCommonPrice = {};
  Object.entries(devicePrices).forEach(([deviceId, prices]) => {
    let maxCount = 0;
    let mostCommonPrice = 280; // default
    Object.entries(prices).forEach(([price, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonPrice = parseInt(price);
      }
    });
    deviceMostCommonPrice[deviceId] = mostCommonPrice;
  });

  console.log('Device prices (most common):');
  Object.entries(deviceMostCommonPrice).slice(0, 10).forEach(([id, price]) => {
    console.log(`  ${id}: ${price} cents`);
  });
  console.log('  ... and', Object.keys(deviceMostCommonPrice).length - 10, 'more devices');

  // === Step 3: Find and fix problem rows ===
  console.log('\n=== Step 3: Finding problem rows (Success with 0 counts) ===');

  const problemRows = data.filter(row => {
    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';
    return isSuccess &&
           (row.TotalCount === 0 || !row.TotalCount) &&
           (row.DeliverCount === 0 || !row.DeliverCount) &&
           row.PayAmount > 0;
  });

  console.log('Problem rows found:', problemRows.length);

  if (problemRows.length > 0) {
    console.log('\nSample problem rows:');
    problemRows.slice(0, 3).forEach((row, i) => {
      console.log(`  ${i + 1}. Device: ${row.TerminalId}, PayAmount: ${row.PayAmount}, TotalCount: ${row.TotalCount}, DeliverCount: ${row.DeliverCount}`);
    });
  }

  // Fix problem rows
  console.log('\n=== Step 4: Fixing problem rows ===');
  let fixedCount = 0;

  data.forEach(row => {
    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';
    if (isSuccess &&
        (row.TotalCount === 0 || !row.TotalCount) &&
        (row.DeliverCount === 0 || !row.DeliverCount) &&
        row.PayAmount > 0) {

      const deviceId = String(row.TerminalId);
      const devicePrice = deviceMostCommonPrice[deviceId] || 280; // default to 280 cents

      // Normalize PayAmount to cents
      let payAmount = row.PayAmount;
      if (payAmount > 0 && payAmount < 100) {
        payAmount = payAmount * 100;
      }

      // Calculate count
      const count = Math.round(payAmount / devicePrice);

      row.TotalCount = count;
      row.DeliverCount = count;
      fixedCount++;

      if (fixedCount <= 3) {
        console.log(`  Fixed: Device ${deviceId}, PayAmount ${row.PayAmount} / Price ${devicePrice} = Count ${count}`);
      }
    }
  });

  console.log(`\nTotal fixed: ${fixedCount} rows`);

  // Verify fix
  const stillProblem = data.filter(row => {
    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';
    return isSuccess && (row.DeliverCount === 0 || !row.DeliverCount) && row.PayAmount > 0;
  });
  console.log('Remaining problem rows:', stillProblem.length);

  // === Step 5: Prepare for import ===
  console.log('\n=== Step 5: Preparing data for import ===');

  const ordersToImport = data.map(row => {
    // Clean order ID
    let orderId = String(row.Id || '');
    if (orderId.startsWith('="') && orderId.endsWith('"')) {
      orderId = orderId.slice(2, -1);
    }

    // Determine isSuccess
    const isSuccess = row.IsSuccess === 'Success' || row.IsSuccess === '成功';

    // Normalize payWay
    let payWay = String(row.PayWay || '');
    if (payWay === 'Cashless' || payWay === '刷卡') {
      payWay = '2';
    } else if (payWay === 'Free' || payWay === '免费') {
      payWay = 'Free';
    }

    // Normalize amount to cents
    let amount = row.PayAmount || 0;
    if (amount > 0 && amount < 100) {
      amount = Math.round(amount * 100);
    } else {
      amount = Math.round(amount);
    }

    return {
      orderId,
      deviceId: String(row.TerminalId),
      deviceName: String(row.TerminalId),
      amount: amount,
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

  // Summary
  const successOrders = ordersToImport.filter(o => o.isSuccess);
  const failedOrders = ordersToImport.filter(o => !o.isSuccess);
  const dates = ordersToImport.map(o => o.createdAt).sort((a, b) => a - b);

  console.log('\nImport summary:');
  console.log('  Total orders:', ordersToImport.length);
  console.log('  Success orders:', successOrders.length);
  console.log('  Failed orders:', failedOrders.length);
  console.log('  Date range:', dates[0].toISOString().split('T')[0], 'to', dates[dates.length - 1].toISOString().split('T')[0]);

  // Revenue calculation
  const revenue = successOrders
    .filter(o => o.payWay !== 'Free' && o.payWay !== '1000')
    .reduce((sum, o) => sum + o.amount, 0);
  console.log('  Revenue: $' + (revenue / 100).toFixed(2));

  // Total cups
  const totalCups = successOrders.reduce((sum, o) => sum + (o.deliverCount || 0), 0);
  console.log('  Total cups:', totalCups);

  // === Step 6: Check for duplicates ===
  console.log('\n=== Step 6: Checking for existing orders ===');

  const existingOrders = await db.orderImport.findMany({
    where: {
      createdAt: {
        gte: dates[0],
        lte: dates[dates.length - 1]
      }
    },
    select: { orderId: true }
  });

  const existingOrderIds = new Set(existingOrders.map(o => o.orderId));
  console.log('Existing orders in DB for this date range:', existingOrderIds.size);

  const newOrders = ordersToImport.filter(o => !existingOrderIds.has(o.orderId));
  console.log('New orders to import:', newOrders.length);
  console.log('Duplicates skipped:', ordersToImport.length - newOrders.length);

  if (newOrders.length === 0) {
    console.log('\nNo new orders to import!');
    await db.$disconnect();
    return;
  }

  // === Step 7: Import ===
  console.log('\n=== Step 7: Importing to OrderImport table ===');

  const batchSize = 1000;
  let imported = 0;

  for (let i = 0; i < newOrders.length; i += batchSize) {
    const batch = newOrders.slice(i, i + batchSize);
    await db.orderImport.createMany({
      data: batch,
      skipDuplicates: true,
    });
    imported += batch.length;
    console.log(`  Progress: ${imported}/${newOrders.length}`);
  }

  console.log('\n=== DONE ===');
  console.log('Successfully imported:', imported, 'orders');

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  await db.$disconnect();
  process.exit(1);
});
