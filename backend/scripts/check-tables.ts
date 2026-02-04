import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    // Check if RefreshToken table exists by trying to count
    const count = await prisma.refreshToken.count();
    console.log('RefreshToken table exists, count:', count);
  } catch (e: any) {
    console.log('RefreshToken error:', e.message);
  }

  try {
    // Check UserSession
    const sessions = await prisma.userSession.count();
    console.log('UserSession table exists, count:', sessions);
  } catch (e: any) {
    console.log('UserSession error:', e.message);
  }

  try {
    // Check AuditLog
    const logs = await prisma.auditLog.count();
    console.log('AuditLog table exists, count:', logs);
  } catch (e: any) {
    console.log('AuditLog error:', e.message);
  }

  await prisma.$disconnect();
}

check();
