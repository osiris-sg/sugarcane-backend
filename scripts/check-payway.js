const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const startDate = new Date("2026-01-25T00:00:00+08:00");
  const endDate = new Date("2026-02-01T00:00:00+08:00");

  const orders = await db.orderImport.findMany({
    where: {
      createdAt: { gte: startDate, lt: endDate },
      payWay: { notIn: ["2", "35", "10", "25", "31", "17", "3", "4", "1000", "Free", "微信支付", "支付宝", "Alipay"] }
    },
    select: { payWay: true, amount: true }
  });

  const grouped = {};
  orders.forEach(o => {
    const key = o.payWay || "(empty)";
    if (!grouped[key]) grouped[key] = { count: 0, amount: 0 };
    grouped[key].count++;
    grouped[key].amount += o.amount;
  });

  console.log("Unknown payWay values:");
  Object.entries(grouped).forEach(([payWay, stats]) => {
    console.log(`  "${payWay}": ${stats.count} orders, $${(stats.amount/100).toFixed(2)}`);
  });

  await db.$disconnect();
}
main();
