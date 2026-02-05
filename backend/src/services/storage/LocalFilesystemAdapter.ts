// ============================================
// LOCAL FILESYSTEM ADAPTER
// Wraps current ./storage/documents/ behavior
// Always available as fallback (priority 100)
// ============================================

import { StorageProviderType } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";
import {
  IStorageProvider,
  UploadResult,
  DownloadResult,
  DeleteResult,
  StorageUsage,
  HealthCheckResult,
  FileListItem,
} from "./IStorageProvider.js";

const DEFAULT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH ||
  path.join(process.cwd(), "storage", "documents");

export class LocalFilesystemAdapter implements IStorageProvider {
  name: string;
  type: StorageProviderType = "LOCAL";
  private basePath: string;
  private capacityBytes: number;

  constructor(config?: { basePath?: string; capacityBytes?: number }) {
    this.name = "local";
    this.basePath = config?.basePath || DEFAULT_STORAGE_PATH;
    this.capacityBytes = config?.capacityBytes || 50 * 1024 * 1024 * 1024; // 50GB default
  }

  async upload(filePath: string, data: Buffer, _mimeType?: string): Promise<UploadResult> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, data);
      return { success: true, url: `/api/documents/${filePath}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async download(filePath: string): Promise<DownloadResult> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      const data = await fs.readFile(fullPath);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async delete(filePath: string): Promise<DeleteResult> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      await fs.unlink(fullPath);
      return { success: true };
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return { success: true }; // Already deleted
      }
      return { success: false, error: error.message };
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getUsage(): Promise<StorageUsage> {
    try {
      const usedBytes = await this.calculateDirectorySize(this.basePath);
      return {
        usedBytes,
        capacityBytes: this.capacityBytes,
        freeBytes: Math.max(0, this.capacityBytes - usedBytes),
      };
    } catch {
      return {
        usedBytes: 0,
        capacityBytes: this.capacityBytes,
        freeBytes: this.capacityBytes,
      };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Ensure base directory exists and is writable
      await fs.mkdir(this.basePath, { recursive: true });
      const testFile = path.join(this.basePath, `.health-check-${Date.now()}`);
      await fs.writeFile(testFile, "ok");
      await fs.unlink(testFile);
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (error: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: error.message };
    }
  }

  async list(prefix: string): Promise<FileListItem[]> {
    const items: FileListItem[] = [];
    try {
      const dirPath = path.join(this.basePath, prefix);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(prefix, entry.name);
          const stat = await fs.stat(path.join(this.basePath, filePath));
          items.push({
            path: filePath,
            size: stat.size,
            lastModified: stat.mtime,
          });
        }
      }
    } catch {
      // Directory might not exist
    }
    return items;
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
    return totalSize;
  }
}
