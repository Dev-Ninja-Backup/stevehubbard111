import 'dotenv/config'; // loads .env
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import {hashPassword} from '../src/utils/password.util.js'

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ DATABASE_URL must be set in environment variables.');
}

// Create Prisma client with PostgreSQL adapter
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: [{ emit: 'event', level: 'error' }],
});

async function main() {
  console.log('🌱 Starting database seed with PrismaPg adapter...');

  // 1️⃣ Seed Roles
  const roles = ['ADMIN', 'USER'];
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {}, // do nothing if exists
      create: { name },
    });
  }
  console.log('✅ Roles seeded');

  // 2️⃣ Seed Admin User safely
  const adminEmail = 'admin@insights.local';
  const adminPassword = 'admin123'; // change later
  const adminPasswordHash = await hashPassword(adminPassword);

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`ℹ️ Admin user already exists: ${adminEmail} (ID: ${existingAdmin.id})`);
  } else {
    const newAdmin = await prisma.user.create({
      data: {
        name: 'System Admin',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: {
          connect: { name: 'ADMIN' },
        },
      },
    });
    console.log(`✅ Admin user created: ${adminEmail} (ID: ${newAdmin.id})`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
