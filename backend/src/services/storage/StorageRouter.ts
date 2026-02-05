// ============================================
// STORAGE ROUTER — Smart Multi-Provider Engine
// Decides WHERE to store each file, manages FileRegistry,
// handles migrations, replication, and health monitoring
// ============================================

import { StorageProviderType } from "@prisma/client";
import * as crypto from "crypto";
import prisma from "../../lib/prisma.js";
import { IStorageProvider } from "./IStorageProvider.js";
import { LocalFilesystemAdapter } from "./LocalFilesystemAdapter.js";
import { S3GenericAdapter, S3AdapterConfig } from "./S3GenericAdapter.js";
import { PCloudAdapter, PCloudConfig } from "./PCloudAdapter.js";

interface RouterUploadResult {
  success: boolean;
  fileRegistryId?: string;
  providerId?: string;
  providerPath?: string;
  error?: string;
}

interface RouterDownloadResult {
  success: boolean;
  data?: Buffer;
  fileName?: string;
  mimeType?: string;
  error?: string;
}

interface ProviderDashboard {
  providers: {
    id: string;
    name: string;
    displayName: string;
    type: StorageProviderType;
    isEnabled: boolean;
    isHealthy: boolean;
    priority: number;
    usedBytes: string;
    capacityBytes: string;
    freeBytes: string;
    fileCount: number;
    lastHealthCheck: Date | null;
  }[];
  totalUsedBytes: string;
  totalCapacityBytes: string;
  totalFiles: number;
}

class StorageRouter {
  private adapters: Map<string, IStorageProvider> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure LOCAL provider exists
      await this.ensureLocalProvider();

      // Load all enabled providers and create adapters
      const providers = await prisma.storageProvider.findMany({
        where: { isEnabled: true },
        orderBy: { priority: "asc" },
      });

      for (const provider of providers) {
        try {
          const adapter = this.createAdapter(provider);
          if (adapter) {
            this.adapters.set(provider.id, adapter);
          }
        } catch (error: any) {
          console.warn(`[StorageRouter] Failed to init adapter for ${provider.name}: ${error.message}`);
        }
      }

