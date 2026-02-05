// ============================================
// STORAGE PROVIDER INTERFACE
// Common contract for all storage adapters
// ============================================

import { StorageProviderType } from "@prisma/client";

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface StorageUsage {
  usedBytes: number;
  capacityBytes: number;
  freeBytes: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

export interface FileListItem {
  path: string;
  size: number;
  lastModified: Date;
}

export interface IStorageProvider {
  name: string;
  type: StorageProviderType;

  // Core operations
  upload(path: string, data: Buffer, mimeType?: string): Promise<UploadResult>;
  download(path: string): Promise<DownloadResult>;
  delete(path: string): Promise<DeleteResult>;
  exists(path: string): Promise<boolean>;

  // Info
  getUsage(): Promise<StorageUsage>;
  healthCheck(): Promise<HealthCheckResult>;

  // Optional
  getSignedUrl?(path: string, expiresInSeconds?: number): Promise<string>;
  list?(prefix: string): Promise<FileListItem[]>;
}
