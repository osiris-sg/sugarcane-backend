// Seed orders for device 852344 (VY52 - 325 Balestier Rd)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEVICE_ID = "852344";
const DEVICE_NAME = "325 Balestier Rd"; // From location column

const orders = [
  // Successful orders
  { orderId: "26010815463685233440", time: "2026-01-08 15:46:38", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815422485233440", time: "2026-01-08 15:42:26", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815382585233440", time: "2026-01-08 15:38:28", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815343185233440", time: "2026-01-08 15:34:33", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815302485233440", time: "2026-01-08 15:30:25", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815261285233440", time: "2026-01-08 15:26:14", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815221285233440", time: "2026-01-08 15:22:15", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815183285233440", time: "2026-01-08 15:18:35", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815143585233440", time: "2026-01-08 15:14:37", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815103385233440", time: "2026-01-08 15:10:36", amount: 840, quantity: 3, isSuccess: true },
  { orderId: "26010815072385233440", time: "2026-01-08 15:07:28", amount: 280, quantity: 1, isSuccess: true },
  { orderId: "26010814082585233440", time: "2026-01-08 14:08:28", amount: 280, quantity: 1, isSuccess: true },
  { orderId: "26010813340185233440", time: "2026-01-08 13:34:03", amount: 280, quantity: 1, isSuccess: true },
  // Failed orders
  { orderId: "26010815143185233440", time: "2026-01-08 15:14:33", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010815065985233440", time: "2026-01-08 15:07:01", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010815012585233440", time: "2026-01-08 15:01:27", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010815012185233440", time: "2026-01-08 15:01:23", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010813333785233440", time: "2026-01-08 13:33:40", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010812261385233440", time: "2026-01-08 12:26:15", amount: 0, quantity: 1, isSuccess: false },
  { orderId: "26010812251785233440", time: "2026-01-08 12:25:20", amount: 0, quantity: 1, isSuccess: false },
];

async function main() {
  console.log(`\n🔄 Seeding ${orders.length} orders for device ${DEVICE_ID} (${DEVICE_NAME})...\n`);

  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    // Check if order already exists
    const existing = await prisma.order.findFirst({
      where: { orderId: order.orderId },
    });

    if (existing) {
      console.log(`   ⏭️  Skipped (exists): ${order.orderId}`);
      skipped++;
      continue;
    }

    // Create order
    await prisma.order.create({
      data: {
        orderId: order.orderId,
        deviceId: DEVICE_ID,
        deviceName: DEVICE_NAME,
        amount: order.amount,
        quantity: order.quantity,
        payWay: "2", // Cashless
        isSuccess: order.isSuccess,
        createdAt: new Date(order.time.replace(" ", "T") + "+08:00"), // Singapore timezone
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
