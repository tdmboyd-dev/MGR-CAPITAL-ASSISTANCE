// ============================================
// STORAGE ADMIN ROUTES — FOUNDER ONLY
// Multi-provider storage management
// ============================================

import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { storageRouter } from "../services/storage/StorageRouter.js";
import prisma from "../lib/prisma.js";

const router = Router();

// All routes require FOUNDER role
router.use(authMiddleware);
router.use(roleGuard(["FOUNDER"]));

// ============================================
// PROVIDER TEMPLATES
// ============================================

const PROVIDER_TEMPLATES: Record<string, any> = {
  "cloudflare-r2": {
    displayName: "Cloudflare R2",
    type: "S3",
    config: { region: "auto" },
    capacityBytes: 10 * 1024 * 1024 * 1024, // 10GB
    credentialFields: ["endpoint", "accessKeyId", "secretAccessKey", "bucket"],
    setupGuide:
      "Create R2 bucket in Cloudflare dashboard → Settings → R2 → Create bucket → Generate API token with R2 read/write → Paste credentials here. Endpoint format: https://<accountId>.r2.cloudflarestorage.com",
  },
  "oracle-cloud": {
    displayName: "Oracle Cloud Object Storage",
    type: "S3",
    config: { region: "us-ashburn-1" },
    capacityBytes: 20 * 1024 * 1024 * 1024, // 20GB
    credentialFields: ["endpoint", "accessKeyId", "secretAccessKey", "bucket", "region"],
    setupGuide:
      "OCI Console → Object Storage → Create Bucket → Identity → Customer Secret Keys → Generate → Paste here. Endpoint format: https://<namespace>.compat.objectstorage.<region>.oraclecloud.com",
  },
  "backblaze-b2": {
    displayName: "Backblaze B2",
    type: "S3",
    config: {},
    capacityBytes: 10 * 1024 * 1024 * 1024, // 10GB
    credentialFields: ["endpoint", "accessKeyId", "secretAccessKey", "bucket"],
    setupGuide:
      "B2 Cloud Storage → Buckets → Create Bucket → App Keys → Add Application Key → Paste keyID as accessKeyId, applicationKey as secretAccessKey. Endpoint: https://s3.<region>.backblazeb2.com",
  },
  "idrive-e2": {
    displayName: "IDrive e2",
    type: "S3",
    config: {},
    capacityBytes: 10 * 1024 * 1024 * 1024, // 10GB
    credentialFields: ["endpoint", "accessKeyId", "secretAccessKey", "bucket"],
    setupGuide:
      "IDrive e2 Dashboard → Create Bucket → Access Keys → Create Access Key → Paste here. Endpoint from your e2 region dashboard.",
  },
  "tebi-io": {
    displayName: "Tebi.io (Free 25GB)",
    type: "S3",
    config: { region: "global", endpoint: "https://s3.tebi.io" },
    capacityBytes: 25 * 1024 * 1024 * 1024, // 25GB free (2 copies, 250GB egress/mo)
    credentialFields: ["accessKeyId", "secretAccessKey", "bucket"],
    setupGuide:
      "1) Sign up FREE at tebi.io\n2) Go to client.tebi.io/buckets → Create Bucket (e.g. 'mgr-capital-docs')\n3) Go to client.tebi.io/keys → Create key → click SHOW SECRET\n4) Paste Access Key + Secret below\n5) Endpoint (s3.tebi.io) and region (global) are auto-configured",
  },
  "supabase-storage": {
    displayName: "Supabase Storage (Free 1GB)",
    type: "S3",
    config: { region: "us-east-1" },
    capacityBytes: 1 * 1024 * 1024 * 1024, // 1GB free
    credentialFields: ["endpoint", "accessKeyId", "secretAccessKey", "bucket"],
    setupGuide:
      "1) Sign up FREE at supabase.com → Create New Project\n2) Go to Storage → S3 Connection tab\n3) Copy endpoint URL, access key, and secret key\n4) Create a bucket (e.g. 'mgr-documents')\n5) 1GB free storage, 2GB egress. Note: free projects pause after 7 days inactivity",
  },
  "filebase-ipfs": {
    displayName: "Filebase (IPFS — Free 5GB)",
    type: "S3",
    config: { region: "us-east-1", endpoint: "https://s3.filebase.com" },
    capacityBytes: 5 * 1024 * 1024 * 1024, // 5GB free (+ up to 100GB via referrals)
    credentialFields: ["accessKeyId", "secretAccessKey", "bucket"],
    setupGuide:
      "1) Sign up FREE at filebase.com (no credit card)\n2) Create an IPFS bucket (e.g. 'mgr-capital-files')\n3) Go to Access Keys → Copy Access Key + Secret\n4) Endpoint (s3.filebase.com) is auto-configured\n5) Files auto-pin to IPFS with 3x global redundancy",
  },
  "pcloud-free": {
    displayName: "pCloud (Free 10GB)",
    type: "PCLOUD",
    config: {},
    capacityBytes: 10 * 1024 * 1024 * 1024, // 10GB free
    credentialFields: ["accessToken", "locationId"],
    setupGuide:
      'Sign up FREE at pcloud.com (10GB free — verify email + upload a file to unlock full 10GB). Then: my.pcloud.com → Settings → App → Create new app → Generate access token → Paste here. Location: "us" for US, "eu" for EU. Full API access, zero cost.',
  },
  pcloud: {
    displayName: "pCloud (Lifetime 2TB)",
    type: "PCLOUD",
    config: {},
    capacityBytes: 2 * 1024 * 1024 * 1024 * 1024, // 2TB
    credentialFields: ["accessToken", "locationId"],
    setupGuide:
      'Buy pCloud 2TB Lifetime ($279-$399) → my.pcloud.com → Settings → App → Create new app → Generate access token → Paste here. Location: "us" for US, "eu" for EU.',
  },
};

