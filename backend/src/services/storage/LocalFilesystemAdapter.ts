// Local storage keys are untrusted. Lexical and link checks are preflight
// protection, not a kernel sandbox against a concurrent hostile host process.
import type { StorageProviderType } from "@prisma/client";
import * as fs from "fs/promises";
import { constants } from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import type { IStorageProvider, UploadResult, DownloadResult, DeleteResult, StorageUsage, HealthCheckResult, FileListItem } from "./IStorageProvider.js";

const DEFAULT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || path.join(process.cwd(), "storage", "documents");
const UNAVAILABLE = "Local storage operation is unavailable.";

export class LocalFilesystemAdapter implements IStorageProvider {
  name = "local";
  type: StorageProviderType = "LOCAL";
  private basePath: string;
  private capacityBytes: number;

  constructor(config?: { basePath?: string; capacityBytes?: number }) {
    this.basePath = path.resolve(config?.basePath || DEFAULT_STORAGE_PATH);
    this.capacityBytes = config?.capacityBytes ?? 50 * 1024 * 1024 * 1024;
    if (!Number.isSafeInteger(this.capacityBytes) || this.capacityBytes <= 0) throw new Error("Invalid local storage capacity.");
  }

  private keyPath(key: string, allowRoot = false): { fullPath: string; key: string } {
    if (typeof key !== "string" || key.length > 1024 || /[\x00-\x1f\x7f]/.test(key)
      || path.posix.isAbsolute(key) || path.win32.isAbsolute(key)
      || /%(?:2e|2f|5c|00|25)/i.test(key)) throw new Error(UNAVAILABLE);
    if (key === "" && allowRoot) return { fullPath: this.basePath, key: "" };
    const normalized = key.replace(/\\/g, "/");
    const pieces = (allowRoot ? normalized.replace(/\/+$/, "") : normalized).split("/");
    if (pieces.some(piece => !piece || piece === "." || piece === ".." || /[<>:\"|?*]/.test(piece)
      || /[. ]$/.test(piece) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(piece))) throw new Error(UNAVAILABLE);
    const fullPath = path.resolve(this.basePath, ...pieces);
    const relative = path.relative(this.basePath, fullPath);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(UNAVAILABLE);
    return { fullPath, key: pieces.join("/") };
  }

  // Check every ancestor, including the configured root's ancestors. mkdir is
  // deliberately non-recursive so an existing junction is never followed blindly.
  private async directory(directory: string, create = false): Promise<void> {
    const parsed = path.parse(directory);
    let current = parsed.root;
    const pieces = directory.slice(parsed.root.length).split(path.sep).filter(Boolean);
    const anchor = await fs.lstat(current);
    if (anchor.isSymbolicLink() || !anchor.isDirectory()) throw new Error(UNAVAILABLE);
    for (const piece of pieces) {
      current = path.join(current, piece);
      let stat;
      try { stat = await fs.lstat(current); }
      catch (error) {
        if (!create || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        try { await fs.mkdir(current); }
        catch (mkdirError) { if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST") throw mkdirError; }
        stat = await fs.lstat(current);
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(UNAVAILABLE);
    }
  }

  private async file(fullPath: string) {
    await this.directory(path.dirname(fullPath));
    const stat = await fs.lstat(fullPath);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink > 1) throw new Error(UNAVAILABLE);
    return stat;
  }

  async upload(key: string, data: Buffer, _mimeType?: string): Promise<UploadResult> {
    let temporary: string | undefined;
    try {
      const destination = this.keyPath(key);
      if (!Buffer.isBuffer(data)) throw new Error(UNAVAILABLE);
      await this.directory(path.dirname(destination.fullPath), true);
      try { await this.file(destination.fullPath); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      temporary = path.join(path.dirname(destination.fullPath), `.mgr-upload-${randomUUID()}`);
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(data); await handle.sync(); }
      finally { await handle.close(); }
      await this.directory(path.dirname(destination.fullPath));
      // Atomic replacement avoids truncated visible files and writing through a hard link.
      await fs.rename(temporary, destination.fullPath);
      temporary = undefined;
      return { success: true, url: `/api/documents/${destination.key.split("/").map(encodeURIComponent).join("/")}` };
    } catch { return { success: false, error: UNAVAILABLE }; }
    finally { if (temporary) { try { await fs.unlink(temporary); } catch { /* An owned staging file may remain for recovery. */ } } }
  }

  async download(key: string): Promise<DownloadResult> {
    try {
      const { fullPath } = this.keyPath(key);
      const before = await this.file(fullPath);
      const handle = await fs.open(fullPath, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink > 1 || opened.dev !== before.dev || opened.ino !== before.ino) throw new Error(UNAVAILABLE);
        return { success: true, data: await handle.readFile() };
      } finally { await handle.close(); }
    } catch { return { success: false, error: UNAVAILABLE }; }
  }

  async delete(key: string): Promise<DeleteResult> {
    try {
      const { fullPath } = this.keyPath(key);
      try { await this.file(fullPath); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { success: true }; throw error; }
      await fs.unlink(fullPath);
      return { success: true };
    } catch { return { success: false, error: UNAVAILABLE }; }
  }

  async exists(key: string): Promise<boolean> {
    try { await this.file(this.keyPath(key).fullPath); return true; }
    catch { return false; }
  }

  async list(prefix: string): Promise<FileListItem[]> {
    try {
      const parent = this.keyPath(prefix, true);
      await this.directory(parent.fullPath);
      const items: FileListItem[] = [];
      for (const entry of await fs.readdir(parent.fullPath, { withFileTypes: true })) {
        if (!entry.isFile() || entry.name.startsWith(".mgr-upload-") || entry.name.startsWith(".health-check-")) continue;
        const key = parent.key ? `${parent.key}/${entry.name}` : entry.name;
        const { fullPath } = this.keyPath(key);
        const stat = await this.file(fullPath);
        items.push({ path: key, size: stat.size, lastModified: stat.mtime });
      }
      return items;
    } catch { return []; }
  }

  async getUsage(): Promise<StorageUsage> {
    // A failed or linked traversal must not masquerade as an empty free vault.
    try {
      await this.directory(this.basePath);
      const usedBytes = await this.calculateDirectorySize(this.basePath);
      return { usedBytes, capacityBytes: this.capacityBytes, freeBytes: Math.max(0, this.capacityBytes - usedBytes) };
    } catch { throw new Error(UNAVAILABLE); }
  }

  private async calculateDirectorySize(directory: string, depth = 0): Promise<number> {
    if (depth > 128) throw new Error(UNAVAILABLE);
    await this.directory(directory);
    let size = 0;
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(UNAVAILABLE);
      if (entry.isDirectory()) size += await this.calculateDirectorySize(fullPath, depth + 1);
      else if (entry.isFile()) size += (await this.file(fullPath)).size;
      else throw new Error(UNAVAILABLE);
      if (!Number.isSafeInteger(size)) throw new Error(UNAVAILABLE);
    }
    return size;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now(); let owned: string | undefined;
    try {
      await this.directory(this.basePath, true);
      owned = path.join(this.basePath, `.health-check-${randomUUID()}`);
      const handle = await fs.open(owned, "wx", 0o600);
      try { await handle.writeFile("ok"); }
      finally { await handle.close(); }
      await this.directory(this.basePath);
      await fs.unlink(owned); owned = undefined;
      return { healthy: true, latencyMs: Date.now() - start };
    } catch { return { healthy: false, latencyMs: Date.now() - start, error: UNAVAILABLE }; }
    finally { if (owned) { try { await fs.unlink(owned); } catch { /* Owned probe cleanup could not be completed. */ } } }
  }
}
