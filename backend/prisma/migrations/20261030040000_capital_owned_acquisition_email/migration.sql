-- CreateTable
CREATE TABLE "CapitalSourceSnapshot" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3),
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquiredById" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "rawBytes" BYTEA NOT NULL,
    "rightsReference" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "CapitalSourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalSourceRecord" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "normalized" JSONB NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalRecoveryItem" (
    "id" TEXT NOT NULL,
    "businessKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "recoveryType" TEXT NOT NULL,
    "courtCaseNumber" TEXT NOT NULL,
    "parcelNumber" TEXT NOT NULL,
    "reportedOwner" TEXT NOT NULL,
    "reportedAmountCents" INTEGER NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "latestRecordId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'RESEARCH_REQUIRED',
    "externalClaimStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED',
    "notes" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalRecoveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalRecoveryDocketCheck" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "acquiredById" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalRecoveryDocketCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalRecoveryObservation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalRecoveryObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalEmailJob" (
    "id" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tenantId" TEXT,
    "caseId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "messageId" TEXT,
    "receipt" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalEmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapitalSourceSnapshot_sourceId_acquiredAt_idx" ON "CapitalSourceSnapshot"("sourceId", "acquiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalSourceSnapshot_sourceId_sha256_key" ON "CapitalSourceSnapshot"("sourceId", "sha256");

-- CreateIndex
CREATE INDEX "CapitalSourceRecord_sourceRecordId_idx" ON "CapitalSourceRecord"("sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalSourceRecord_snapshotId_sourceRecordId_key" ON "CapitalSourceRecord"("snapshotId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalRecoveryItem_businessKey_key" ON "CapitalRecoveryItem"("businessKey");

-- CreateIndex
CREATE INDEX "CapitalRecoveryItem_state_county_stage_idx" ON "CapitalRecoveryItem"("state", "county", "stage");

-- CreateIndex
CREATE INDEX "CapitalRecoveryDocketCheck_itemId_capturedAt_idx" ON "CapitalRecoveryDocketCheck"("itemId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalRecoveryDocketCheck_itemId_snapshotId_key" ON "CapitalRecoveryDocketCheck"("itemId", "snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalRecoveryObservation_recordId_key" ON "CapitalRecoveryObservation"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalRecoveryObservation_itemId_recordId_key" ON "CapitalRecoveryObservation"("itemId", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalEmailJob_requestHash_key" ON "CapitalEmailJob"("requestHash");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalEmailJob_messageId_key" ON "CapitalEmailJob"("messageId");

-- CreateIndex
CREATE INDEX "CapitalEmailJob_status_nextAttemptAt_idx" ON "CapitalEmailJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "CapitalEmailJob_createdById_createdAt_idx" ON "CapitalEmailJob"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "CapitalSourceRecord" ADD CONSTRAINT "CapitalSourceRecord_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CapitalSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalRecoveryDocketCheck" ADD CONSTRAINT "CapitalRecoveryDocketCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CapitalRecoveryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalRecoveryDocketCheck" ADD CONSTRAINT "CapitalRecoveryDocketCheck_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CapitalSourceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalRecoveryObservation" ADD CONSTRAINT "CapitalRecoveryObservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CapitalRecoveryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalRecoveryObservation" ADD CONSTRAINT "CapitalRecoveryObservation_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CapitalSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
