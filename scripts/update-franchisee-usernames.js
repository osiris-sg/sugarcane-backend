// Update franchisee accounts from email to username

const { createClerkClient } = require('@clerk/backend');
const { PrismaClient } = require('@prisma/client');

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const prisma = new PrismaClient();

// All users to update: email -> username
const usersToUpdate = [
  { email: 'Jeffrey2511@yahoo.com.sg', username: 'atcel.ventures', name: 'Atcel Ventures Pte Ltd' },
  { email: 'zihuisilver@gmail.com', username: 'my.happy.place', name: 'My Happy Place' },
  { email: 'vyleroy@gmail.com', username: 'lvm', name: 'LVM' },
  { email: 'trevorshee@gmail.com', username: 'yh.auto', name: 'YH Auto' },
  // { email: '', username: 'arca.advisory', name: 'Arca Advisory Pte Ltd' }, // No email
  { email: 'vonster07@gmail.com', username: 'yvonne.ng', name: 'Yvonne Ng' },
  { email: 'Sjvendora@gmail.com', username: 'sj.vendora', name: 'SJ Vendora' },
  { email: 'k.jaslyn68@gmail.com', username: 'jaslyn.kee', name: 'Jaslyn Kee' },
  { email: 'midgal@gmail.com', username: 'marleen.lim', name: 'Marleen Lim' },
  { email: 'shalomwong516@yahoo.com.sg', username: 'shalom.wong', name: 'Shalom Wong Wei Hao' },
  { email: 'spl.831@gmail.com', username: 'see.peiling', name: 'See Pei Ling' },
  { email: 'keyihuang@gmail.com', username: 'kua.aik.hong', name: 'Kua Aik Hong' },
  { email: 'muneshmck9@gmail.com', username: 'munesh.mickey', name: 'Munesh Mickey' },
  { email: 'trucaresg@gmail.com', username: 'perficient.vending', name: 'Perficient Vending' },
  { email: 'heeman1979@yahoo.com', username: 'hee.cheng.ting', name: 'Hee Cheng Ting' },
  { email: 'misc2746@gmail.com', username: 'chris.lam', name: 'Chris Lam' },
  { email: 'haotianyu94@gmail.com', username: 'hao.tian', name: 'Hao Tian' },
  { email: 'elainepaperstop@gmail.com', username: 'elaine.lim', name: 'Elaine Lim Tze Ting' },
  { email: 'Chyeming.ng@gmail.com', username: 'lye.wai.ping', name: 'Lye Wai Ping' },
  { email: 'adamyeeks@gmail.com', username: 'atherus.aureon', name: 'Atherus & Aureon Pte Ltd' },
  { email: 'nsy_31@yahoo.com.sg', username: 'ng.shi.yong', name: 'Ng Shi Yong' },
  { email: 'kavi.vsp@gmail.com', username: 'kavithas.aravana', name: 'Kavitha Saravana Perumal' },
  { email: 'eileenkhong@gmail.com', username: 'eileen.khong', name: 'Eileen Khong Lai Kie' },
  { email: 'han_xu_yang@hotmail.com', username: 'han.xu.yang', name: 'Han Xuyang' },
  { email: 'zyli84@gmail.com', username: 'li.zhen.yang', name: 'Li Zhenyang' },
  { email: 'nadiahfilz@hotmail.com', username: 'filzah.nadiah', name: 'FILZAH NADIAH BTE FA.' },
  { email: 'angpeikiat@gmail.com', username: 'hoha.supercane', name: 'Hoha Pte Ltd' },
  { email: 'jesusally@hotmail.com', username: 'dream.knit', name: 'Dream Knit' },
  { email: 'hctan832001@yahoo.com', username: 'tan.hock.chon', name: 'Tan Hock Chon' },
  { email: 'farandy.liong@gmail.com', username: 'farandy.liong', name: 'Farandy Angesti Liong' },
];

async function main() {
  console.log(`\n🔄 Updating ${usersToUpdate.length} franchisee accounts to use usernames...\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const user of usersToUpdate) {
    try {
      console.log(`\n📧 Processing: ${user.email} -> ${user.username}`);

      // Find user by email in Clerk
      const clerkUsers = await clerkClient.users.getUserList({
        emailAddress: [user.email],
      });

      if (clerkUsers.data.length === 0) {
        console.log(`   ⚠️  No Clerk user found with email: ${user.email}`);
        notFound++;
        continue;
      }

      const clerkUser = clerkUsers.data[0];

      // Check if username already set
      if (clerkUser.username === user.username) {
        console.log(`   ⏭️  Already has username: ${user.username}`);
        skipped++;
        continue;
      }

      console.log(`   Found Clerk user: ${clerkUser.id}`);

      // Update username in Clerk
      await clerkClient.users.updateUser(clerkUser.id, {
        username: user.username,
      });
      console.log(`   ✅ Updated Clerk username to: ${user.username}`);

      // Update username in database
      const dbUser = await prisma.user.findFirst({
        where: { clerkId: clerkUser.id },
      });

      if (dbUser) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { username: user.username },
        });
        console.log(`   ✅ Updated DB username to: ${user.username}`);
      } else {
        console.log(`   ⚠️  No DB user found for Clerk ID: ${clerkUser.id}`);
      }

      updated++;

    } catch (error) {
      console.error(`   ❌ Error updating ${user.email}:`, error.message);
    }
  }

  console.log(`\n✅ Done! Updated: ${updated}, Skipped: ${skipped}, Not Found: ${notFound}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
