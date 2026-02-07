const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const deviceId = '852345';
  const startDate = new Date('2026-01-30T00:00:00+08:00');
  const endDate = new Date('2026-02-01T00:00:00+08:00');

  console.log('Query range (UTC):');
  console.log('  Start:', startDate.toISOString());
  console.log('  End:', endDate.toISOString());
  console.log('');

  const orders = await db.order.findMany({
    where: { deviceId, createdAt: { gte: startDate, lt: endDate } },
    select: { orderId: true, createdAt: true, amount: true, isSuccess: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Orders for device', deviceId, ':', orders.length, 'total');
  console.log('');

  orders.forEach((o, i) => {
    const utc = o.createdAt.toISOString();
    const sgt = o.createdAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
    console.log(`${i+1}. ${o.orderId} | UTC: ${utc} | SGT: ${sgt}`);
  });

  await db.$disconnect();
}
main();
