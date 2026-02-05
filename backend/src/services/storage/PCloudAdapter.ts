// ============================================
// PCLOUD ADAPTER
// Custom adapter wrapping pCloud REST API
// Pre-built for future use — plug-in ready
// ============================================

import { StorageProviderType } from "@prisma/client";
import {
  IStorageProvider,
  UploadResult,
  DownloadResult,
  DeleteResult,
  StorageUsage,
  HealthCheckResult,
  FileListItem,
} from "./IStorageProvider.js";

export interface PCloudConfig {
  accessToken: string;
  locationId: "us" | "eu"; // US or EU datacenter
  baseFolderId?: number;   // Root folder ID for MGR files
}

export class PCloudAdapter implements IStorageProvider {
  name: string;
  type: StorageProviderType = "PCLOUD";
  private accessToken: string;
  private baseUrl: string;
  private baseFolderId: number;
  private folderCache: Map<string, number> = new Map();

  constructor(config: PCloudConfig) {
    this.name = "pcloud";
    this.accessToken = config.accessToken;
    this.baseUrl = config.locationId === "eu"
      ? "https://eapi.pcloud.com"
      : "https://api.pcloud.com";
    this.baseFolderId = config.baseFolderId || 0;
  }

  private async apiCall(endpoint: string, params: Record<string, any> = {}, method: "GET" | "POST" = "GET"): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);
    url.searchParams.set("access_token", this.accessToken);

    if (method === "GET") {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
      const response = await fetch(url.toString());
      return response.json();
    }

    // POST — used for file uploads
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return response.json();
  }

  private async ensureFolder(folderPath: string): Promise<number> {
    if (this.folderCache.has(folderPath)) {
      return this.folderCache.get(folderPath)!;
    }

    const parts = folderPath.split("/").filter(Boolean);
    let currentFolderId = this.baseFolderId;

    for (const part of parts) {
      const cacheKey = parts.slice(0, parts.indexOf(part) + 1).join("/");
      if (this.folderCache.has(cacheKey)) {
        currentFolderId = this.folderCache.get(cacheKey)!;
        continue;
      }

      // Try to create — will return existing if already exists
      const result = await this.apiCall("/createfolderifnotexists", {
        folderid: currentFolderId,
        name: part,
      });

      if (result.result !== 0) {
        throw new Error(`pCloud folder creation failed: ${result.error || "Unknown error"}`);
      }

      currentFolderId = result.metadata.folderid;
      this.folderCache.set(cacheKey, currentFolderId);
    }

    return currentFolderId;
  }

  async upload(filePath: string, data: Buffer, _mimeType?: string): Promise<UploadResult> {
    try {
      const dir = filePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
      const fileName = filePath.replace(/\\/g, "/").split("/").pop()!;
      const basePath = `mgr-capital/documents/${dir}`;
      const folderId = await this.ensureFolder(basePath);

      // Upload via multipart
      const url = new URL("/uploadfile", this.baseUrl);
      url.searchParams.set("access_token", this.accessToken);
      url.searchParams.set("folderid", String(folderId));
      url.searchParams.set("filename", fileName);
      url.searchParams.set("nopartial", "1");

      const formData = new FormData();
      formData.append("file", new Blob([data]), fileName);

      const response = await fetch(url.toString(), {
        method: "POST",
        body: formData,
      });
      const result: any = await response.json();

      if (result.result !== 0) {
        return { success: false, error: result.error || "pCloud upload failed" };
      }

      const fileId = result.metadata?.[0]?.fileid;
      return { success: true, url: `pcloud://${fileId}/${filePath}` };
    } catch (error: any) {
      console.error("[PCloud] Upload failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  async download(filePath: string): Promise<DownloadResult> {
    try {
      // Get file link from pCloud
      const normalizedPath = `/mgr-capital/documents/${filePath.replace(/\\/g, "/")}`;
      const linkResult = await this.apiCall("/getfilelink", { path: normalizedPath });

      if (linkResult.result !== 0) {
        return { success: false, error: linkResult.error || "pCloud getfilelink failed" };
      }

      const downloadUrl = `https://${linkResult.hosts[0]}${linkResult.path}`;
      const response = await fetch(downloadUrl);
      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      return { success: true, data };
    } catch (error: any) {
      console.error("[PCloud] Download failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  async delete(filePath: string): Promise<DeleteResult> {
    try {
      const normalizedPath = `/mgr-capital/documents/${filePath.replace(/\\/g, "/")}`;
      const result = await this.apiCall("/deletefile", { path: normalizedPath });

      if (result.result !== 0 && result.result !== 2009) {
        // 2009 = file not found (already deleted)
        return { success: false, error: result.error || "pCloud delete failed" };
      }

      return { success: true };
    } catch (error: any) {
      console.error("[PCloud] Delete failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const normalizedPath = `/mgr-capital/documents/${filePath.replace(/\\/g, "/")}`;
      const result = await this.apiCall("/stat", { path: normalizedPath });
      return result.result === 0;
    } catch {
      return false;
    }
  }

  async getUsage(): Promise<StorageUsage> {
    try {
      const result = await this.apiCall("/userinfo");
      if (result.result !== 0) {
        return { usedBytes: 0, capacityBytes: 0, freeBytes: 0 };
      }
      const usedBytes = result.usedquota || 0;
      const capacityBytes = result.quota || 0;
      return {
        usedBytes,
        capacityBytes,
        freeBytes: Math.max(0, capacityBytes - usedBytes),
      };
    } catch {
      return { usedBytes: 0, capacityBytes: 0, freeBytes: 0 };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await this.apiCall("/userinfo");
      if (result.result !== 0) {
        return { healthy: false, latencyMs: Date.now() - start, error: result.error };
      }
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (error: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: error.message };
    }
  }

  async list(prefix: string): Promise<FileListItem[]> {
    const items: FileListItem[] = [];
    try {
      const normalizedPath = `/mgr-capital/documents/${prefix.replace(/\\/g, "/")}`;
      const result = await this.apiCall("/listfolder", { path: normalizedPath });

      if (result.result !== 0 || !result.metadata?.contents) {
        return items;
      }

      for (const entry of result.metadata.contents) {
        if (!entry.isfolder) {
          items.push({
            path: `${prefix}/${entry.name}`,
            size: entry.size || 0,
            lastModified: new Date(entry.modified || Date.now()),
          });
        }
      }
    } catch {
      // Folder might not exist
    }
    return items;
  }
}
