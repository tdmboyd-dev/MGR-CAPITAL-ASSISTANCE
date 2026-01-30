/**
 * Setup Founder User — MGR CAPITAL ASSISTANCE
 *
 * Creates or updates the founder account with the correct credentials.
 * Run with: node setup-founder.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const FOUNDER_EMAIL = 'admin@capitalmgr.com';
const FOUNDER_PASSWORD = 'Dorothy1956!';
const FOUNDER_NAME = 'Founder';

async function setupFounder() {
  console.log('Setting up founder account...\n');

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: FOUNDER_EMAIL },
      select: { id: true, email: true, role: true, isActive: true }
    });

    const passwordHash = await bcrypt.hash(FOUNDER_PASSWORD, 12);

    if (existingUser) {
      console.log('Found existing user:', existingUser.email);
      console.log('Current role:', existingUser.role);
      console.log('Is active:', existingUser.isActive);

      // Update password and ensure role is FOUNDER and isActive is true
      const updated = await prisma.user.update({
        where: { email: FOUNDER_EMAIL },
        data: {
          passwordHash,
          role: 'FOUNDER',
          isActive: true,
        },
        select: { id: true, email: true, role: true, isActive: true }
      });

      console.log('\n✅ Founder account updated:');
      console.log('   Email:', updated.email);
      console.log('   Role:', updated.role);
      console.log('   Active:', updated.isActive);
      console.log('   Password: Dorothy1956!');
    } else {
      // Create new founder user
      const newUser = await prisma.user.create({
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

      console.log('\n✅ Founder account created:');
      console.log('   Email:', newUser.email);
      console.log('   Role:', newUser.role);
      console.log('   Active:', newUser.isActive);
      console.log('   Password: Dorothy1956!');
    }

    // Clear any refresh tokens to ensure clean login
    const deleted = await prisma.refreshToken.deleteMany({
      where: {
        user: { email: FOUNDER_EMAIL }
      }
    });
    console.log(`\n🔄 Cleared ${deleted.count} old refresh tokens`);

    console.log('\n🚀 You can now log in at:');
    console.log('   Frontend: http://localhost:3011');
    console.log('   Email: admin@capitalmgr.com');
    console.log('   Password: Dorothy1956!');

  } catch (error) {
    console.error('❌ Error setting up founder:', error.message);

    if (error.code === 'P2002') {
      console.log('\n💡 If you see a unique constraint error, the user already exists.');
      console.log('   Try running: node reset-password.mjs');
    }

    if (error.code === 'P2025') {
      console.log('\n💡 User not found. Creating new account...');
    }
  } finally {
    await prisma.$disconnect();
  }
}

setupFounder();
