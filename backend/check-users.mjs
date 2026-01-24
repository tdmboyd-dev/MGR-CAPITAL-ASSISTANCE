import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      name: true,
      passwordHash: true
    }
  });

  console.log("Users in database:");
  users.forEach(u => {
    console.log(`  ${u.email} | ${u.role} | active: ${u.isActive} | hash: ${u.passwordHash?.substring(0, 20)}...`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
