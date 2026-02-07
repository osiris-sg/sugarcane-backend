const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const deviceIds = ['852345', '852346', '852358', '852353', '852314', '852356', '852359', '852347', '852352'];
  const startDate = new Date('2026-01-30T00:00:00+08:00');
  const endDate = new Date('2026-02-01T00:00:00+08:00');

  console.log('Comparing Order vs OrderImport (Jan 30-31, 2026)');
  console.log('='.repeat(90));
  console.log('Device ID'.padEnd(12) + '| OrderImport'.padEnd(28) + '| Order'.padEnd(28) + '| Match?');
  console.log('-'.repeat(90));

  let allMatch = true;

  for (const deviceId of deviceIds) {
    // OrderImport
    const importOrders = await db.orderImport.findMany({
      where: { deviceId, createdAt: { gte: startDate, lt: endDate }, isSuccess: true },
    });
    const importRev = importOrders.filter(o => {
      const dc = o.deliverCount ?? o.quantity ?? 0;
      return dc > 0 && o.payWay !== '1000' && o.payWay !== 'Free';
    });
    const importTotal = importRev.reduce((sum, o) => sum + (o.amount || 0), 0);
    const importCups = importRev.reduce((sum, o) => sum + (o.deliverCount ?? o.quantity ?? 0), 0);

    // Order - exclude rows with (no amount OR isSuccess=false)
    const orders = await db.order.findMany({
      where: { deviceId, createdAt: { gte: startDate, lt: endDate } },
    });
    const orderRev = orders.filter(o => {
      const dc = o.deliverCount ?? o.quantity ?? 0;
      const hasAmount = o.amount && o.amount > 0;
      const isSuccess = o.isSuccess === true;
      // Exclude: no amount OR not successful
      if (!hasAmount || !isSuccess) return false;
      return dc > 0 && o.payWay !== '1000' && o.payWay !== 'Free';
    });
    const orderTotal = orderRev.reduce((sum, o) => {
      const amt = o.amount > 10000 ? o.amount / 100 : o.amount;
      return sum + (amt || 0);
    }, 0);
    const orderCups = orderRev.reduce((sum, o) => sum + (o.deliverCount ?? o.quantity ?? 0), 0);

    const match = importTotal === orderTotal && importCups === orderCups;
    if (!match) allMatch = false;

    const importStr = importRev.length + ' ord, ' + importCups + ' cups, $' + (importTotal/100).toFixed(2);
    const orderStr = orderRev.length + ' ord, ' + orderCups + ' cups, $' + (orderTotal/100).toFixed(2);

    console.log(deviceId.padEnd(12) + '| ' + importStr.padEnd(26) + '| ' + orderStr.padEnd(26) + '| ' + (match ? 'YES' : 'NO ❌'));
  }

  console.log('='.repeat(90));
  console.log(allMatch ? 'All devices match!' : 'Some devices have mismatches!');

  // Get totals across all devices
  const allImport = await db.orderImport.findMany({
    where: { deviceId: { in: deviceIds }, createdAt: { gte: startDate, lt: endDate }, isSuccess: true },
  });
  const allImportRev = allImport.filter(o => {
    const dc = o.deliverCount ?? o.quantity ?? 0;
    return dc > 0 && o.payWay !== '1000' && o.payWay !== 'Free';
  });
  const totalImportCups = allImportRev.reduce((sum, o) => sum + (o.deliverCount ?? o.quantity ?? 0), 0);
  const totalImportAmt = allImportRev.reduce((sum, o) => sum + (o.amount || 0), 0);

  const allOrder = await db.order.findMany({
    where: { deviceId: { in: deviceIds }, createdAt: { gte: startDate, lt: endDate } },
  });
  const allOrderRev = allOrder.filter(o => {
    const dc = o.deliverCount ?? o.quantity ?? 0;
    const hasAmount = o.amount && o.amount > 0;
    if (!hasAmount || o.isSuccess !== true) return false;
    return dc > 0 && o.payWay !== '1000' && o.payWay !== 'Free';
  });
  const totalOrderCups = allOrderRev.reduce((sum, o) => sum + (o.deliverCount ?? o.quantity ?? 0), 0);
  const totalOrderAmt = allOrderRev.reduce((sum, o) => {
    const amt = o.amount > 10000 ? o.amount / 100 : o.amount;
    return sum + (amt || 0);
  }, 0);

  console.log('\nTOTALS:');
  console.log('OrderImport: ' + allImportRev.length + ' orders, ' + totalImportCups + ' cups, $' + (totalImportAmt/100).toFixed(2));
  console.log('Order:       ' + allOrderRev.length + ' orders, ' + totalOrderCups + ' cups, $' + (totalOrderAmt/100).toFixed(2));

  await db.$disconnect();
}
main();
