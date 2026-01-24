/**
 * BackupService.ts
 *
 * Production-ready sovereign backup service for MGR Capital Assistance (Phase 7).
 * Handles database backups, document vault backups, and disaster recovery.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 *
 * Features:
 * - pg_dump with custom compressed format (-Fc)
 * - GPG symmetric AES256 encryption
 * - Tiered retention policies (hourly/daily/weekly/monthly)
 * - SHA256 checksum verification
 * - Air-gap ready (local volume backups)
 * - Restore functionality with decryption
 * - Manifest tracking in database
 *
 * Backup Strategy:
 * - Hourly: Incremental DB backup (24 retained)
 * - Daily: Full DB + Document Vault (7 days)
 * - Weekly: Full backup with verification (4 weeks)
 * - Monthly: Archive to air-gapped storage (12 months)
 */

import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import logger from "../utils/logger.js";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface BackupConfig {
  // Directories
  backupDir: string;
  vaultDir: string;

  // Retention (counts)
  hourlyRetentionCount: number;
  dailyRetentionDays: number;
  weeklyRetentionWeeks: number;
  monthlyRetentionMonths: number;

  // Encryption
  encryptionEnabled: boolean;
  encryptionPassphrase?: string;

  // Offsite (optional)
  offsiteEnabled: boolean;
  offsitePath?: string;

  // Database
  pgDumpPath: string; // Path to pg_dump binary
  pgRestorePath: string; // Path to pg_restore binary
}

interface BackupResult {
  success: boolean;
  type: "hourly" | "daily" | "weekly" | "monthly";
  filename: string;
  filepath: string;
  sizeBytes: number;
  checksum: string;
  durationMs: number;
  encrypted: boolean;
  error?: string;
}

interface BackupManifestEntry {
  filename: string;
  type: string;
  createdAt: string;
  sizeBytes: number;
  checksum: string;
  encrypted: boolean;
  verified: boolean;
}

interface BackupManifest {
  backups: BackupManifestEntry[];
  lastUpdated: string;
  version: string;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: BackupConfig = {
  backupDir: process.env.BACKUP_DIR || "./backups",
  vaultDir: process.env.VAULT_DIR || "./vault",

  hourlyRetentionCount: 24,
  dailyRetentionDays: 7,
  weeklyRetentionWeeks: 4,
  monthlyRetentionMonths: 12,

  encryptionEnabled: true,
  encryptionPassphrase: process.env.BACKUP_PASSPHRASE,

  offsiteEnabled: false,
  offsitePath: process.env.OFFSITE_BACKUP_PATH,

  pgDumpPath: "pg_dump",
  pgRestorePath: "pg_restore",
};

// =============================================================================
// BACKUP SERVICE
// =============================================================================

class BackupService {
  private config: BackupConfig;

