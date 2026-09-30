/**
 * Setup Founder User — MGR CAPITAL ASSISTANCE
 *
 * Required environment:
 *   FOUNDER_EMAIL
 *   FOUNDER_PASSWORD
 * Optional:
 *   FOUNDER_NAME
 *
 * Example:
 *   FOUNDER_EMAIL=you@example.com FOUNDER_PASSWORD='use-a-password-manager' node setup-founder.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL?.trim().toLowerCase();
const FOUNDER_PASSWORD = process.env.FOUNDER_PASSWORD;
const FOUNDER_NAME = process.env.FOUNDER_NAME?.trim() || 'Founder';

function requireFounderCredentials() {
  if (!FOUNDER_EMAIL || !FOUNDER_EMAIL.includes('@')) {
    throw new Error('FOUNDER_EMAIL is required and must be a valid email address');
  }
  if (!FOUNDER_PASSWORD || FOUNDER_PASSWORD.length < 14) {
    throw new Error('FOUNDER_PASSWORD is required and must be at least 14 characters');
  }
}

async function setupFounder() {
  requireFounderCredentials();
  console.log('Setting up founder account...');

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: FOUNDER_EMAIL },
      select: { id: true, email: true, role: true, isActive: true }
    });

    const passwordHash = await bcrypt.hash(FOUNDER_PASSWORD, 12);

    const user = existingUser
      ? await prisma.user.update({
          where: { email: FOUNDER_EMAIL },
          data: { passwordHash, role: 'FOUNDER', isActive: true },
          select: { id: true, email: true, role: true, isActive: true }
        })
      : await prisma.user.create({
          data: {
            email: FOUNDER_EMAIL,
            passwordHash,
            name: FOUNDER_NAME,
            role: 'FOUNDER',
            isActive: true,
            trainingCompleted: true,
          },
          select: { id: true, email: true, role: true, isActive: true }
        });

    const deleted = await prisma.refreshToken.deleteMany({
      where: { user: { email: FOUNDER_EMAIL } }
    });

    console.log(`Founder account ${existingUser ? 'updated' : 'created'} successfully.`);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Active:', user.isActive);
    console.log(`Revoked ${deleted.count} existing refresh token(s).`);
    console.log('Password was supplied through the environment and is not printed.');
  } finally {
    await prisma.$disconnect();
  }
}

setupFounder().catch((error) => {
  console.error('Founder setup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
