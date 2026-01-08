// Seed orders for device 852344 - Batch 2

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEVICE_ID = "852344";
const DEVICE_NAME = "325 Balestier Rd";

const orders = [
  // Failed orders
  { orderId: "26010812165885233440", time: "2026-01-08 12:16:59", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010812164885233440", time: "2026-01-08 12:16:50", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010812164685233440", time: "2026-01-08 12:16:49", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010811591985233440", time: "2026-01-08 11:59:21", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010809061185233440", time: "2026-01-08 09:06:11", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010807563885233440", time: "2026-01-08 07:56:39", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010807541785233440", time: "2026-01-08 07:54:18", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010807541285233440", time: "2026-01-08 07:54:13", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010807540685233440", time: "2026-01-08 07:54:07", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010807535685233440", time: "2026-01-08 07:53:57", amount: 0, quantity: 1, isSuccess: false },
  // Successful order
  { orderId: "26010807000185233440", time: "2026-01-08 06:59:56", amount: 280, quantity: 1, isSuccess: true },
];

async function main() {
  console.log(`\n🔄 Seeding ${orders.length} orders (Batch 2) for device ${DEVICE_ID}...\n`);

  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    const existing = await prisma.order.findFirst({
      where: { orderId: order.orderId },
    });

    if (existing) {
      console.log(`   ⏭️  Skipped (exists): ${order.orderId}`);
      skipped++;
      continue;
    }

    await prisma.order.create({
      data: {
        orderId: order.orderId,
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        amount: order.amount,
        quantity: order.quantity,
        payWay: "2",
        isSuccess: order.isSuccess,
        createdAt: new Date(order.time.replace(" ", "T") + "+08:00"),
      },
    });

    const status = order.isSuccess ? "✅" : "❌";
    console.log(`   ${status} Created: ${order.orderId} - $${(order.amount / 100).toFixed(2)} x${order.quantity}`);
    created++;
  }

  console.log(`\n✅ Done! Created: ${created}, Skipped: ${skipped}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
