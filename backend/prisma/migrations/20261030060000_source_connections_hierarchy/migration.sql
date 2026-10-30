BEGIN;
-- AlterTable
ALTER TABLE "EmployeeTransfer" ADD COLUMN     "initiatedById" TEXT;

-- CreateTable
CREATE TABLE "CapitalIdentityProfile" (
    "id" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "attestedById" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'SELF_ATTESTED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalIdentityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalSourceConnection" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "tenantId" TEXT,
    "businessRef" TEXT NOT NULL,
    "workItemId" TEXT,
    "caseId" TEXT,
    "adapterId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL,
    "businessProfileVersion" INTEGER,
    "plan" JSONB NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "capturedSnapshotId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalSourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapitalIdentityProfile_subjectKind_subjectId_key" ON "CapitalIdentityProfile"("subjectKind", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalSourceConnection_tokenHash_key" ON "CapitalSourceConnection"("tokenHash");

-- CreateIndex
CREATE INDEX "CapitalSourceConnection_actorId_createdAt_idx" ON "CapitalSourceConnection"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChildCompany_tenantId_key" ON "ChildCompany"("tenantId");
COMMIT;
