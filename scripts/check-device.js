const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const deviceId = '852345';
  const startDate = new Date('2026-01-30T00:00:00+08:00');
  const endDate = new Date('2026-02-01T00:00:00+08:00');

  const orders = await db.order.findMany({
    where: { deviceId, createdAt: { gte: startDate, lt: endDate } },
    select: { orderId: true, amount: true, isSuccess: true, payWay: true, deliverCount: true, quantity: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('All orders for 852345 (Jan 30-31 SGT):');
  console.log('OrderID'.padEnd(20) + '| Amount | Success | payWay | delCnt | Counted?');
  console.log('-'.repeat(75));

  orders.forEach(o => {
    const dc = o.deliverCount ?? o.quantity ?? 0;
    const hasAmount = o.amount && o.amount > 0;
    const isFree = o.payWay === '1000' || o.payWay === 'Free';
    const counted = hasAmount && o.isSuccess === true && dc > 0 && !isFree;
    const amt = o.amount > 10000 ? o.amount / 100 : o.amount;
    console.log(
      o.orderId.substring(0,18).padEnd(20) + '| ' +
      String(amt || 0).padStart(6) + ' | ' +
      String(o.isSuccess).padEnd(7) + ' | ' +
      String(o.payWay || '(null)').padEnd(6) + ' | ' +
      String(dc).padEnd(6) + ' | ' +
      (counted ? 'YES' : 'NO')
    );
  });

  console.log('\nTotal orders:', orders.length);
  const counted = orders.filter(o => {
    const dc = o.deliverCount ?? o.quantity ?? 0;
    const hasAmount = o.amount && o.amount > 0;
    const isFree = o.payWay === '1000' || o.payWay === 'Free';
    return hasAmount && o.isSuccess === true && dc > 0 && !isFree;
  });
  console.log('Counted orders:', counted.length);

  // Filter by orderId ending with deviceId
  const matchingOrders = orders.filter(o => o.orderId.endsWith(deviceId));
  const matchingCounted = matchingOrders.filter(o => {
    const dc = o.deliverCount ?? o.quantity ?? 0;
    const hasAmount = o.amount && o.amount > 0;
    const isFree = o.payWay === '1000' || o.payWay === 'Free';
    return hasAmount && o.isSuccess === true && dc > 0 && !isFree;
  });
  console.log('\nOrders with orderId ending in ' + deviceId + ':', matchingOrders.length);
  console.log('Counted (matching orderId):', matchingCounted.length);

  // Also check OrderImport
  console.log('\n--- OrderImport for same device ---');
  const importOrders = await db.orderImport.findMany({
    where: { deviceId, createdAt: { gte: startDate, lt: endDate }, isSuccess: true },
    select: { orderId: true, amount: true, isSuccess: true, payWay: true, deliverCount: true, quantity: true },
    orderBy: { createdAt: 'asc' },
  });

  importOrders.forEach(o => {
    const dc = o.deliverCount ?? o.quantity ?? 0;
    const isFree = o.payWay === '1000' || o.payWay === 'Free';
    const counted = dc > 0 && !isFree;
    console.log(
      o.orderId.substring(0,18).padEnd(20) + '| ' +
      String(o.amount || 0).padStart(6) + ' | ' +
      String(o.isSuccess).padEnd(7) + ' | ' +
      String(o.payWay || '(null)').padEnd(6) + ' | ' +
      String(dc).padEnd(6) + ' | ' +
      (counted ? 'YES' : 'NO')
    );
  });
  console.log('OrderImport counted:', importOrders.filter(o => {
    const dc = o.deliverCount ?? o.quantity ?? 0;
    const isFree = o.payWay === '1000' || o.payWay === 'Free';
    return dc > 0 && !isFree;
  }).length);

  await db.$disconnect();
}
main();
