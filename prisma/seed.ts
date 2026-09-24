import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123456', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vedata.rw' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@vedata.rw',
      password: adminPassword,
      role: 'superadmin',
      status: 'active',
    },
  });

  console.log('✅ Created admin user:', admin.email);
  console.log('   Password: admin123456');
  console.log('');
  console.log('✨ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