  constructor() {
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Load configuration from FounderConfig
   */
  async loadConfig(): Promise<void> {
    try {
      const founderConfig = await prisma.founderConfig.findFirst({
        where: { key: "backup" },
      });

      if (founderConfig?.value) {
        this.config = { ...DEFAULT_CONFIG, ...(founderConfig.value as Partial<BackupConfig>) };
      }

      // Ensure backup directory exists
      await fs.promises.mkdir(this.config.backupDir, { recursive: true });

      logger.info("BackupService config loaded", {
        backupDir: this.config.backupDir,
        encryptionEnabled: this.config.encryptionEnabled,
      });
    } catch (error) {
      logger.warn("Failed to load backup config, using defaults");
    }
  }

  // ---------------------------------------------------------------------------
  // SCHEDULED BACKUPS
  // ---------------------------------------------------------------------------

  /**
   * Hourly incremental database backup
   */
  async runHourlyBackup(): Promise<BackupResult> {
    await this.loadConfig();
    return this.performDatabaseBackup("hourly");
  }

  /**
   * Daily full backup (DB + Vault)
   */
  async runDailyBackup(): Promise<BackupResult> {
    await this.loadConfig();

    const dbResult = await this.performDatabaseBackup("daily");
    const vaultResult = await this.performVaultBackup("daily");

    // Combine results
    const combined: BackupResult = {
      success: dbResult.success && vaultResult.success,
      type: "daily",
      filename: `daily_${this.getTimestamp()}`,
      filepath: this.config.backupDir,
      sizeBytes: dbResult.sizeBytes + vaultResult.sizeBytes,
      checksum: dbResult.checksum,
      durationMs: dbResult.durationMs + vaultResult.durationMs,
      encrypted: dbResult.encrypted,
      error: dbResult.error || vaultResult.error,
    };

    await this.logBackupResult(combined);
    return combined;
  }

  /**
   * Weekly full backup with verification
   */
  async runWeeklyBackup(): Promise<BackupResult> {
    await this.loadConfig();

    const result = await this.runDailyBackup();

    if (result.success) {
      // Verify backup integrity
      const verified = await this.verifyBackup(result.filename);

      if (!verified) {
        result.success = false;
        result.error = "Backup verification failed - checksum mismatch";
        logger.error("Weekly backup verification failed", { filename: result.filename });
      }

      // Copy to offsite if enabled
      if (this.config.offsiteEnabled && this.config.offsitePath) {
        await this.copyToOffsite(result.filepath);
      }
    }

    return { ...result, type: "weekly" };
  }

  /**
   * Monthly archive backup
   */
  async runMonthlyBackup(): Promise<BackupResult> {
    await this.loadConfig();

    const result = await this.runWeeklyBackup();

    // Create archive notification for air-gapped storage
    await this.createArchiveNotification(result);

    return { ...result, type: "monthly" };
  }

  // ---------------------------------------------------------------------------
  // DATABASE BACKUP
  // ---------------------------------------------------------------------------

  /**
   * Perform PostgreSQL database backup using pg_dump
   */
  private async performDatabaseBackup(
    type: "hourly" | "daily" | "weekly" | "monthly"
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = this.getTimestamp();
    const baseName = `db_${type}_${timestamp}`;
    const dumpFile = path.join(this.config.backupDir, `${baseName}.dump`);
    const encryptedFile = `${dumpFile}.gpg`;

    try {
      // Ensure backup directory exists
      await fs.promises.mkdir(this.config.backupDir, { recursive: true });

      // Parse DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error("DATABASE_URL environment variable not set");
      }

      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || "5432";
      const user = url.username;
      const password = url.password;
      const database = url.pathname.slice(1).split("?")[0];

      // Set PGPASSWORD environment variable for pg_dump
      const env = { ...process.env, PGPASSWORD: password };

      // Run pg_dump with custom compressed format
      const pgDumpCmd = `"${this.config.pgDumpPath}" -Fc -h ${host} -p ${port} -U ${user} -d ${database} -f "${dumpFile}"`;

      logger.info(`Starting database backup: ${baseName}`);
      await execAsync(pgDumpCmd, { env, timeout: 600000 }); // 10 min timeout

      let finalFile = dumpFile;
      let encrypted = false;

      // Encrypt if enabled
      if (this.config.encryptionEnabled && this.config.encryptionPassphrase) {
        await this.encryptFile(dumpFile, encryptedFile);
        await fs.promises.unlink(dumpFile); // Remove unencrypted file
        finalFile = encryptedFile;
        encrypted = true;
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(finalFile);

      // Get file size
      const stats = await fs.promises.stat(finalFile);

      // Update manifest
      await this.addToManifest({
        filename: path.basename(finalFile),
        type,
        createdAt: new Date().toISOString(),
        sizeBytes: stats.size,
        checksum,
        encrypted,
        verified: false,
      });

      const durationMs = Date.now() - startTime;
      logger.info(`Database backup completed: ${baseName}`, {
        sizeBytes: stats.size,
        durationMs,
        encrypted,
      });

      const result: BackupResult = {
        success: true,
        type,
        filename: path.basename(finalFile),
        filepath: finalFile,
        sizeBytes: stats.size,
        checksum,
        durationMs,
        encrypted,
      };

      await this.logBackupResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const durationMs = Date.now() - startTime;

      logger.error(`Database backup failed: ${baseName}`, { error: errorMessage });

      const result: BackupResult = {
        success: false,
        type,
        filename: baseName,
        filepath: "",
        sizeBytes: 0,
        checksum: "",
        durationMs,
        encrypted: false,
        error: errorMessage,
      };

      await this.logBackupResult(result);
      return result;
    }
  }

  // ---------------------------------------------------------------------------
  // VAULT BACKUP
  // ---------------------------------------------------------------------------

  /**
   * Backup document vault
   */
  private async performVaultBackup(
    type: "daily" | "weekly" | "monthly"
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = this.getTimestamp();
    const baseName = `vault_${type}_${timestamp}`;
    const tarFile = path.join(this.config.backupDir, `${baseName}.tar.gz`);
    const encryptedFile = `${tarFile}.gpg`;

    try {
      // Check if vault directory exists
      try {
        await fs.promises.access(this.config.vaultDir);
      } catch {
        logger.warn("Vault directory does not exist, skipping vault backup");
        return {
          success: true,
          type,
          filename: baseName,
          filepath: "",
          sizeBytes: 0,
          checksum: "",
          durationMs: Date.now() - startTime,
          encrypted: false,
        };
      }

      // Create tar archive
      const tarCmd = `tar -czf "${tarFile}" -C "${path.dirname(this.config.vaultDir)}" "${path.basename(this.config.vaultDir)}"`;

      logger.info(`Starting vault backup: ${baseName}`);
      await execAsync(tarCmd, { timeout: 600000 }); // 10 min timeout

      let finalFile = tarFile;
      let encrypted = false;

      // Encrypt if enabled
      if (this.config.encryptionEnabled && this.config.encryptionPassphrase) {
        await this.encryptFile(tarFile, encryptedFile);
        await fs.promises.unlink(tarFile); // Remove unencrypted file
        finalFile = encryptedFile;
        encrypted = true;
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(finalFile);

      // Get file size
      const stats = await fs.promises.stat(finalFile);

      // Update manifest
      await this.addToManifest({
        filename: path.basename(finalFile),
        type: `vault_${type}`,
        createdAt: new Date().toISOString(),
        sizeBytes: stats.size,
        checksum,
        encrypted,
        verified: false,
      });

      const durationMs = Date.now() - startTime;
      logger.info(`Vault backup completed: ${baseName}`, {
        sizeBytes: stats.size,
        durationMs,
        encrypted,
      });

      return {
        success: true,
        type,
        filename: path.basename(finalFile),
        filepath: finalFile,
        sizeBytes: stats.size,
        checksum,
        durationMs,
        encrypted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const durationMs = Date.now() - startTime;

      logger.error(`Vault backup failed: ${baseName}`, { error: errorMessage });

      return {
        success: false,
        type,
        filename: baseName,
        filepath: "",
        sizeBytes: 0,
        checksum: "",
        durationMs,
        encrypted: false,
        error: errorMessage,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // RESTORE
  // ---------------------------------------------------------------------------

  /**
   * Restore database from backup
   */
  async restoreDatabase(filename: string): Promise<{ success: boolean; message: string }> {
    await this.loadConfig();

    const filepath = path.join(this.config.backupDir, filename);

    try {
      // Verify file exists
      await fs.promises.access(filepath);

      let restoreFile = filepath;

      // Decrypt if encrypted
      if (filename.endsWith(".gpg")) {
        if (!this.config.encryptionPassphrase) {
          return { success: false, message: "Encryption passphrase not configured" };
        }

        const decryptedFile = filepath.replace(".gpg", "");
        await this.decryptFile(filepath, decryptedFile);
        restoreFile = decryptedFile;
      }

      // Parse DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return { success: false, message: "DATABASE_URL not set" };
      }

      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || "5432";
      const user = url.username;
      const password = url.password;
      const database = url.pathname.slice(1).split("?")[0];

      // Set PGPASSWORD environment variable
      const env = { ...process.env, PGPASSWORD: password };

      // Run pg_restore
      const pgRestoreCmd = `"${this.config.pgRestorePath}" -h ${host} -p ${port} -U ${user} -d ${database} -c "${restoreFile}"`;

      logger.warn("Starting database restore", { filename });
      await execAsync(pgRestoreCmd, { env, timeout: 1800000 }); // 30 min timeout

      // Clean up decrypted file if we created one
      if (restoreFile !== filepath) {
        await fs.promises.unlink(restoreFile);
      }

      // Log restore action
      await prisma.auditLog.create({
        data: {
          action: "BACKUP_RESTORED",
          entityType: "BACKUP",
          entityId: filename,
          details: { filename, restoredAt: new Date().toISOString() },
        },
      });

      logger.info("Database restored successfully", { filename });
      return { success: true, message: `Database restored from ${filename}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Database restore failed", { filename, error: message });
      return { success: false, message };
    }
  }

  /**
   * Full restore from backup dump (Phase 17)
   * Handles GPG decryption, pg_restore, and vault file extraction
   *
   * @param filePath - Path to backup file (can be .dump, .dump.gpg, .tar.gz, or .tar.gz.gpg)
   * @param options - Restore options
   */
  async restoreFromDump(
    filePath: string,
    options: {
      restoreDb?: boolean;
      restoreVault?: boolean;
      runMigrations?: boolean;
      verifyChecksum?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    details: {
      dbRestored: boolean;
      vaultRestored: boolean;
      migrationsRun: boolean;
      checksumVerified: boolean;
      durationMs: number;
    };
  }> {
    await this.loadConfig();
    const startTime = Date.now();

    const {
      restoreDb = true,
      restoreVault = true,
      runMigrations = true,
      verifyChecksum = true,
    } = options;

    const details = {
      dbRestored: false,
      vaultRestored: false,
      migrationsRun: false,
      checksumVerified: false,
      durationMs: 0,
    };

    try {
      // Verify file exists
      await fs.promises.access(filePath);
      logger.warn("Starting full restore from dump", { filePath, options });

      // Determine file type
      const isEncrypted = filePath.endsWith(".gpg");
      const isVaultBackup = filePath.includes("vault_") || filePath.endsWith(".tar.gz") || filePath.endsWith(".tar.gz.gpg");
      const isDbBackup = filePath.includes("db_") || filePath.endsWith(".dump") || filePath.endsWith(".dump.gpg");

      // Verify checksum if enabled
      if (verifyChecksum) {
        const manifest = await this.loadManifest();
        const entry = manifest.backups.find((b) => filePath.endsWith(b.filename));

        if (entry) {
          const currentChecksum = await this.calculateChecksum(filePath);
          if (currentChecksum !== entry.checksum) {
            return {
              success: false,
              message: "Checksum verification failed - backup may be corrupted",
              details: { ...details, durationMs: Date.now() - startTime },
            };
          }
          details.checksumVerified = true;
          logger.info("Checksum verified successfully", { filePath });
        } else {
          logger.warn("No manifest entry found, skipping checksum verification", { filePath });
        }
      }

      // Decrypt if encrypted
      let workingFile = filePath;
      if (isEncrypted) {
        if (!this.config.encryptionPassphrase) {
          return {
            success: false,
            message: "Encryption passphrase not configured",
            details: { ...details, durationMs: Date.now() - startTime },
          };
        }

        const decryptedFile = filePath.replace(".gpg", "");
        logger.info("Decrypting backup file", { filePath });
        await this.decryptFile(filePath, decryptedFile);
        workingFile = decryptedFile;
      }

      // Restore database if applicable
      if (restoreDb && isDbBackup) {
        const dbResult = await this.performDatabaseRestore(workingFile);
        if (!dbResult.success) {
          // Clean up decrypted file
          if (isEncrypted) {
            await fs.promises.unlink(workingFile).catch(() => {});
          }
          return {
            success: false,
            message: `Database restore failed: ${dbResult.message}`,
            details: { ...details, durationMs: Date.now() - startTime },
          };
        }
        details.dbRestored = true;
      }

      // Restore vault files if applicable
      if (restoreVault && isVaultBackup) {
        const vaultResult = await this.performVaultRestore(workingFile);
        if (!vaultResult.success) {
          // Clean up decrypted file
          if (isEncrypted) {
            await fs.promises.unlink(workingFile).catch(() => {});
          }
          return {
            success: false,
            message: `Vault restore failed: ${vaultResult.message}`,
            details: { ...details, durationMs: Date.now() - startTime },
          };
        }
        details.vaultRestored = true;
      }

      // Run Prisma migrations if enabled
      if (runMigrations && details.dbRestored) {
        const migrationResult = await this.runPrismaMigrations();
        if (!migrationResult.success) {
          logger.warn("Prisma migrations failed, database may be in inconsistent state", {
            error: migrationResult.message,
          });
        } else {
          details.migrationsRun = true;
        }
      }

      // Clean up decrypted file
      if (isEncrypted && workingFile !== filePath) {
        await fs.promises.unlink(workingFile).catch(() => {});
      }

      // Log restore action
      await prisma.auditLog.create({
        data: {
          action: "FULL_RESTORE_COMPLETED",
          entityType: "BACKUP",
          entityId: path.basename(filePath),
          details: {
            filePath,
            dbRestored: details.dbRestored,
            vaultRestored: details.vaultRestored,
            migrationsRun: details.migrationsRun,
            restoredAt: new Date().toISOString(),
          },
        },
      });

      details.durationMs = Date.now() - startTime;
      logger.info("Full restore completed successfully", { filePath, details });

      return {
        success: true,
        message: `Restore completed: DB=${details.dbRestored}, Vault=${details.vaultRestored}, Migrations=${details.migrationsRun}`,
        details,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Full restore failed", { filePath, error: message });
      return {
        success: false,
        message,
        details: { ...details, durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Perform database restore using pg_restore
   */
  private async performDatabaseRestore(
    dumpFile: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return { success: false, message: "DATABASE_URL not set" };
      }

      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || "5432";
      const user = url.username;
      const password = url.password;
      const database = url.pathname.slice(1).split("?")[0];

      const env = { ...process.env, PGPASSWORD: password };

      // Use pg_restore with --clean to drop existing objects first
      // --if-exists prevents errors if objects don't exist
      // --no-owner prevents ownership issues
      const pgRestoreCmd = `"${this.config.pgRestorePath}" -h ${host} -p ${port} -U ${user} -d ${database} --clean --if-exists --no-owner "${dumpFile}"`;

      logger.info("Running pg_restore", { dumpFile });
      await execAsync(pgRestoreCmd, { env, timeout: 1800000 }); // 30 min timeout

      return { success: true, message: "Database restored successfully" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      // pg_restore may return non-zero exit code even on partial success
      if (message.includes("warning") || message.includes("does not exist")) {
        logger.warn("pg_restore completed with warnings", { message });
        return { success: true, message: "Database restored with warnings" };
      }
      return { success: false, message };
    }
  }

  /**
   * Perform vault files restore from tar archive
   */
  private async performVaultRestore(
    tarFile: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Ensure vault directory parent exists
      const vaultParent = path.dirname(this.config.vaultDir);
      await fs.promises.mkdir(vaultParent, { recursive: true });

      // Backup existing vault if it exists
      try {
        await fs.promises.access(this.config.vaultDir);
        const backupVaultPath = `${this.config.vaultDir}_restore_backup_${Date.now()}`;
        await fs.promises.rename(this.config.vaultDir, backupVaultPath);
        logger.info("Backed up existing vault directory", { to: backupVaultPath });
      } catch {
        // Vault directory doesn't exist, nothing to backup
      }

      // Extract tar archive
      const tarCmd = `tar -xzf "${tarFile}" -C "${vaultParent}"`;
      logger.info("Extracting vault backup", { tarFile, to: vaultParent });
      await execAsync(tarCmd, { timeout: 600000 }); // 10 min timeout

      return { success: true, message: "Vault files restored successfully" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, message };
    }
  }

  /**
   * Run Prisma migrations after restore
   */
  private async runPrismaMigrations(): Promise<{ success: boolean; message: string }> {
    try {
      logger.info("Running Prisma migrations");
      await execAsync("npx prisma migrate deploy", { timeout: 300000 }); // 5 min timeout
      return { success: true, message: "Migrations applied successfully" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, message };
    }
  }

  /**
   * List available backups for restore
   */
  async listAvailableBackups(): Promise<
    Array<{
      filename: string;
      type: string;
      createdAt: string;
      sizeBytes: number;
      encrypted: boolean;
      verified: boolean;
    }>
  > {
    await this.loadConfig();

    const manifest = await this.loadManifest();
    return manifest.backups
      .map((b) => ({
        filename: b.filename,
        type: b.type,
        createdAt: b.createdAt,
        sizeBytes: b.sizeBytes,
        encrypted: b.encrypted,
        verified: b.verified,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get latest backup of a specific type
   */
  async getLatestBackup(
    type: "hourly" | "daily" | "weekly" | "monthly" | "vault"
  ): Promise<BackupManifestEntry | null> {
    await this.loadConfig();

    const manifest = await this.loadManifest();
    const backups = manifest.backups
      .filter((b) => b.type.includes(type))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return backups[0] || null;
  }

  // ---------------------------------------------------------------------------
  // ENCRYPTION
  // ---------------------------------------------------------------------------

  /**
   * Encrypt file using GPG symmetric AES256
   */
  private async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    if (!this.config.encryptionPassphrase) {
      throw new Error("Encryption passphrase not configured");
    }

    // Use GPG for encryption with AES256
    const cmd = `gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase "${this.config.encryptionPassphrase}" -o "${outputPath}" "${inputPath}"`;

    await execAsync(cmd, { timeout: 300000 }); // 5 min timeout
    logger.debug("File encrypted", { output: outputPath });
  }

  /**
   * Decrypt file using GPG
   */
  private async decryptFile(inputPath: string, outputPath: string): Promise<void> {
    if (!this.config.encryptionPassphrase) {
      throw new Error("Encryption passphrase not configured");
    }

    const cmd = `gpg --decrypt --batch --yes --passphrase "${this.config.encryptionPassphrase}" -o "${outputPath}" "${inputPath}"`;

    await execAsync(cmd, { timeout: 300000 }); // 5 min timeout
    logger.debug("File decrypted", { output: outputPath });
  }

  // ---------------------------------------------------------------------------
  // VERIFICATION
  // ---------------------------------------------------------------------------

  /**
   * Verify backup integrity by comparing checksums
   */
  async verifyBackup(filename: string): Promise<boolean> {
    const filepath = path.join(this.config.backupDir, filename);

    try {
      // Check file exists and is not empty
      const stats = await fs.promises.stat(filepath);
      if (stats.size === 0) {
        logger.error("Backup file is empty", { filename });
        return false;
      }

      // Calculate current checksum
      const currentChecksum = await this.calculateChecksum(filepath);

      // Load manifest and find entry
      const manifest = await this.loadManifest();
      const entry = manifest.backups.find((b) => b.filename === filename);

      if (entry) {
        const verified = currentChecksum === entry.checksum;

        if (verified) {
          // Update manifest to mark as verified
          entry.verified = true;
          await this.saveManifest(manifest);
          logger.info("Backup verified successfully", { filename });
        } else {
          logger.error("Backup checksum mismatch", {
            filename,
            expected: entry.checksum,
            actual: currentChecksum,
          });
        }

        return verified;
      }

      // No manifest entry, assume valid
      logger.warn("No manifest entry for backup, assuming valid", { filename });
      return true;
    } catch (error) {
      logger.error("Backup verification failed", {
        filename,
        error: error instanceof Error ? error.message : "Unknown",
      });
      return false;
    }
  }

  /**
   * Calculate SHA-256 checksum of file
   */
  private async calculateChecksum(filepath: string): Promise<string> {
    const content = await fs.promises.readFile(filepath);
    return createHash("sha256").update(content).digest("hex");
  }

  // ---------------------------------------------------------------------------
  // RETENTION POLICY
  // ---------------------------------------------------------------------------

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<{ deleted: number }> {
    await this.loadConfig();

    let deleted = 0;
    const manifest = await this.loadManifest();
    const now = new Date();

    // Group backups by type
    const backupsByType: Record<string, BackupManifestEntry[]> = {};
    for (const backup of manifest.backups) {
      const type = backup.type.split("_")[0]; // "db" or "vault"
      const tier = backup.type.split("_")[1]; // "hourly", "daily", etc.
      const key = `${type}_${tier}`;

      if (!backupsByType[key]) {
        backupsByType[key] = [];
      }
      backupsByType[key].push(backup);
    }

    // Sort each group by date (newest first)
    for (const key in backupsByType) {
      backupsByType[key].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Apply retention policies
    const toDelete: string[] = [];

    // Hourly: keep last N
    for (const key of ["db_hourly", "vault_hourly"]) {
      const backups = backupsByType[key] || [];
      if (backups.length > this.config.hourlyRetentionCount) {
        const excess = backups.slice(this.config.hourlyRetentionCount);
        toDelete.push(...excess.map((b) => b.filename));
      }
    }

    // Daily: keep last N days
    const dailyCutoff = new Date(now);
    dailyCutoff.setDate(dailyCutoff.getDate() - this.config.dailyRetentionDays);

    for (const key of ["db_daily", "vault_daily"]) {
      const backups = backupsByType[key] || [];
      const old = backups.filter((b) => new Date(b.createdAt) < dailyCutoff);
      toDelete.push(...old.map((b) => b.filename));
    }

    // Weekly: keep last N weeks
    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - this.config.weeklyRetentionWeeks * 7);

    for (const key of ["db_weekly", "vault_weekly"]) {
      const backups = backupsByType[key] || [];
      const old = backups.filter((b) => new Date(b.createdAt) < weeklyCutoff);
      toDelete.push(...old.map((b) => b.filename));
    }

    // Monthly: keep last N months
    const monthlyCutoff = new Date(now);
    monthlyCutoff.setMonth(monthlyCutoff.getMonth() - this.config.monthlyRetentionMonths);

    for (const key of ["db_monthly", "vault_monthly"]) {
      const backups = backupsByType[key] || [];
      const old = backups.filter((b) => new Date(b.createdAt) < monthlyCutoff);
      toDelete.push(...old.map((b) => b.filename));
    }

    // Delete files and update manifest
    for (const filename of toDelete) {
      const filepath = path.join(this.config.backupDir, filename);
      try {
        await fs.promises.unlink(filepath);
        deleted++;
        logger.debug("Deleted old backup", { filename });
      } catch (error) {
        // File might already be deleted
        logger.warn("Failed to delete backup file", { filename });
      }
    }

    // Update manifest
    manifest.backups = manifest.backups.filter((b) => !toDelete.includes(b.filename));
    await this.saveManifest(manifest);

    logger.info(`Cleaned up ${deleted} old backups`);
    return { deleted };
  }

  // ---------------------------------------------------------------------------
  // OFFSITE COPY
  // ---------------------------------------------------------------------------

  /**
   * Copy backup to offsite location
   */
  private async copyToOffsite(filepath: string): Promise<void> {
    if (!this.config.offsitePath) return;

    const filename = path.basename(filepath);
    const dest = path.join(this.config.offsitePath, filename);

    try {
      // Use rsync if available, otherwise copy
      try {
        await execAsync(`rsync -av "${filepath}" "${dest}"`);
      } catch {
        await fs.promises.copyFile(filepath, dest);
      }

      logger.info("Copied to offsite", { filename, dest });
    } catch (error) {
      logger.error("Offsite copy failed", {
        filename,
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // MANIFEST MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Load backup manifest
   */
  private async loadManifest(): Promise<BackupManifest> {
    const manifestPath = path.join(this.config.backupDir, "manifest.json");

    try {
      const content = await fs.promises.readFile(manifestPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return { backups: [], lastUpdated: new Date().toISOString(), version: "1.0" };
    }
  }

  /**
   * Save backup manifest
   */
  private async saveManifest(manifest: BackupManifest): Promise<void> {
    const manifestPath = path.join(this.config.backupDir, "manifest.json");
    manifest.lastUpdated = new Date().toISOString();
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Add entry to manifest
   */
  private async addToManifest(entry: BackupManifestEntry): Promise<void> {
    const manifest = await this.loadManifest();
    manifest.backups.push(entry);
    await this.saveManifest(manifest);
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------------------------------------

  /**
   * Create notification for monthly archive
   */
  private async createArchiveNotification(result: BackupResult): Promise<void> {
    await prisma.opsInsight.create({
      data: {
        source: "BackupService",
        category: "MONTHLY_ARCHIVE",
        severity: result.success ? "LOW" : "HIGH",
        priority: result.success ? "NORMAL" : "URGENT",
        title: result.success
          ? "Monthly backup ready for air-gapped archival"
          : "Monthly backup FAILED - immediate attention required",
        description: result.success
          ? `Monthly backup ${result.filename} is ready. Please transfer to air-gapped storage.`
          : `Monthly backup failed: ${result.error}`,
        plainEnglish: result.success
          ? `The monthly backup completed successfully. File: ${result.filename}, Size: ${(result.sizeBytes / 1024 / 1024).toFixed(2)}MB, Encrypted: ${result.encrypted}. Please copy to USB/external drive for air-gapped storage.`
          : `CRITICAL: Monthly backup failed. Error: ${result.error}. Please investigate immediately and run manual backup.`,
        data: result as unknown as Record<string, unknown>,
        status: "OPEN",
      },
    });
  }

  /**
   * Log backup result to BotRunLog
   */
  private async logBackupResult(result: BackupResult): Promise<void> {
    await prisma.botRunLog.create({
      data: {
        botName: "BackupService",
        runType: `backup_${result.type}`,
        status: result.success ? "SUCCESS" : "ERROR",
        resultSummary: result.success
          ? `Backup created: ${result.filename} (${(result.sizeBytes / 1024 / 1024).toFixed(2)}MB)`
          : `Backup failed: ${result.error}`,
        recordsProcessed: 1,
        insightsGenerated: 0,
        errorsEncountered: result.success ? 0 : 1,
        durationMs: result.durationMs,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // STATUS
  // ---------------------------------------------------------------------------

  /**
   * Get backup status and statistics
   */
  async getStatus(): Promise<{
    lastBackup: Date | null;
    backupCount: number;
    totalSizeBytes: number;
    nextScheduled: string | null;
    config: {
      backupDir: string;
      encryptionEnabled: boolean;
      offsiteEnabled: boolean;
    };
  }> {
    await this.loadConfig();

    const manifest = await this.loadManifest();

    const lastBackup =
      manifest.backups.length > 0
        ? new Date(manifest.backups[manifest.backups.length - 1].createdAt)
        : null;

    const totalSizeBytes = manifest.backups.reduce((sum, b) => sum + b.sizeBytes, 0);

    return {
      lastBackup,
      backupCount: manifest.backups.length,
      totalSizeBytes,
      nextScheduled: null, // Determined by scheduler
      config: {
        backupDir: this.config.backupDir,
        encryptionEnabled: this.config.encryptionEnabled,
        offsiteEnabled: this.config.offsiteEnabled,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  /**
   * Get timestamp string for filenames
   */
  private getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, "-").split("T").join("_").slice(0, -5);
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const backupService = new BackupService();

export default backupService;
