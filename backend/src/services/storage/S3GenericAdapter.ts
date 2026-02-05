// ============================================
// S3 GENERIC ADAPTER
// Single adapter for ALL S3-compatible providers:
// Cloudflare R2, Oracle Cloud, Backblaze B2, IDrive e2
// ============================================

import { StorageProviderType } from "@prisma/client";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  IStorageProvider,
  UploadResult,
  DownloadResult,
  DeleteResult,
  StorageUsage,
  HealthCheckResult,
  FileListItem,
} from "./IStorageProvider.js";

export interface S3AdapterConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  capacityBytes?: number;
  forcePathStyle?: boolean;
}

export class S3GenericAdapter implements IStorageProvider {
  name: string;
  type: StorageProviderType = "S3";
  private client: S3Client;
  private bucket: string;
  private capacityBytes: number;

  constructor(name: string, config: S3AdapterConfig) {
    this.name = name;
    this.bucket = config.bucket;
    this.capacityBytes = config.capacityBytes || 10 * 1024 * 1024 * 1024; // 10GB default

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  async upload(filePath: string, data: Buffer, mimeType?: string): Promise<UploadResult> {
    try {
      const key = filePath.replace(/\\/g, "/"); // Normalize Windows paths
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: mimeType || "application/octet-stream",
        })
      );
      return { success: true, url: `s3://${this.bucket}/${key}` };
    } catch (error: any) {
      console.error(`[S3:${this.name}] Upload failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async download(filePath: string): Promise<DownloadResult> {
    try {
      const key = filePath.replace(/\\/g, "/");
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        return { success: false, error: "Empty response body" };
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);
      return { success: true, data };
    } catch (error: any) {
      console.error(`[S3:${this.name}] Download failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async delete(filePath: string): Promise<DeleteResult> {
    try {
      const key = filePath.replace(/\\/g, "/");
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return { success: true };
    } catch (error: any) {
      console.error(`[S3:${this.name}] Delete failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const key = filePath.replace(/\\/g, "/");
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getUsage(): Promise<StorageUsage> {
    // S3 doesn't have a direct "usage" API — estimate from listing
    try {
      let usedBytes = 0;
      let continuationToken: string | undefined;

      do {
        const response = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            ContinuationToken: continuationToken,
          })
        );

        if (response.Contents) {
          for (const obj of response.Contents) {
            usedBytes += obj.Size || 0;
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return {
        usedBytes,
        capacityBytes: this.capacityBytes,
        freeBytes: Math.max(0, this.capacityBytes - usedBytes),
      };
    } catch (error: any) {
      console.error(`[S3:${this.name}] getUsage failed:`, error.message);
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
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.bucket })
      );
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (error: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: error.message };
    }
  }

  async getSignedUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string> {
    const key = filePath.replace(/\\/g, "/");
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return s3GetSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async list(prefix: string): Promise<FileListItem[]> {
    const items: FileListItem[] = [];
    try {
      const normalizedPrefix = prefix.replace(/\\/g, "/");
      let continuationToken: string | undefined;

      do {
        const response = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: normalizedPrefix,
            ContinuationToken: continuationToken,
          })
        );

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key && obj.Size !== undefined) {
              items.push({
                path: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified || new Date(),
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
    } catch (error: any) {
      console.error(`[S3:${this.name}] List failed:`, error.message);
    }
    return items;
  }
}