      this.initialized = true;
      console.log(`[StorageRouter] Initialized with ${this.adapters.size} provider(s): ${[...this.adapters.values()].map(a => a.name).join(", ")}`);
    } catch (error: any) {
      console.error("[StorageRouter] Initialization failed:", error.message);
      // Ensure at least local adapter is available
      this.initialized = true;
    }
  }

  private async ensureLocalProvider(): Promise<void> {
    const existing = await prisma.storageProvider.findUnique({
      where: { name: "local" },
    });

    if (!existing) {
      await prisma.storageProvider.create({
        data: {
          name: "local",
          displayName: "Local Filesystem",
          type: "LOCAL",
          isEnabled: true,
          priority: 100, // Lowest preference — fallback
          capacityBytes: BigInt(50 * 1024 * 1024 * 1024), // 50GB
          config: { basePath: process.env.DOCUMENT_STORAGE_PATH || "./storage/documents" },
        },
      });
      console.log("[StorageRouter] Created LOCAL storage provider (fallback)");
    }
  }

  private createAdapter(provider: {
    id: string;
    name: string;
    type: StorageProviderType;
    credentials: any;
    config: any;
    capacityBytes: bigint;
  }): IStorageProvider | null {
    switch (provider.type) {
      case "LOCAL":
        return new LocalFilesystemAdapter({
          basePath: provider.config?.basePath,
          capacityBytes: Number(provider.capacityBytes),
        });

      case "S3": {
        const creds = provider.credentials as S3AdapterConfig | null;
        if (!creds?.endpoint || !creds?.accessKeyId || !creds?.secretAccessKey || !creds?.bucket) {
          console.warn(`[StorageRouter] S3 provider ${provider.name} missing credentials`);
          return null;
        }
        return new S3GenericAdapter(provider.name, {
          ...creds,
          capacityBytes: Number(provider.capacityBytes),
        });
      }

      case "PCLOUD": {
        const creds = provider.credentials as PCloudConfig | null;
        if (!creds?.accessToken || !creds?.locationId) {
          console.warn(`[StorageRouter] pCloud provider ${provider.name} missing credentials`);
          return null;
        }
        return new PCloudAdapter(creds);
      }

      default:
        console.warn(`[StorageRouter] Unknown provider type: ${provider.type}`);
        return null;
    }
  }

  // ============================================
  // CORE OPERATIONS
  // ============================================

  async upload(params: {
    caseId: string;
    fileName: string;
    data: Buffer;
    mimeType?: string;
    documentId?: string;
  }): Promise<RouterUploadResult> {
    await this.initialize();

    const sha256Hash = crypto.createHash("sha256").update(params.data).digest("hex");
    const fileSize = params.data.length;

    // Build provider path
    const timestamp = Date.now();
    const randHash = crypto.randomBytes(4).toString("hex");
    const providerPath = `${params.caseId}/${timestamp}_${randHash}_${params.fileName}`;

    // Pick best provider
    const provider = await this.selectProvider(fileSize);
    if (!provider) {
      return { success: false, error: "No storage providers available" };
    }

    const adapter = this.adapters.get(provider.id);
    if (!adapter) {
      return { success: false, error: `No adapter for provider ${provider.name}` };
    }

    // Upload to provider
    const result = await adapter.upload(providerPath, params.data, params.mimeType);
    if (!result.success) {
      // Try fallback to local
      const localProvider = await this.getLocalProvider();
      if (localProvider && localProvider.id !== provider.id) {
        const localAdapter = this.adapters.get(localProvider.id);
        if (localAdapter) {
          const fallbackResult = await localAdapter.upload(providerPath, params.data, params.mimeType);
          if (fallbackResult.success) {
            const registry = await this.createFileRegistry({
              documentId: params.documentId,
              providerId: localProvider.id,
              providerPath,
              fileName: params.fileName,
              fileSize,
              mimeType: params.mimeType,
              sha256Hash,
            });
            await this.updateProviderUsage(localProvider.id, fileSize);
            return { success: true, fileRegistryId: registry.id, providerId: localProvider.id, providerPath };
          }
        }
      }
      return { success: false, error: result.error || "Upload failed" };
    }

    // Create FileRegistry entry
    const registry = await this.createFileRegistry({
      documentId: params.documentId,
      providerId: provider.id,
      providerPath,
      fileName: params.fileName,
      fileSize,
      mimeType: params.mimeType,
      sha256Hash,
    });

    // Update provider usage
    await this.updateProviderUsage(provider.id, fileSize);

    return { success: true, fileRegistryId: registry.id, providerId: provider.id, providerPath };
  }

  async download(params: {
    documentId?: string;
    fileRegistryId?: string;
  }): Promise<RouterDownloadResult> {
    await this.initialize();

    let registry;

    if (params.fileRegistryId) {
      registry = await prisma.fileRegistry.findUnique({
        where: { id: params.fileRegistryId },
        include: { provider: true },
      });
    } else if (params.documentId) {
      registry = await prisma.fileRegistry.findFirst({
        where: { documentId: params.documentId },
        include: { provider: true },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!registry) {
      return { success: false, error: "File not found in registry" };
    }

    const adapter = this.adapters.get(registry.providerId);
    if (!adapter) {
      // Try to re-initialize the adapter
      const provider = await prisma.storageProvider.findUnique({
        where: { id: registry.providerId },
      });
      if (provider) {
        const newAdapter = this.createAdapter(provider);
        if (newAdapter) {
          this.adapters.set(provider.id, newAdapter);
          const result = await newAdapter.download(registry.providerPath);
          if (result.success) {
            await this.incrementAccessCount(registry.id);
            return { success: true, data: result.data, fileName: registry.fileName, mimeType: registry.mimeType || undefined };
          }
        }
      }
      return { success: false, error: `Provider ${registry.provider.name} not available` };
    }

    const result = await adapter.download(registry.providerPath);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    await this.incrementAccessCount(registry.id);
    return { success: true, data: result.data, fileName: registry.fileName, mimeType: registry.mimeType || undefined };
  }

  async deleteFile(fileRegistryId: string): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    const registry = await prisma.fileRegistry.findUnique({
      where: { id: fileRegistryId },
      include: { provider: true },
    });

    if (!registry) {
      return { success: false, error: "File not found in registry" };
    }

    const adapter = this.adapters.get(registry.providerId);
    if (adapter) {
      const result = await adapter.delete(registry.providerPath);
      if (!result.success) {
        console.warn(`[StorageRouter] Failed to delete from provider: ${result.error}`);
      }
    }

    // Delete all replicas
    if (!registry.replicaOf) {
      const replicas = await prisma.fileRegistry.findMany({
        where: { replicaOf: registry.id },
      });
      for (const replica of replicas) {
        const replicaAdapter = this.adapters.get(replica.providerId);
        if (replicaAdapter) {
          await replicaAdapter.delete(replica.providerPath);
        }
        await prisma.fileRegistry.delete({ where: { id: replica.id } });
      }
    }

    // Update provider usage
    await this.updateProviderUsage(registry.providerId, -Number(registry.fileSize));

    // Delete registry entry
    await prisma.fileRegistry.delete({ where: { id: fileRegistryId } });

    return { success: true };
  }

  async deleteByDocumentId(documentId: string): Promise<{ success: boolean; error?: string }> {
    const registries = await prisma.fileRegistry.findMany({
      where: { documentId },
    });

    for (const registry of registries) {
      await this.deleteFile(registry.id);
    }

    return { success: true };
  }

  // ============================================
  // MIGRATION & REPLICATION
  // ============================================

  async migrate(fileRegistryId: string, targetProviderId: string): Promise<{ success: boolean; newRegistryId?: string; error?: string }> {
    await this.initialize();

    const source = await prisma.fileRegistry.findUnique({
      where: { id: fileRegistryId },
      include: { provider: true },
    });

    if (!source) {
      return { success: false, error: "Source file not found" };
    }

    // Download from source
    const sourceAdapter = this.adapters.get(source.providerId);
    if (!sourceAdapter) {
      return { success: false, error: "Source provider not available" };
    }

    const downloadResult = await sourceAdapter.download(source.providerPath);
    if (!downloadResult.success || !downloadResult.data) {
      return { success: false, error: `Download failed: ${downloadResult.error}` };
    }

    // Upload to target
    const targetAdapter = this.adapters.get(targetProviderId);
    if (!targetAdapter) {
      return { success: false, error: "Target provider not available" };
    }

    const uploadResult = await targetAdapter.upload(source.providerPath, downloadResult.data, source.mimeType || undefined);
    if (!uploadResult.success) {
      return { success: false, error: `Upload to target failed: ${uploadResult.error}` };
    }

    // Update registry to point to new provider
    await prisma.fileRegistry.update({
      where: { id: fileRegistryId },
      data: { providerId: targetProviderId },
    });

    // Update usage counters
    await this.updateProviderUsage(source.providerId, -Number(source.fileSize));
    await this.updateProviderUsage(targetProviderId, Number(source.fileSize));

    // Delete from source
    await sourceAdapter.delete(source.providerPath);

    return { success: true, newRegistryId: fileRegistryId };
  }

  async replicate(fileRegistryId: string, targetProviderId: string): Promise<{ success: boolean; replicaId?: string; error?: string }> {
    await this.initialize();

    const source = await prisma.fileRegistry.findUnique({
      where: { id: fileRegistryId },
    });

    if (!source) {
      return { success: false, error: "Source file not found" };
    }

    const sourceAdapter = this.adapters.get(source.providerId);
    if (!sourceAdapter) {
      return { success: false, error: "Source provider not available" };
    }

    const downloadResult = await sourceAdapter.download(source.providerPath);
    if (!downloadResult.success || !downloadResult.data) {
      return { success: false, error: `Download failed: ${downloadResult.error}` };
    }

    const targetAdapter = this.adapters.get(targetProviderId);
    if (!targetAdapter) {
      return { success: false, error: "Target provider not available" };
    }

    const uploadResult = await targetAdapter.upload(source.providerPath, downloadResult.data, source.mimeType || undefined);
    if (!uploadResult.success) {
      return { success: false, error: `Replication upload failed: ${uploadResult.error}` };
    }

    // Create replica registry entry
    const replica = await prisma.fileRegistry.create({
      data: {
        documentId: source.documentId,
        providerId: targetProviderId,
        providerPath: source.providerPath,
        fileName: source.fileName,
        fileSize: source.fileSize,
        mimeType: source.mimeType,
        sha256Hash: source.sha256Hash,
        isReplicated: true,
        replicaOf: source.id,
      },
    });

    // Mark source as replicated
    await prisma.fileRegistry.update({
      where: { id: fileRegistryId },
      data: { isReplicated: true },
    });

    await this.updateProviderUsage(targetProviderId, Number(source.fileSize));

    return { success: true, replicaId: replica.id };
  }

  async bulkSync(sourceProviderId: string, targetProviderId: string): Promise<{
    success: boolean;
    migrated: number;
    failed: number;
    errors: string[];
  }> {
    const files = await prisma.fileRegistry.findMany({
      where: { providerId: sourceProviderId },
    });

    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const file of files) {
      const result = await this.migrate(file.id, targetProviderId);
      if (result.success) {
        migrated++;
      } else {
        failed++;
        errors.push(`${file.fileName}: ${result.error}`);
      }
    }

    return { success: failed === 0, migrated, failed, errors };
  }

  // ============================================
  // DASHBOARD & HEALTH
  // ============================================

  async getStorageDashboard(): Promise<ProviderDashboard> {
    await this.initialize();

    const providers = await prisma.storageProvider.findMany({
      orderBy: { priority: "asc" },
      include: {
        _count: { select: { files: true } },
      },
    });

    let totalUsed = BigInt(0);
    let totalCapacity = BigInt(0);
    let totalFiles = 0;

    const providerData = providers.map((p) => {
      totalUsed += p.usedBytes;
      totalCapacity += p.capacityBytes;
      totalFiles += p._count.files;

      return {
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        type: p.type,
        isEnabled: p.isEnabled,
        isHealthy: p.isHealthy,
        priority: p.priority,
        usedBytes: p.usedBytes.toString(),
        capacityBytes: p.capacityBytes.toString(),
        freeBytes: (p.capacityBytes - p.usedBytes > 0 ? p.capacityBytes - p.usedBytes : BigInt(0)).toString(),
        fileCount: p._count.files,
        lastHealthCheck: p.lastHealthCheck,
      };
    });

    return {
      providers: providerData,
      totalUsedBytes: totalUsed.toString(),
      totalCapacityBytes: totalCapacity.toString(),
      totalFiles,
    };
  }

  async refreshHealth(): Promise<void> {
    await this.initialize();

    const providers = await prisma.storageProvider.findMany({
      where: { isEnabled: true },
    });

    for (const provider of providers) {
      const adapter = this.adapters.get(provider.id);
      if (!adapter) continue;

      const healthResult = await adapter.healthCheck();

      await prisma.storageProvider.update({
        where: { id: provider.id },
        data: {
          isHealthy: healthResult.healthy,
          lastHealthCheck: new Date(),
        },
      });
    }
  }

  async testProvider(providerId: string): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const provider = await prisma.storageProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return { healthy: false, latencyMs: 0, error: "Provider not found" };
    }

    // Create temporary adapter to test
    const adapter = this.createAdapter(provider);
    if (!adapter) {
      return { healthy: false, latencyMs: 0, error: "Failed to create adapter — check credentials" };
    }

    const result = await adapter.healthCheck();

    // Update health status in DB
    await prisma.storageProvider.update({
      where: { id: providerId },
      data: {
        isHealthy: result.healthy,
        lastHealthCheck: new Date(),
      },
    });

    // If healthy, cache the adapter
    if (result.healthy && provider.isEnabled) {
      this.adapters.set(providerId, adapter);
    }

    return result;
  }

  // Reload adapters after config changes
  async reloadAdapters(): Promise<void> {
    this.adapters.clear();
    this.initialized = false;
    await this.initialize();
  }

  // ============================================
  // FILE BROWSING
  // ============================================

  async getFiles(params: {
    providerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    files: any[];
    total: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where = params.providerId ? { providerId: params.providerId } : {};

    const [files, total] = await Promise.all([
      prisma.fileRegistry.findMany({
        where,
        include: {
          provider: { select: { name: true, displayName: true, type: true } },
          document: { select: { id: true, type: true, status: true, caseId: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.fileRegistry.count({ where }),
    ]);

    return {
      files: files.map((f) => ({
        ...f,
        fileSize: f.fileSize.toString(),
      })),
      total,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async selectProvider(fileSize: number): Promise<{ id: string; name: string } | null> {
    const providers = await prisma.storageProvider.findMany({
      where: {
        isEnabled: true,
        isHealthy: true,
      },
      orderBy: { priority: "asc" },
    });

    for (const provider of providers) {
      const freeSpace = Number(provider.capacityBytes - provider.usedBytes);
      if (freeSpace >= fileSize && this.adapters.has(provider.id)) {
        return { id: provider.id, name: provider.name };
      }
    }

    // No provider with space — return null
    return null;
  }

  private async getLocalProvider() {
    return prisma.storageProvider.findUnique({
      where: { name: "local" },
    });
  }

  private async createFileRegistry(params: {
    documentId?: string;
    providerId: string;
    providerPath: string;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    sha256Hash: string;
  }) {
    return prisma.fileRegistry.create({
      data: {
        documentId: params.documentId || null,
        providerId: params.providerId,
        providerPath: params.providerPath,
        fileName: params.fileName,
        fileSize: BigInt(params.fileSize),
        mimeType: params.mimeType || null,
        sha256Hash: params.sha256Hash,
      },
    });
  }

  private async updateProviderUsage(providerId: string, byteDelta: number) {
    if (byteDelta === 0) return;

    if (byteDelta > 0) {
      await prisma.storageProvider.update({
        where: { id: providerId },
        data: { usedBytes: { increment: BigInt(byteDelta) } },
      });
    } else {
      // Decrement — ensure we don't go below 0
      const provider = await prisma.storageProvider.findUnique({ where: { id: providerId } });
      if (provider) {
        const newUsed = provider.usedBytes + BigInt(byteDelta);
        await prisma.storageProvider.update({
          where: { id: providerId },
          data: { usedBytes: newUsed < 0 ? BigInt(0) : newUsed },
        });
      }
    }
  }

  private async incrementAccessCount(registryId: string) {
    await prisma.fileRegistry.update({
      where: { id: registryId },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }
}

export const storageRouter = new StorageRouter();
