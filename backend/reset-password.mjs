import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword() {
  const newPassword = 'Dorothy1956!';
  const hash = await bcrypt.hash(newPassword, 12);

  // Update the user's password
  const result = await prisma.user.update({
    where: { email: 'time@mgrcapital.com' },
    data: { passwordHash: hash },
    select: { id: true, email: true, role: true }
  });

  console.log('Password reset successfully for:', result.email);
  console.log('User ID:', result.id);
  console.log('Role:', result.role);
  console.log('New password: Dorothy1956!');

  await prisma.$disconnect();
}

resetPassword().catch(console.error);
