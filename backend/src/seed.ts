import { prisma } from './prisma';
import bcrypt from 'bcrypt';

async function main() {
  console.log('Seeding SaaS database...');
  
  const passwordHash = await bcrypt.hash('password123', 10);

  // Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      password: passwordHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Database seeded successfully!');
  console.log('---------------------------');
  console.log('Test Accounts (Password: password123)');
  console.log('1. admin@company.com (SUPER_ADMIN)');
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