// ============================================
// DASHBOARD
// ============================================

router.get(
  "/dashboard",
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const dashboard = await storageRouter.getStorageDashboard();
    res.json(dashboard);
  })
);

// ============================================
// PROVIDERS CRUD
// ============================================

router.get(
  "/providers",
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const providers = await prisma.storageProvider.findMany({
      orderBy: { priority: "asc" },
      include: { _count: { select: { files: true } } },
    });

    res.json(
      providers.map((p) => ({
        ...p,
        capacityBytes: p.capacityBytes.toString(),
        usedBytes: p.usedBytes.toString(),
        credentials: p.credentials ? "***configured***" : null, // Never expose credentials
        fileCount: p._count.files,
      }))
    );
  })
);

router.get(
  "/templates",
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json(PROVIDER_TEMPLATES);
  })
);

router.post(
  "/providers",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { templateKey, credentials, priority, capacityBytes: customCapacity } = req.body;

    const template = PROVIDER_TEMPLATES[templateKey];
    if (!template) {
      res.status(400).json({ error: `Unknown template: ${templateKey}. Available: ${Object.keys(PROVIDER_TEMPLATES).join(", ")}` });
      return;
    }

    // Check if provider already exists
    const existing = await prisma.storageProvider.findUnique({
      where: { name: templateKey },
    });
    if (existing) {
      res.status(409).json({ error: `Provider "${templateKey}" already configured. Use PUT to update.` });
      return;
    }

    // Validate required credential fields
    for (const field of template.credentialFields) {
      if (!credentials?.[field]) {
        res.status(400).json({ error: `Missing required credential: ${field}` });
        return;
      }
    }

    const provider = await prisma.storageProvider.create({
      data: {
        name: templateKey,
        displayName: template.displayName,
        type: template.type,
        isEnabled: false, // Start disabled — test first
        priority: priority || 50,
        credentials: credentials,
        config: template.config,
        capacityBytes: BigInt(customCapacity || template.capacityBytes),
      },
    });

    res.status(201).json({
      ...provider,
      capacityBytes: provider.capacityBytes.toString(),
      usedBytes: provider.usedBytes.toString(),
      credentials: "***configured***",
      message: 'Provider created (disabled). Use "Test Connection" then "Enable" to activate.',
    });
  })
);

