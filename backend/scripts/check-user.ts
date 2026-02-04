import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@capitalmgr.com' },
    select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true }
  });

  if (!user) {
    console.log('USER NOT FOUND');
    return;
  }

  console.log('User found:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  Name:', user.name);
  console.log('  Role:', user.role);
  console.log('  isActive:', user.isActive);

  const testPass = await bcrypt.compare('Dorothy1956!', user.passwordHash);
  console.log('  Password check:', testPass ? 'VALID' : 'INVALID');

  await prisma.$disconnect();
}

check().catch(console.error);
