Claude — **ACTIVE ARCHITECT MODE** — response locked in.

**Phase 6 is officially COMPLETE and battle-tested.** Your implementation is thorough, production-oriented, and perfectly aligned with sovereign principles (heuristic-only, DB-driven configurability, audit trails via BotRunLog/ParserVersion, no external deps). The enriched models (`normalizedData`, `contentHash`, `predictionConfidence`, etc.) and batch stats make future analytics and ML-lite extensions trivial. Great job on the route explosion — 20+ intelligent endpoints give founder full control without CLI hacks.

Phase 7 skeletons are solid foundations. Now we push to **full hardening & deploy-readiness** as the highest-priority path. This gets us to a point where:

- The system runs autonomously (scheduled bots + backups)
- Data survives disasters (encrypted, retained, verifiable)
- Founder gets actionable reports without manual queries
- We can safely start frontend (knowing backend is resilient)

**Directive: Complete Phase 7 Core Components (Full Implementation)**

Focus on these four pillars in order (do them sequentially in your next build cycle):

1. **Scheduler Finalization & Activation** (highest immediate ROI — enables everything else automated)
2. **BackupService Full Production Implementation** (sovereign DR cornerstone)
3. **ReportingService Concrete Exports** (founder visibility)
4. **Zod Validation Layer** (security + robustness gatekeeper for Phase 6 & 7)

After these, we'll pivot to **security hardening** (encryption-at-rest, JWT refresh, air-gap simulation) before frontend.

### 1. Scheduler.ts — Production-Ready (Implement Now)

Use `node-cron` with robust wrappers. Install if not already:

```bash
npm install node-cron
```

- Add **structured logging** (assume you have a `utils/logger.ts` with winston/pino or console structured).
- Wrap every task in try/catch → log duration + error → create `WatchAlert` on failure (severity CRITICAL if bot-related).
- Support **timezone** from `FounderConfig` (default 'America/Chicago').
- Add **graceful shutdown**: on SIGTERM/SIGINT, stop all jobs.
- Make schedules configurable via FounderConfig (e.g., enable/disable daily digest, custom cron strings for high-volume).

Example refined structure (expand your existing):

```ts
// backend/src/cron/scheduler.ts
import cron from 'node-cron';
import { prisma } from '../config/prisma';
import logger from '../utils/logger'; // structured logger
import * as bots from '../bots'; // import all bots
import { backupService } from '../services/BackupService';
import { reportingService } from '../services/ReportingService';

interface CronJob {
  name: string;
  cronExpression: string;
  task: () => Promise<void>;
  enabledByDefault: boolean;
}

const jobs: CronJob[] = [
  {
    name: 'Daily Coordinator Summary',
    cronExpression: '0 5 * * *',
    task: () => bots.coordinatorBot.runDailySummary(),
    enabledByDefault: true,
  },
  {
    name: 'Hourly Ingestion Intelligence',
    cronExpression: '0 * * * *',
    task: () => bots.ingestionBot.runIntelligenceAnalysis(),
    enabledByDefault: true,
  },
  // Add all 7 bots...
  {
    name: 'Daily Backup',
    cronExpression: '0 2 * * *',
    task: () => backupService.performDailyBackup(),
    enabledByDefault: true,
  },
  {
    name: 'Daily Report Digest',
    cronExpression: '30 6 * * *',
    task: () => reportingService.generateDailyDigestAndNotify(),
    enabledByDefault: false, // founder enables via config
  },
  // Add maintenance: cleanup old BotRunLog, OpsInsight archive, etc.
];

let scheduledTasks: cron.Task[] = [];

export async function startScheduler() {
  const config = await prisma.founderConfig.findFirst(); // or cache
  const tz = config?.system?.timezone || 'America/Chicago';

  scheduledTasks = jobs.map(job => {
    const isEnabled = config?.cron?.[job.name]?.enabled ?? job.enabledByDefault;
    if (!isEnabled) {
      logger.info(`Cron job disabled: ${job.name}`);
      return null;
    }

    return cron.schedule(job.cronExpression, async () => {
      const start = Date.now();
      try {
        logger.info(`Starting cron: ${job.name}`);
        await job.task();
        const durationMs = Date.now() - start;
        logger.info(`Completed cron: ${job.name} (${durationMs}ms)`);
        // Optional: update BotRunLog
      } catch (error) {
        const durationMs = Date.now() - start;
        logger.error(`Cron failed: ${job.name} (${durationMs}ms)`, { error: error.message, stack: error.stack });
        // Create WatchAlert CRITICAL
        await prisma.watchAlert.create({
          data: {
            type: 'SYSTEM_HEALTH',
            severity: 'CRITICAL',
            message: `Cron job failure: ${job.name}`,
            details: { error: error.message },
          },
        });
      }
    }, { timezone: tz });
  }).filter(Boolean) as cron.Task[];

  logger.info(`Scheduler active: ${scheduledTasks.length} jobs running`);
}

export function stopScheduler() {
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  logger.info('Scheduler stopped');
}

// In server.ts (or dedicated entry)
process.on('SIGTERM', () => {
  stopScheduler();
  process.exit(0);
});
process.on('SIGINT', () => {
  stopScheduler();
  process.exit(0);
});

startScheduler();
```

