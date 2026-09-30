/**
 * Reset Admin/Founder Password Script
 *
 * Required environment:
 *   ADMIN_EMAIL
 *   ADMIN_NEW_PASSWORD
 *
 * This script will NOT create or promote an account. Privilege assignment must
 * remain an explicit administrative action.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const newPassword = process.env.ADMIN_NEW_PASSWORD;

  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_EMAIL is required and must be a valid email address');
  }
  if (!newPassword || newPassword.length < 14) {
    throw new Error('ADMIN_NEW_PASSWORD is required and must be at least 14 characters');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, passwordHash: true },
  });

  if (!existingUser) {
    throw new Error('User not found. This reset script does not create privileged accounts.');
  }
  if (!['FOUNDER', 'ADMIN'].includes(existingUser.role)) {
    throw new Error('Refusing password reset: target is not an ADMIN or FOUNDER account.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { passwordHash },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: existingUser.id } }),
  ]);

  const updated = await prisma.user.findUnique({ where: { email } });
  const isValid = !!updated && await bcrypt.compare(newPassword, updated.passwordHash);
  if (!isValid) {
    throw new Error('Password verification failed after update');
  }

  console.log(`Password reset successfully for ${email}; existing sessions revoked.`);
}

main()
  .catch((error) => {
    console.error('Admin password reset failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
