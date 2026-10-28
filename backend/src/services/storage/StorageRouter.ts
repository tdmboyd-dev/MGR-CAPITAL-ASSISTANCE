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
      this.initialized = false;
      throw new Error("Storage initialization unavailable");
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
        // Merge config defaults (endpoint, region) into credentials
        const rawCreds = provider.credentials || {};
        const configDefaults = provider.config || {};
        const creds = { ...configDefaults, ...rawCreds } as S3AdapterConfig;
        if (!creds?.endpoint || !creds?.accessKeyId || !creds?.secretAccessKey || !creds?.bucket) {
          console.warn(`[StorageRouter] S3 provider ${provider.name} missing credentials — need endpoint, accessKeyId, secretAccessKey, bucket`);
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

    // Persist the exact target and reserve usage BEFORE dispatching any write.
    const registry = await prisma.$transaction(async (db) => {
      const saved=await db.fileRegistry.create({data:{documentId:params.documentId || null,providerId:provider.id,
        providerPath,fileName:params.fileName,fileSize:BigInt(fileSize),mimeType:params.mimeType,sha256Hash,lifecycle:"UPLOAD_PENDING"}});
      await db.storageProvider.update({where:{id:provider.id},data:{usedBytes:{increment:BigInt(fileSize)}}});
      return saved;
    });
    try {
      const uploaded=await adapter.upload(providerPath,params.data,params.mimeType);
      if(!uploaded.success)throw Error("Storage write unconfirmed");
      const reconciled=await this.reconcileUpload(registry.id);
      if(!reconciled.success)throw Error("Stored bytes not verified");
      return {success:true,fileRegistryId:registry.id,providerId:provider.id,providerPath};
    } catch {
      await prisma.fileRegistry.update({where:{id:registry.id},data:{lifecycle:"UPLOAD_FAILED",lastError:"Upload outcome requires readback reconciliation"}});
      return {success:false,fileRegistryId:registry.id,providerId:provider.id,providerPath,error:"Upload unconfirmed; target retained for reconciliation"};
    }
  }

  private async registryAdapter(registry: {providerId:string}) {
    const provider=await prisma.storageProvider.findUnique({where:{id:registry.providerId}});
    if(!provider?.isEnabled)return null;
    const cached=this.adapters.get(provider.id);
    if(cached)return cached;
    const adapter=this.createAdapter(provider);
    if(adapter)this.adapters.set(provider.id,adapter);
    return adapter;
  }
  private verifiedBytes(registry: {fileSize:bigint;sha256Hash:string}, data?:Buffer): data is Buffer {
    return !!data && BigInt(data.length)===registry.fileSize && crypto.createHash("sha256").update(data).digest("hex")===registry.sha256Hash;
  }
  async reconcileUpload(id:string):Promise<{success:boolean;error?:string}> {
    await this.initialize();
    const row=await prisma.fileRegistry.findUnique({where:{id}});
    if(!row || row.lifecycle.startsWith("DELETE"))return {success:false,error:"Upload reconciliation unavailable"};
    const adapter=await this.registryAdapter(row);
    if(!adapter)return {success:false,error:"Provider unavailable"};
    const read=await adapter.download(row.providerPath);
    if(!read.success || !this.verifiedBytes(row,read.data))return {success:false,error:"Stored bytes could not be verified"};
    await prisma.fileRegistry.update({where:{id:row.id},data:{lifecycle:"READY",lastError:null}});
    return {success:true};
  }
  async download(params:{documentId?:string;fileRegistryId?:string}):Promise<RouterDownloadResult> {
    if(!params.fileRegistryId && !params.documentId)return {success:false,error:"File identity required"};
    await this.initialize();
    const row=params.fileRegistryId?await prisma.fileRegistry.findUnique({where:{id:params.fileRegistryId}}):await prisma.fileRegistry.findFirst({where:{documentId:params.documentId,lifecycle:"READY"},orderBy:{createdAt:"desc"}});
    if(!row || row.lifecycle!=="READY")return {success:false,error:"Registered file is not ready"};
    const adapter=await this.registryAdapter(row);
    if(!adapter)return {success:false,error:"Provider unavailable"};
    const result=await adapter.download(row.providerPath);
    if(!result.success || !this.verifiedBytes(row,result.data))return {success:false,error:"Stored file integrity could not be verified"};
    await this.incrementAccessCount(row.id);
    return {success:true,data:result.data,fileName:row.fileName,mimeType:row.mimeType || undefined};
  }
  async deleteFile(id:string):Promise<{success:boolean;error?:string}> {
    await this.initialize();
    const row=await prisma.fileRegistry.findUnique({where:{id}});
    if(!row)return {success:true}; // Retry after a committed deletion is idempotent.
    await prisma.fileRegistry.update({where:{id},data:{lifecycle:"DELETE_PENDING",lastError:null}});
    try {
      const replicas=await prisma.fileRegistry.findMany({where:{replicaOf:id}});
      for(const replica of replicas){const result=await this.deleteFile(replica.id);if(!result.success)throw Error("Replica delete unconfirmed");}
      const adapter=await this.registryAdapter(row);
      if(!adapter)throw Error("Provider unavailable");
      if(!(await adapter.delete(row.providerPath)).success)throw Error("Provider delete unconfirmed");
      await prisma.$transaction(async(db)=>{
        const removed=await db.fileRegistry.deleteMany({where:{id}});
        if(removed.count===1)await db.$executeRaw`UPDATE "StorageProvider" SET "usedBytes"=GREATEST(0,"usedBytes"-${row.fileSize}),"updatedAt"=NOW() WHERE id=${row.providerId}`;
      });
      return {success:true};
    } catch {
      // Preserve the exact location and reservation until a later explicit retry.
      await prisma.fileRegistry.updateMany({where:{id},data:{lifecycle:"DELETE_FAILED",lastError:"Delete outcome requires reconciliation"}});
      return {success:false,error:"Storage delete unconfirmed; registry retained for retry"};
    }
  }
  async deleteByDocumentId(documentId:string):Promise<{success:boolean;error?:string}> {
    const rows=await prisma.fileRegistry.findMany({where:{documentId},orderBy:{createdAt:"asc"}});
    for(const row of rows){const result=await this.deleteFile(row.id);if(!result.success)return result;}
    return {success:true};
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
