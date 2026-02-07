const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const db = new PrismaClient();

// Payment method mapping (supports both string and integer keys)
const PAYMENT_METHODS = {
  '': 'Not Recorded',
  null: 'Not Recorded',
  '2': 'Cash/Card',
  2: 'Cash/Card',
  '35': 'PayNow',
  35: 'PayNow',
  '10': 'Apple Pay',
  10: 'Apple Pay',
  '25': 'Google Pay',
  25: 'Google Pay',
  '31': 'Samsung Pay',
  31: 'Samsung Pay',
  '17': 'GrabPay',
  17: 'GrabPay',
  '3': 'Alipay',
  3: 'Alipay',
  '4': 'WeChat Pay',
  4: 'WeChat Pay',
  '1000': 'Free',
  1000: 'Free',
  'Free': 'Free',
  '微信支付': 'WeChat Pay',
  '支付宝': 'Alipay',
  'Alipay': 'Alipay',
};

// Order table has mixed amount formats
// payWay null: amounts in cents
// payWay with value: amounts * 10000 format
function getAmountInCents(order) {
  if (order.amount > 10000) {
    return order.amount / 100;
  }
  return order.amount || 0;
}

const AMOUNT_DIVISOR = 100; // For final display (cents to dollars)

// Device locations to search for
const DEVICE_LOCATIONS = [
  '427 Race Course',  // 427 Race Course Rd.
  '26 Dickson',
  '146 Jalan Bt Merah',  // 146 Jalan Bt Merah
  'Midview',
  '214 Jurong',
  'Stamford Tyres',
  'Lokyang',
  'LokYang',
  'Keat Hong',
  'SnipAve',
  'Snip Ave',
  'Yishun',
  '27 Bendemeer',
  'Bendemeer',
];