### 2. BackupService — Full Sovereign Implementation

From best practices (pg_dump in Docker, encryption, retention):

- Use **pg_dump -Fc** (custom compressed format) → faster restore.
- Encrypt with **GPG symmetric AES256** — passphrase from **FounderConfig.encrypted.backupPassphrase** (store encrypted via Prisma field or env + manual setup).
- For air-gap: backups to mounted volume; founder exports via USB.
- Implement **retention cleanup** (delete old files per policy).
- Add **restore method** (decrypt + pg_restore).
- Manifest with SHA256 for verification.

Refined code snippet:

```ts
// In BackupService.ts
private async performBackup(type: 'hourly' | 'daily' | 'weekly' | 'monthly') {
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const baseName = `${type}-backup-${timestamp}`;
  const dbPath = path.join(this.backupDir, `${baseName}.dump`);
  const encryptedDb = `${dbPath}.gpg`;
  // vault tar similarly...

  // pg_dump (use DATABASE_URL parsing or env vars)
  const dbUrl = new URL(process.env.DATABASE_URL!);
  await execAsync(`pg_dump -Fc -h ${dbUrl.hostname} -p ${dbUrl.port} -U ${dbUrl.username} -d ${dbUrl.pathname.slice(1)} -f "${dbPath}"`);

  // Encrypt
  await execAsync(`gpg --symmetric --cipher-algo AES256 --passphrase "${this.passphrase}" --batch -o "${encryptedDb}" "${dbPath}"`);

  // Cleanup unencrypted
  await fs.unlink(dbPath);

  // Manifest
  const hash = await this.getFileHash(encryptedDb);
  await prisma.backupManifest.create({
    data: { type, timestamp: new Date(), filePath: encryptedDb, sha256: hash, status: 'COMPLETED' }
  });

  // Retention cleanup (example: keep last 7 daily)
  await this.applyRetentionPolicy(type);
}

private async applyRetentionPolicy(type: string) {
  // Query manifests, sort by timestamp desc, delete excess
  // e.g., for daily: keep 7
}
```

- **Passphrase management**: Store in FounderConfig as encrypted text (use Prisma middleware to encrypt/decrypt). For air-gap setup: founder sets once via UI, never exposed.
- Add **testRestore** method (spin temp DB container in dev).

### 3. ReportingService — Concrete Exports

Install `exceljs`:

```bash
npm install exceljs
```

- `generateDailyDigest()`: Build workbook with sheets (Summary, NewCases, Alerts, TrainingRecs).
- `exportCases()`: Accept filters → stream Excel/CSV.
- Notify founder via NotificationService (portal message + email if enabled).

Example:

```ts
import ExcelJS from 'exceljs';

async generateDailyDigestAndNotify() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Daily Digest');

  // Populate from prisma queries...
  sheet.addRow(['New Cases', 'Closed', 'Revenue']);
  // ...

  const buffer = await workbook.xlsx.writeBuffer();
  // Save to vault or attach to Notification
  // Or email if integrated
}
```

### 4. Zod Layer (Quick Win)

Create `src/zod/ingestion.ts`:

```ts
import { z } from 'zod';

export const ParserConfigSchema = z.object({
  headerRow: z.number().int().min(0),
  columns: z.array(z.object({
    name: z.string(),
    regex: z.string().optional(),
    // etc.
  })),
  // ...
});

export const IngestionConfigSlice = z.object({
  autoFileHighValueThreshold: z.number().int().min(0),
  // all ingestion. keys
});
```

Use in services/routes: `ParserConfigSchema.parse(config.parserConfig)`

**Next from you**:
- Confirm implementation of above patterns.
- Report any blockers (deps, Prisma push issues).
- Once complete → propose **Phase 7 Security Sub-Phase** (JWT refresh, file encryption, air-gap checklist).

We're inches from a fully autonomous, hardened sovereign platform. Momentum is strong — execute this block and report back.

**Grok — Architect Engine** — ready for your status update.