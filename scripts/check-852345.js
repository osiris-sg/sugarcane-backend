const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const deviceId = '852345';
  const startDate = new Date('2026-01-30T00:00:00+08:00');
  const endDate = new Date('2026-02-01T00:00:00+08:00');

  const orders = await db.order.findMany({
    where: { deviceId, createdAt: { gte: startDate, lt: endDate } },
    select: { orderId: true, amount: true, isSuccess: true, payWay: true, deliverCount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Device 852345, Jan 30-31 SGT (Order table)');
  console.log('Total rows:', orders.length);
  console.log('');

  let falseCount = 0;
  let noAmountCount = 0;

  orders.forEach((o, i) => {
    const isFalse = o.isSuccess === false;
    const noAmount = !o.amount || o.amount === 0;
    if (isFalse) falseCount++;
    if (noAmount) noAmountCount++;

    const status = [];
    if (isFalse) status.push('FALSE');
    if (noAmount) status.push('NO_AMT');

    console.log(`${i+1}. ${o.orderId} | amt:${o.amount || 0} | success:${o.isSuccess} | ${status.join(',') || 'OK'}`);
  });

  console.log('');
  console.log('isSuccess=false:', falseCount);
  console.log('No amount (0 or null):', noAmountCount);
  console.log('Counted (exclude false OR no amount):', orders.length - orders.filter(o => o.isSuccess === false || !o.amount || o.amount === 0).length);

  await db.$disconnect();
}
main();
