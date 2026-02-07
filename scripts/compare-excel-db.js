const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const db = new PrismaClient();

// Device IDs from screenshot
const DEVICE_IDS = [
  '852273', // Tampines 1
  '852274', // Eastpoint Mall
  '852304', // Sim Lim Tower
  '852258', // The Octagon
  '852299', // V Hotel
  '852263', // Hong Lim Complex
  '852272', // Pasir Ris Mall
  '852288', // 135 Jurong Gateway
  '852270', // 178 Tyrwhitt Road
  '852305', // Buangkok Bus Interchange
  '852262', // Prime 37 Eunos
  '852261', // Marine Parade Central
  '852308', // 164 Bukit Batok
  '852314', // 27 Bendemeer Rd
  '852287', // Shell Little India
  '852312', // 440 Pasir Ris
  '852260', // Burlington Square
];

const DEVICE_NAMES = {
  '852273': 'Tampines 1',
  '852274': 'Eastpoint Mall',
  '852304': 'Sim Lim Tower',
  '852258': 'The Octagon',
  '852299': 'V Hotel',
  '852263': 'Hong Lim Complex',
  '852272': 'Pasir Ris Mall',
  '852288': '135 Jurong Gateway',
  '852270': '178 Tyrwhitt Road',
  '852305': 'Buangkok Bus Interchange',
  '852262': 'Prime 37 Eunos',
  '852261': 'Marine Parade Central',
  '852308': '164 Bukit Batok',
  '852314': '27 Bendemeer Rd',
  '852287': 'Shell Little India',
  '852312': '440 Pasir Ris',
  '852260': 'Burlington Square',
};

// Excel serial date to JS Date (Excel dates are days since 1900-01-01)
function excelDateToJS(serial) {
  // Excel epoch is 1900-01-01, but Excel incorrectly treats 1900 as leap year
  // So we subtract 1 day for dates after Feb 28, 1900
  const utcDays = Math.floor(serial - 25569); // 25569 = days from 1900 to 1970
  const utcValue = utcDays * 86400 * 1000;
  const fractionalDay = serial - Math.floor(serial);
  const msInDay = fractionalDay * 86400 * 1000;
  return new Date(utcValue + msInDay);
}

