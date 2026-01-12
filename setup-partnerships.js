const { PrismaClient } = require('@prisma/client');
const { createClerkClient } = require('@clerk/backend');

const db = new PrismaClient();

async function setup() {
  // Get the Partnerships group
  const group = await db.group.findFirst({
    where: { name: 'Partnerships' }
  });

  if (!group) {
    console.log('Partnerships group not found! Run the setup first.');
    await db.$disconnect();
    return;
  }

  console.log('Found Partnerships group:', group.id);

  // Check if user already exists in DB
  const existingDbUser = await db.user.findFirst({
    where: { username: 'partnerships' }
  });

  if (existingDbUser) {
    console.log('User already exists in DB, updating...');
    await db.user.update({
      where: { id: existingDbUser.id },
      data: { groupId: group.id, role: 'PARTNERSHIPS' }
    });
    console.log('Updated existing user with PARTNERSHIPS role and group');
    await db.$disconnect();
    return;
  }

  // Create Clerk client
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  // Check if user exists in Clerk
  const existingUsers = await clerk.users.getUserList({ username: ['partnerships'] });

  let clerkUser;
  if (existingUsers.data.length > 0) {
    clerkUser = existingUsers.data[0];
    console.log('Found existing Clerk user:', clerkUser.id);

    // Update metadata
    await clerk.users.updateUser(clerkUser.id, {
      publicMetadata: { role: 'partnerships' }
    });
  } else {
    // Create new Clerk user
    console.log('Creating new Clerk user...');
    clerkUser = await clerk.users.createUser({
      username: 'partnerships',
      password: 'password',
      firstName: 'Partnerships',
      lastName: 'User',
      publicMetadata: { role: 'partnerships' }
    });
    console.log('Created Clerk user:', clerkUser.id);
  }

  // Create or update DB user
  await db.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      username: 'partnerships',
      firstName: 'Partnerships',
      lastName: 'User',
      role: 'PARTNERSHIPS',
      groupId: group.id,
    },
    create: {
      clerkId: clerkUser.id,
      username: 'partnerships',
      firstName: 'Partnerships',
      lastName: 'User',
      role: 'PARTNERSHIPS',
      groupId: group.id,
    }
  });

  console.log('\nPartnerships user created successfully!');
  console.log('Username: partnerships');
  console.log('Password: password');
  console.log('Group ID:', group.id);

  await db.$disconnect();
}

setup().catch(console.error);
