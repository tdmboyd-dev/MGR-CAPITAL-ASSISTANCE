-- Additive operation journal; no existing registry targets removed.
-- AlterTable
ALTER TABLE "FileRegistry" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lifecycle" TEXT NOT NULL DEFAULT 'READY';