async function main() {
  console.log('Reading Excel file...');
  const wb = XLSX.readFile('/Users/guru/Downloads/data (16).xls');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Date range: Jan 26 12am to Feb 1 11:59pm SGT
  const startDate = new Date('2026-01-26T00:00:00+08:00');
  const endDate = new Date('2026-02-02T00:00:00+08:00'); // Exclusive

  console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  console.log('');

  // Parse Excel data
  const excelOrders = {};
  DEVICE_IDS.forEach(id => { excelOrders[id] = { count: 0, revenue: 0, cups: 0, orders: [] }; });

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const orderId = String(row[0] || '').replace(/[="]/g, '');
    const terminalId = String(row[1] || '');
    const createTime = row[2];
    const isSuccess = row[3];
    const payAmount = row[5] || 0;
    const deliverCount = row[8] || 0;

    if (!DEVICE_IDS.includes(terminalId)) continue;

    // Convert Excel date to JS Date
    const orderDate = excelDateToJS(createTime);
    if (orderDate < startDate || orderDate >= endDate) continue;

    // Only count successful orders with deliverCount > 0
    if (isSuccess === 'Success' && deliverCount > 0) {
      excelOrders[terminalId].count++;
      excelOrders[terminalId].revenue += payAmount;
      excelOrders[terminalId].cups += deliverCount;
      excelOrders[terminalId].orders.push(orderId);
    }
  }

  // Query ImportOrder database
  console.log('Querying ImportOrder database...');
  const dbOrders = {};
  DEVICE_IDS.forEach(id => { dbOrders[id] = { count: 0, revenue: 0, cups: 0, orders: [] }; });

  for (const deviceId of DEVICE_IDS) {
    const orders = await db.orderImport.findMany({
      where: {
        deviceId: deviceId,
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
        isSuccess: true,
      },
      select: {
        orderId: true,
        payAmount: true,
        deliverCount: true,
      },
    });

    orders.forEach(o => {
      const deliverCount = o.deliverCount || 0;
      if (deliverCount > 0) {
        dbOrders[deviceId].count++;
        dbOrders[deviceId].revenue += o.payAmount || 0;
        dbOrders[deviceId].cups += deliverCount;
        dbOrders[deviceId].orders.push(o.orderId);
      }
    });
  }

  // Compare and display results
  console.log('\n=== COMPARISON: Excel vs ImportOrder DB (Jan 26 - Feb 1) ===\n');
  console.log('Device ID | Location                | Excel Orders | DB Orders | Diff | Excel Rev | DB Rev | Rev Diff');
  console.log('-'.repeat(110));

  let totalExcelOrders = 0, totalDbOrders = 0;
  let totalExcelRev = 0, totalDbRev = 0;
  let totalExcelCups = 0, totalDbCups = 0;

  const differences = [];

  for (const deviceId of DEVICE_IDS) {
    const excel = excelOrders[deviceId];
    const db = dbOrders[deviceId];
    const name = DEVICE_NAMES[deviceId] || deviceId;

    const orderDiff = excel.count - db.count;
    const revDiff = excel.revenue - db.revenue;

    totalExcelOrders += excel.count;
    totalDbOrders += db.count;
    totalExcelRev += excel.revenue;
    totalDbRev += db.revenue;
    totalExcelCups += excel.cups;
    totalDbCups += db.cups;

    const diffStr = orderDiff === 0 ? '0' : (orderDiff > 0 ? `+${orderDiff}` : `${orderDiff}`);
    const revDiffStr = revDiff === 0 ? '$0' : (revDiff > 0 ? `+$${(revDiff/100).toFixed(2)}` : `-$${(Math.abs(revDiff)/100).toFixed(2)}`);

    console.log(
      `${deviceId.padEnd(9)} | ${name.padEnd(23)} | ${String(excel.count).padStart(12)} | ${String(db.count).padStart(9)} | ${diffStr.padStart(4)} | $${(excel.revenue/100).toFixed(2).padStart(8)} | $${(db.revenue/100).toFixed(2).padStart(7)} | ${revDiffStr}`
    );

    if (orderDiff !== 0) {
      differences.push({ deviceId, name, excel, db, orderDiff, revDiff });
    }
  }

  console.log('-'.repeat(110));
  const totalOrderDiff = totalExcelOrders - totalDbOrders;
  const totalRevDiff = totalExcelRev - totalDbRev;
  console.log(
    `${'TOTAL'.padEnd(9)} | ${''.padEnd(23)} | ${String(totalExcelOrders).padStart(12)} | ${String(totalDbOrders).padStart(9)} | ${(totalOrderDiff >= 0 ? '+' : '') + totalOrderDiff} | $${(totalExcelRev/100).toFixed(2).padStart(8)} | $${(totalDbRev/100).toFixed(2).padStart(7)} | ${(totalRevDiff >= 0 ? '+$' : '-$') + (Math.abs(totalRevDiff)/100).toFixed(2)}`
  );

  // Show detailed differences
  if (differences.length > 0) {
    console.log('\n\n=== DEVICES WITH DIFFERENCES ===\n');
    for (const diff of differences) {
      console.log(`\n${diff.name} (${diff.deviceId}): Excel has ${diff.orderDiff > 0 ? 'MORE' : 'FEWER'} orders (${diff.orderDiff})`);

      const excelSet = new Set(diff.excel.orders);
      const dbSet = new Set(diff.db.orders);

      const inExcelOnly = diff.excel.orders.filter(id => !dbSet.has(id));
      const inDbOnly = diff.db.orders.filter(id => !excelSet.has(id));

      if (inExcelOnly.length > 0) {
        console.log(`  In Excel but NOT in DB (${inExcelOnly.length}):`);
        inExcelOnly.slice(0, 5).forEach(id => console.log(`    - ${id}`));
        if (inExcelOnly.length > 5) console.log(`    ... and ${inExcelOnly.length - 5} more`);
      }

      if (inDbOnly.length > 0) {
        console.log(`  In DB but NOT in Excel (${inDbOnly.length}):`);
        inDbOnly.slice(0, 5).forEach(id => console.log(`    - ${id}`));
        if (inDbOnly.length > 5) console.log(`    ... and ${inDbOnly.length - 5} more`);
      }
    }
  }

  await db.$disconnect();
}

main().catch(console.error);
