import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Roles } from './generated/prisma/client';
import { hashPassword } from '../src/utils/password.util.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ DATABASE_URL must be set in environment variables.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: [{ emit: 'event', level: 'error' }],
});

async function main() {
  console.log('🌱 Seeding roles and admin user...');

  // ----------------------
  // 1️⃣ SecuritySetting
  // ----------------------
  const securitySetting =
    (await prisma.securitySetting.findFirst()) ??
    (await prisma.securitySetting.create({
      data: {
        twoFactorAuth: false,
        passwordMinLength: 8,
        maxLoginAttempts: 5,
        accountLockoutDuration: 30,
      },
    }));

  console.log(`✅ SecuritySetting ready (ID: ${securitySetting.id})`);

  // ----------------------
  // 2️⃣ Roles
  // ----------------------
  const roleMap: Record<string, number> = {};
  for (const name of [Roles.ADMIN, Roles.USER]) {
    const role = (await prisma.role.findFirst({ where: { name } })) ??
      (await prisma.role.create({ data: { name } }));
    roleMap[name] = role.id;
    console.log(`✅ Role ready: ${name} (ID: ${role.id})`);
  }

  // ----------------------
  // 3️⃣ Admin User
  // ----------------------
  const adminEmail = 'admin@insights.local';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    console.log(`ℹ️ Admin already exists (ID: ${existingAdmin.id})`);
  } else {
    const adminPasswordHash = await hashPassword('admin123'); // CHANGE LATER
    const admin = await prisma.user.create({
      data: {
        name: 'System Admin',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: { connect: { id: roleMap[Roles.ADMIN] } },
        securitySetting: { connect: { id: securitySetting.id } },
        status: 'ACTIVE',
        emailVerified: false,
      },
    });
    console.log(`✅ Admin user created (ID: ${admin.id})`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Admin seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