async function main() {
  console.log('Finding devices...');

  // Find devices matching the locations
  const devices = await db.device.findMany({
    where: {
      OR: DEVICE_LOCATIONS.map(loc => ({
        OR: [
          { location: { contains: loc, mode: 'insensitive' } },
          { deviceName: { contains: loc, mode: 'insensitive' } },
        ]
      }))
    },
    select: {
      deviceId: true,
      deviceName: true,
      location: true,
    }
  });

  console.log(`Found ${devices.length} devices:`);
  devices.forEach(d => console.log(`  - ${d.location || d.deviceName} (${d.deviceId})`));

  const deviceIds = devices.map(d => d.deviceId);

  if (deviceIds.length === 0) {
    console.log('No devices found!');
    return;
  }

  // Date range: Jan 30 to Jan 31, 2026 (SGT)
  const startDate = new Date('2026-01-30T00:00:00+08:00');
  const endDate = new Date('2026-02-01T00:00:00+08:00'); // Exclusive end date

  console.log(`\nQuerying orders from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

  // Query orders from Order table
  const orders = await db.order.findMany({
    where: {
      deviceId: { in: deviceIds },
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${orders.length} orders`);

  // Create device map for lookup
  const deviceMap = {};
  devices.forEach(d => {
    deviceMap[d.deviceId] = d.location || d.deviceName || d.deviceId;
  });

  // Calculate proportional revenue (same as dashboard)
  function calculateProportionalRevenue(order) {
    const deliverCount = order.deliverCount ?? order.quantity ?? 1;
    const totalCount = order.totalCount ?? order.quantity ?? 1;
    if (totalCount === 0 || deliverCount === 0) return 0;
    const amountInCents = getAmountInCents(order);
    return Math.round(amountInCents * (deliverCount / totalCount));
  }

  // Format data for Excel
  const data = orders.map(order => {
    const createdAt = new Date(order.createdAt);
    // Convert to SGT
    const sgtDate = createdAt.toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(',', '');

    const deliverCount = order.deliverCount ?? order.quantity ?? 0;
    const totalCount = order.totalCount ?? order.quantity ?? 0;
    const proportionalRevenue = calculateProportionalRevenue(order);

    const amountInCents = getAmountInCents(order);

    return {
      'Order ID': order.orderId,
      'Date/Time (SGT)': sgtDate,
      'Device': deviceMap[order.deviceId] || order.deviceId,
      'Device ID': order.deviceId,
      'Payment Method': PAYMENT_METHODS[order.payWay] || PAYMENT_METHODS[''] || order.payWay || 'Unknown',
      'PayWay Code': order.payWay || '',
      'Amount ($)': (amountInCents / AMOUNT_DIVISOR).toFixed(2),
      'Proportional Revenue ($)': (proportionalRevenue / AMOUNT_DIVISOR).toFixed(2),
      'Quantity': order.quantity,
      'Deliver Count': deliverCount,
      'Total Count': totalCount,
      'Status': order.isSuccess ? 'Success' : 'Failed',
      'Counts Revenue': deliverCount > 0 ? 'Yes' : 'No',
      'Transaction ID': order.transId || '',
    };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Order ID
    { wch: 20 }, // Date/Time
    { wch: 25 }, // Device
    { wch: 15 }, // Device ID
    { wch: 15 }, // Payment Method
    { wch: 12 }, // PayWay Code
    { wch: 10 }, // Amount
    { wch: 10 }, // Quantity
    { wch: 12 }, // Deliver Count
    { wch: 12 }, // Total Count
    { wch: 10 }, // Status
    { wch: 20 }, // Transaction ID
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Orders');

  // Save file
  const filename = `orders-export-jan30-31-2026.xlsx`;
  XLSX.writeFile(wb, filename);

  console.log(`\nExported to ${filename}`);

  // Filter orders that count towards revenue (deliverCount > 0, excludes Free)
  const revenueOrders = orders.filter(o => {
    const deliverCount = o.deliverCount ?? o.quantity ?? 0;
    const isFree = o.payWay === '1000' || o.payWay === 'Free';
    return deliverCount > 0 && !isFree;
  });

  console.log(`\nOrders with deliverCount > 0 (excluding Free): ${revenueOrders.length}`);

  // Summary by device (using proportional revenue)
  console.log('\n--- Summary by Device (Proportional Revenue) ---');
  const deviceSummary = {};
  revenueOrders.forEach(o => {
    const loc = deviceMap[o.deviceId] || o.deviceId;
    if (!deviceSummary[loc]) {
      deviceSummary[loc] = { count: 0, amount: 0, cups: 0 };
    }
    deviceSummary[loc].count++;
    deviceSummary[loc].amount += calculateProportionalRevenue(o);
    deviceSummary[loc].cups += o.deliverCount ?? o.quantity ?? 0;
  });
  Object.entries(deviceSummary).forEach(([loc, stats]) => {
    console.log(`  ${loc}: ${stats.count} orders, ${stats.cups} cups, $${(stats.amount / AMOUNT_DIVISOR).toFixed(2)}`);
  });

  // Summary by payment method (using proportional revenue)
  console.log('\n--- Summary by Payment Method (Proportional Revenue) ---');
  const paymentSummary = {};
  revenueOrders.forEach(o => {
    const method = PAYMENT_METHODS[o.payWay] || PAYMENT_METHODS[''] || o.payWay || 'Unknown';
    if (!paymentSummary[method]) {
      paymentSummary[method] = { count: 0, amount: 0, cups: 0 };
    }
    paymentSummary[method].count++;
    paymentSummary[method].amount += calculateProportionalRevenue(o);
    paymentSummary[method].cups += o.deliverCount ?? o.quantity ?? 0;
  });
  Object.entries(paymentSummary).forEach(([method, stats]) => {
    console.log(`  ${method}: ${stats.count} orders, ${stats.cups} cups, $${(stats.amount / AMOUNT_DIVISOR).toFixed(2)}`);
  });

  // Total
  const totalRevenue = revenueOrders.reduce((sum, o) => sum + calculateProportionalRevenue(o), 0);
  const totalCups = revenueOrders.reduce((sum, o) => sum + (o.deliverCount ?? o.quantity ?? 0), 0);
  console.log(`\n--- TOTAL: ${revenueOrders.length} orders, ${totalCups} cups, $${(totalRevenue / AMOUNT_DIVISOR).toFixed(2)} ---`);

  await db.$disconnect();
}

main().catch(console.error);