router.put(
  "/providers/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { credentials, config, priority, capacityBytes, displayName } = req.body;

    const provider = await prisma.storageProvider.findUnique({ where: { id } });
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }

    // Don't allow editing local provider credentials
    if (provider.type === "LOCAL" && credentials) {
      res.status(400).json({ error: "Cannot edit credentials for local filesystem provider" });
      return;
    }

    const updateData: any = {};
    if (credentials) updateData.credentials = credentials;
    if (config) updateData.config = config;
    if (priority !== undefined) updateData.priority = priority;
    if (capacityBytes !== undefined) updateData.capacityBytes = BigInt(capacityBytes);
    if (displayName) updateData.displayName = displayName;

    const updated = await prisma.storageProvider.update({
      where: { id },
      data: updateData,
    });

    // Reload adapter with new config
    await storageRouter.reloadAdapters();

    res.json({
      ...updated,
      capacityBytes: updated.capacityBytes.toString(),
      usedBytes: updated.usedBytes.toString(),
      credentials: updated.credentials ? "***configured***" : null,
    });
  })
);

router.delete(
  "/providers/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const provider = await prisma.storageProvider.findUnique({
      where: { id },
      include: { _count: { select: { files: true } } },
    });

    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }

    if (provider.name === "local") {
      res.status(400).json({ error: "Cannot delete local filesystem provider (fallback)" });
      return;
    }

    if (provider._count.files > 0) {
      res.status(400).json({
        error: `Provider has ${provider._count.files} files. Migrate all files first using bulk sync.`,
      });
      return;
    }

    await prisma.storageProvider.delete({ where: { id } });
    await storageRouter.reloadAdapters();

    res.json({ success: true, message: `Provider "${provider.displayName}" removed` });
  })
);

// ============================================
// PROVIDER ACTIONS
// ============================================

router.post(
  "/providers/:id/toggle",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const provider = await prisma.storageProvider.findUnique({ where: { id } });
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }

    const updated = await prisma.storageProvider.update({
      where: { id },
      data: { isEnabled: !provider.isEnabled },
    });

    await storageRouter.reloadAdapters();

    res.json({
      id: updated.id,
      name: updated.name,
      isEnabled: updated.isEnabled,
      message: `Provider "${updated.displayName}" ${updated.isEnabled ? "ENABLED" : "DISABLED"}`,
    });
  })
);

router.post(
  "/providers/:id/test",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const result = await storageRouter.testProvider(id);

    res.json({
      ...result,
      message: result.healthy
        ? "Connection successful! Provider is ready."
        : `Connection failed: ${result.error}`,
    });
  })
);

// ============================================
// SYNC & MIGRATION
// ============================================

router.post(
  "/sync",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sourceProviderId, targetProviderId } = req.body;

    if (!sourceProviderId || !targetProviderId) {
      res.status(400).json({ error: "sourceProviderId and targetProviderId required" });
      return;
    }

    if (sourceProviderId === targetProviderId) {
      res.status(400).json({ error: "Source and target must be different providers" });
      return;
    }

    const result = await storageRouter.bulkSync(sourceProviderId, targetProviderId);

    res.json({
      ...result,
      message: `Sync complete: ${result.migrated} migrated, ${result.failed} failed`,
    });
  })
);

router.post(
  "/migrate/:fileId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { fileId } = req.params;
    const { targetProviderId } = req.body;

    if (!targetProviderId) {
      res.status(400).json({ error: "targetProviderId required" });
      return;
    }

    const result = await storageRouter.migrate(fileId, targetProviderId);
    res.json(result);
  })
);

// ============================================
// FILE BROWSING
// ============================================

router.get(
  "/files",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { providerId, page, limit } = req.query;

    const result = await storageRouter.getFiles({
      providerId: providerId as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.json(result);
  })
);

// ============================================
// HEALTH CHECK (refresh all)
// ============================================

router.post(
  "/refresh-health",
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    await storageRouter.refreshHealth();
    const dashboard = await storageRouter.getStorageDashboard();
    res.json({ message: "Health checks refreshed", ...dashboard });
  })
);

export default router;
