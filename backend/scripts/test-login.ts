import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function testLogin() {
  const email = 'admin@capitalmgr.com';
  const password = 'Dorothy1956!';

  console.log('Testing login for:', email);
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('JWT_SECRET length:', JWT_SECRET.length);

  // Step 1: Find user
  console.log('\n1. Finding user...');
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      role: true,
      employeeTier: true,
      isActive: true,
    },
  });

  if (!user) {
    console.log('FAIL: User not found');
    return;
  }
  console.log('  Found user:', user.id, user.email, user.role);

  // Step 2: Check isActive
  console.log('\n2. Checking isActive...');
  if (!user.isActive) {
    console.log('FAIL: User is not active');
    return;
  }
  console.log('  User is active');

  // Step 3: Verify password
  console.log('\n3. Verifying password...');
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    console.log('FAIL: Password invalid');
    return;
  }
  console.log('  Password is valid');

  // Step 4: Generate access token
  console.log('\n4. Generating access token...');
  try {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tier: user.employeeTier,
        type: 'access',
      },
      JWT_SECRET,
      {
        expiresIn: 900, // 15 minutes
        issuer: 'mgr-capital',
        audience: 'mgr-capital-app',
      }
    );
    console.log('  Access token generated, length:', accessToken.length);
  } catch (e: any) {
    console.log('FAIL: Access token generation failed:', e.message);
    return;
  }

  // Step 5: Generate refresh token
  console.log('\n5. Generating refresh token...');
  try {
    const rawToken = crypto.randomBytes(64).toString('base64url');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    console.log('  Raw token length:', rawToken.length);
    console.log('  Hashed token length:', hashedToken.length);

    // Try to create refresh token in database
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        hashedToken,
        userAgent: 'test-script',
        ipAddress: '127.0.0.1',
        expiresAt,
      },
    });
    console.log('  Refresh token created in DB, id:', refreshTokenRecord.id);

    // Clean up test token
    await prisma.refreshToken.delete({ where: { id: refreshTokenRecord.id } });
    console.log('  Test token cleaned up');
  } catch (e: any) {
    console.log('FAIL: Refresh token creation failed:', e.message);
    console.log('  Full error:', e);
    return;
  }

  // Step 6: Update lastLoginAt
  console.log('\n6. Updating lastLoginAt...');
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    console.log('  lastLoginAt updated');
  } catch (e: any) {
    console.log('FAIL: lastLoginAt update failed:', e.message);
    return;
  }

  console.log('\n✓ ALL STEPS PASSED - Login should work');

  await prisma.$disconnect();
}

testLogin().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});
