import { prisma } from './prisma';
import bcrypt from 'bcrypt';

async function main() {
  console.log('Seeding SaaS database...');
  
  const passwordHash = await bcrypt.hash('adill1122@@@', 10);

  // Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'adminadil@akflow.com' },
    update: {},
    create: {
      email: 'adminadil@akflow.com',
      password: passwordHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Database seeded successfully!');
  console.log('---------------------------');
  console.log('Test Accounts (Password: adill1122@@@)');
  console.log('1. adminadil@akflow.com (SUPER_ADMIN)');
  console.log('Login as Super Admin to create SaaS Companies and Managers.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
