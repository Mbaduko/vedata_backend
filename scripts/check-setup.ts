#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import config from '../src/config';

const prisma = new PrismaClient();

async function checkSetup() {
  console.log('🔍 Checking Vedata Backend Setup...\n');

  // Check 1: Environment variables
  console.log('📋 Environment Variables:');
  console.log(`  NODE_ENV: ${config.env}`);
  console.log(`  PORT: ${config.port}`);
  console.log(`  DATABASE_URL: ${config.databaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`  JWT_SECRET: ${config.jwtSecret !== 'vedata-dev-secret-change-in-production' ? '✅ Custom' : '⚠️  Using default (change in production!)'}`);
  console.log(`  JWT_REFRESH_SECRET: ${config.jwtRefreshSecret !== 'vedata-dev-refresh-secret' ? '✅ Custom' : '⚠️  Using default (change in production!)'}`);
  console.log(`  CORS_ORIGIN: ${config.corsOrigin}\n`);

  // Check 2: Database connection
  console.log('🔌 Database Connection:');
  try {
    await prisma.$connect();
    console.log('  ✅ Database connection successful\n');
  } catch (error) {
    console.log('  ❌ Database connection failed');
    console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(1);
  }

  // Check 3: Database tables
  console.log('📊 Database Tables:');
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    if (tables.length === 0) {
      console.log('  ⚠️  No tables found - run: npm run db:migrate\n');
    } else {
      console.log(`  ✅ Found ${tables.length} tables\n`);
    }
  } catch (error) {
    console.log('  ⚠️  Could not check tables\n');
  }

  // Check 4: Admin user
  console.log('👤 Admin User:');
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@vedata.rw' },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (admin) {
      console.log('  ✅ Admin user exists');
      console.log(`     Name: ${admin.name}`);
      console.log(`     Email: ${admin.email}`);
      console.log(`     Role: ${admin.role}`);
      console.log(`     Status: ${admin.status}\n`);
    } else {
      console.log('  ⚠️  Admin user not found - run: npm run db:seed\n');
    }
  } catch (error) {
    console.log('  ⚠️  Could not check admin user\n');
  }

  // Check 5: User count
  console.log('📈 Database Statistics:');
  try {
    const userCount = await prisma.user.count();
    const zoneCount = await prisma.zone.count();
    const animalCount = await prisma.animal.count();
    
    console.log(`  Users: ${userCount}`);
    console.log(`  Zones: ${zoneCount}`);
    console.log(`  Animals: ${animalCount}\n`);
  } catch (error) {
    console.log('  ⚠️  Could not fetch statistics\n');
  }

  console.log('✅ Setup check complete!\n');

  if (config.env === 'production') {
    console.log('🚨 PRODUCTION WARNINGS:');
    if (config.jwtSecret === 'vedata-dev-secret-change-in-production') {
      console.log('  ⚠️  Change JWT_SECRET to a strong random value!');
    }
    if (config.jwtRefreshSecret === 'vedata-dev-refresh-secret') {
      console.log('  ⚠️  Change JWT_REFRESH_SECRET to a strong random value!');
    }
    console.log('');
  }

  await prisma.$disconnect();
}

checkSetup().catch((error) => {
  console.error('❌ Setup check failed:', error);
  process.exit(1);
});
