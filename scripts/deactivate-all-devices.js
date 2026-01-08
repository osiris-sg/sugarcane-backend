// Script to set all devices to inactive
// Devices will be activated when they report temperature

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("\n🔄 Setting all devices to inactive...\n");

  // Count devices first
  const beforeCount = await prisma.device.count({
    where: { isActive: true },
  });
  console.log(`   Active devices before: ${beforeCount}`);

  // Update all devices to inactive
  const result = await prisma.device.updateMany({
    data: { isActive: false },
  });

  console.log(`   Updated ${result.count} devices to inactive`);

  // Count after
  const afterCount = await prisma.device.count({
    where: { isActive: true },
  });
  console.log(`   Active devices after: ${afterCount}`);

  console.log("\n✅ Done! Devices will activate when they report temperature.\n");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
