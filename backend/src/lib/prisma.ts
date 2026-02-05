// ============================================
// SHARED PRISMA CLIENT — MGR CAPITAL ASSISTANCE
// Single instance to prevent connection pool exhaustion
// ============================================

import { PrismaClient } from "@prisma/client";

// Singleton pattern: reuse across all imports
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Always store singleton — prevents connection pool exhaustion in ALL environments
globalForPrisma.prisma = prisma;

// Graceful shutdown — prevent connection leaks
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
