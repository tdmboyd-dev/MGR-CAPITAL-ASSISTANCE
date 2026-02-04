/**
 * Reset Admin Password Script
 * Run with: npx tsx scripts/reset-admin-password.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@capitalmgr.com';
  const newPassword = 'Dorothy1956!';

  console.log(`Resetting password for ${email}...`);

  // Hash password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Update password
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    console.log('Password updated successfully!');
  } else {
    // Create user
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Timebeunus Boyd',
        role: 'FOUNDER',
        isActive: true,
        emailVerified: true,
      },
    });
    console.log('User created successfully!');
  }

  // Verify
  const user = await prisma.user.findUnique({ where: { email } });
  const isValid = await bcrypt.compare(newPassword, user!.passwordHash);
  console.log(`Password verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
