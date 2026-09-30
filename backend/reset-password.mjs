/**
 * Reset a user password without storing credentials in source control.
 *
 * Required environment:
 *   RESET_USER_EMAIL
 *   RESET_USER_PASSWORD
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword() {
  const email = process.env.RESET_USER_EMAIL?.trim().toLowerCase();
  const newPassword = process.env.RESET_USER_PASSWORD;

  if (!email || !email.includes('@')) {
    throw new Error('RESET_USER_EMAIL is required and must be a valid email address');
  }
  if (!newPassword || newPassword.length < 14) {
    throw new Error('RESET_USER_PASSWORD is required and must be at least 14 characters');
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const result = await prisma.user.update({
    where: { email },
    data: { passwordHash: hash },
    select: { id: true, email: true, role: true }
  });

  await prisma.refreshToken.deleteMany({ where: { userId: result.id } });

  console.log('Password reset successfully for:', result.email);
  console.log('Role:', result.role);
  console.log('All existing refresh tokens were revoked.');
}

resetPassword()
  .catch((error) => {
    console.error('Password reset failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
