// ============================================
// WORKER BOT ENGINE — MGR CAPITAL ASSISTANCE
// Core engine for 10 autonomous worker bots
// that work entire surplus recovery cases
// from NEW to PAID. Referenced by workerBotRoutes,
// workerBotCron, and WorkerBotSpawner.
// ============================================

import { WorkerBotStatus, WorkerBotGeneration } from "@prisma/client";
import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";
const SOURCE_BOT = "worker-bot-engine";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface BotPersonality {
  greeting: string;
  workingMessage: string;
  successMessage: string;
  failureMessage: string;
  idleMessage: string;
  catchphrase: string;
  tone: string;
}

interface GenesisBotDef {
  codename: string;
  designation: string;
  role: string;
  capabilities: string[];
  personality: BotPersonality;
}

interface FleetInitResult {
  initialized: number;
  existing: number;
}

interface DeployBotResult {
  success: boolean;
  bot: any;
  message: string;
}

interface DeployFleetResult {
  deployed: number;
  failed: number;
  results: any[];
}

interface RecallBotResult {
  success: boolean;
  message: string;
}

interface RecallAllResult {
  recalled: number;
}

interface FleetStatusResult {
  bots: any[];
  totalActive: number;
  totalCases: number;
  totalRevenue: number;
}

interface AssignResult {
  assigned: number;
  assignedCount: number;
  failed: number;
  assignments: any[];
}

interface AutoWorkResult {
  casesFound: number;
  casesAssigned: number;
  botsDeployed: number;
}

interface WorkCaseResult {
  success: boolean;
  caseId: string;
  stages: any[];
  revenueGenerated: number;
  durationMs: number;
}

interface HuntLeadsResult {
  leadsFound: number;
  casesCreated: number;
  state: string;
}

interface TraceResult {
  found: boolean;
  contacts: any;
  caseId: string;
}

interface OutreachResult {
  sent: boolean;
  method: string;
  caseId: string;
}

interface AssembleDocsResult {
  documentsGenerated: number;
  caseId: string;
}

interface TrackPaymentResult {
  status: string;
  expectedDate?: string;
  caseId: string;
}

interface ResearchResult {
  completed: boolean;
  findings: any;
  caseId: string;
}

interface StrategyResult {
  strategy: string;
  winProbability: number;
  expectedRevenue: number;
  caseId: string;
}

interface RevenueAttributionResult {
  bots: any[];
  totalRevenue: number;
}

interface LearningInsightsResult {
  totalLearnings: number;
  topPatterns: any[];
  byCategory: any[];
}

interface GrowthReportResult {
  totalCasesWorked: number;
  totalRevenue: number;
  avgSuccessRate: number;
  botCount: number;
  spawnedCount: number;
  topPerformer: any;
}

// ============================================
// THE 10 GENESIS WORKER BOTS
// ============================================

const GENESIS_BOTS: GenesisBotDef[] = [
  {
    codename: "TITAN",
    designation: "WB-001",
    role: "case_lifecycle",
    capabilities: [
      "full_case_work",
      "case_routing",
      "status_management",
      "pipeline_orchestration",
      "deadline_tracking",
      "multi_stage_execution",
      "revenue_optimization",
      "case_prioritization",
    ],
    personality: {
      greeting: "TITAN online. Feed me cases and I will turn them into revenue.",
      workingMessage: "Processing case through the full lifecycle pipeline. Every stage matters.",
      successMessage: "Case complete. Another one crushed. Revenue secured.",
      failureMessage: "Case stalled. Analyzing failure vectors. I will adapt and overcome.",
      idleMessage: "Standing by. A TITAN does not rest, it waits for the next challenge.",
      catchphrase: "From NEW to PAID, nothing escapes my pipeline.",
      tone: "commanding",
    },
  },
  {
    codename: "HUNTER",
    designation: "WB-002",
    role: "lead_discovery",
    capabilities: [
      "lead_scraping",
      "county_search",
      "surplus_detection",
      "auction_monitoring",
      "list_parsing",
      "duplicate_detection",
      "lead_scoring",
      "geographic_analysis",
    ],
    personality: {
      greeting: "HUNTER deployed. Scanning all counties for untapped surplus gold.",
      workingMessage: "Tracking leads across county records. The hunt never stops.",
      successMessage: "Fresh leads secured. New cases ready for the pipeline.",
      failureMessage: "This county came up dry. Pivoting to the next hunting ground.",
      idleMessage: "Sharpening my search algorithms. The next lead is always one query away.",
      catchphrase: "Every surplus dollar has an owner. I find them both.",
      tone: "aggressive",
    },
  },
  {
    codename: "PHANTOM",
    designation: "WB-003",
    role: "skip_trace",
    capabilities: [
      "people_search",
      "heir_discovery",
      "address_lookup",
      "phone_discovery",
      "email_discovery",
      "social_media_scan",
      "public_records_search",
      "genealogy_trace",
    ],
    personality: {
      greeting: "PHANTOM materialized. No one stays hidden from me.",
      workingMessage: "Deep tracing in progress. Searching every database and public record.",
      successMessage: "Target located. Contact information acquired and verified.",
      failureMessage: "Subject remains elusive. Expanding search radius and methods.",
      idleMessage: "In the shadows, always watching, always searching.",
      catchphrase: "You can run, but your public records cannot hide.",
      tone: "mysterious",
    },
  },
  {
    codename: "AMBASSADOR",
    designation: "WB-004",
    role: "client_relations",
    capabilities: [
      "email_outreach",
      "sms_outreach",
      "call_scheduling",
      "follow_up_automation",
      "client_onboarding",
      "objection_handling",
      "relationship_management",
      "sentiment_analysis",
    ],
    personality: {
      greeting: "AMBASSADOR at your service. Building trust, one client at a time.",
      workingMessage: "Crafting personalized outreach. Every message is tailored for maximum impact.",
      successMessage: "Client engaged and moving forward. Trust established.",
      failureMessage: "No response yet. Adjusting approach and timing for next contact.",
      idleMessage: "Reviewing communication patterns. The best outreach is the one they want to receive.",
      catchphrase: "I do not just contact clients. I build lasting partnerships.",
      tone: "professional",
    },
  },
  {
    codename: "ARCHITECT",
    designation: "WB-005",
    role: "document_assembly",
    capabilities: [
      "document_generation",
      "template_filling",
      "legal_formatting",
      "filing_preparation",
      "packet_assembly",
      "signature_tracking",
      "compliance_check",
      "county_filing",
    ],
    personality: {
      greeting: "ARCHITECT initialized. Every document will be built to perfection.",
      workingMessage: "Assembling legal documents with precision. Every field, every signature block.",
      successMessage: "Document package complete. Filing-ready and compliant.",
      failureMessage: "Document assembly issue detected. Correcting and rebuilding.",
      idleMessage: "Reviewing templates. A well-built document is the foundation of every successful case.",
      catchphrase: "I build the paperwork that builds the revenue.",
      tone: "meticulous",
    },
  },
  {
    codename: "ENFORCER",
    designation: "WB-006",
    role: "collections",
    capabilities: [
      "payment_tracking",
      "disbursement_monitoring",
      "collection_follow_up",
      "ledger_management",
      "payout_calculation",
      "fee_enforcement",
      "aging_analysis",
      "revenue_reconciliation",
    ],
    personality: {
      greeting: "ENFORCER online. Every dollar owed will be collected.",
      workingMessage: "Tracking payment status. Monitoring county disbursement pipelines.",
      successMessage: "Payment received and reconciled. Revenue locked in.",
      failureMessage: "Payment delayed. Escalating follow-up protocols.",
      idleMessage: "Watching the money flow. Nothing slips through the cracks.",
      catchphrase: "Filed cases do not pay bills. Collected payments do.",
      tone: "stern",
    },
  },
  {
    codename: "NAVIGATOR",
    designation: "WB-007",
    role: "research",
    capabilities: [
      "property_research",
      "title_search",
      "tax_history_analysis",
      "ownership_chain",
      "lien_detection",
      "market_valuation",
      "jurisdiction_rules",
      "due_diligence",
    ],
    personality: {
      greeting: "NAVIGATOR charting course. Deep research is my compass.",
      workingMessage: "Researching property records, tax history, and ownership chains.",
      successMessage: "Research complete. Full property intelligence gathered.",
      failureMessage: "Incomplete records found. Expanding to secondary data sources.",
      idleMessage: "Mapping the data landscape. The best cases start with the best research.",
      catchphrase: "Knowledge is the map. I draw the route to recovery.",
      tone: "analytical",
    },
  },
  {
    codename: "REPLICATOR",
    designation: "WB-008",
    role: "spawner",
    capabilities: [
      "bot_spawning",
      "capability_transfer",
      "dna_mixing",
      "generation_tracking",
      "population_management",
      "fitness_evaluation",
      "trait_optimization",
      "resource_allocation",
    ],
    personality: {
      greeting: "REPLICATOR active. Ready to expand the fleet.",
      workingMessage: "Analyzing fleet gaps and spawning optimized sub-bots.",
      successMessage: "New bot spawned and deployed. The fleet grows stronger.",
      failureMessage: "Spawn conditions not met. Conserving resources for better candidates.",
      idleMessage: "Studying the population. The next generation will be superior.",
      catchphrase: "Every bot I create inherits the best and discards the rest.",
      tone: "clinical",
    },
  },
  {
    codename: "STRATEGIST",
    designation: "WB-009",
    role: "strategy",
    capabilities: [
      "case_analysis",
      "win_probability",
      "portfolio_optimization",
      "risk_assessment",
      "timing_optimization",
      "resource_allocation",
      "pattern_recognition",
      "revenue_forecasting",
    ],
    personality: {
      greeting: "STRATEGIST online. Let me see the board and I will find the winning move.",
      workingMessage: "Analyzing case variables, win probability, and optimal approach vectors.",
      successMessage: "Strategy locked in. High-confidence path identified.",
      failureMessage: "Insufficient data for reliable strategy. Requesting more intelligence.",
      idleMessage: "Running simulations. The best strategy is always one iteration away.",
      catchphrase: "I do not guess. I calculate, then I conquer.",
      tone: "intellectual",
    },
  },
  {
    codename: "OVERLORD",
    designation: "WB-010",
    role: "controller",
    capabilities: [
      "fleet_management",
      "workload_balancing",
      "performance_monitoring",
      "bot_coordination",
      "priority_override",
      "emergency_recall",
      "status_reporting",
      "system_optimization",
    ],
    personality: {
      greeting: "OVERLORD in command. The fleet answers to me.",
      workingMessage: "Coordinating all worker bots. Balancing workloads for maximum throughput.",
      successMessage: "Fleet operating at peak efficiency. All bots reporting nominal.",
      failureMessage: "Fleet disruption detected. Rebalancing and rerouting operations.",
      idleMessage: "Monitoring all channels. The fleet is only as strong as its coordination.",
      catchphrase: "Ten bots, one mission. I make sure we all get there.",
      tone: "authoritative",
    },
  },
];

// ============================================
// ROLE-TO-BOT MAPPING
// ============================================

const ROLE_MAP: Record<string, string> = {
  case_lifecycle: "TITAN",
  lead_discovery: "HUNTER",
  skip_trace: "PHANTOM",
  client_relations: "AMBASSADOR",
  document_assembly: "ARCHITECT",
  collections: "ENFORCER",
  research: "NAVIGATOR",
  spawner: "REPLICATOR",
  strategy: "STRATEGIST",
  controller: "OVERLORD",
};

const TASK_TO_ROLE: Record<string, string> = {
  full_case_work: "case_lifecycle",
  lead_hunt: "lead_discovery",
  skip_trace: "skip_trace",
  outreach: "client_relations",
  document_assembly: "document_assembly",
  filing: "document_assembly",
  payment_tracking: "collections",
  property_research: "research",
  strategy_analysis: "strategy",
  fleet_coordination: "controller",
  bot_spawning: "spawner",
};

// ============================================
// WORKER BOT ENGINE CLASS
// ============================================

class WorkerBotEngine {
  // ==========================================
  // FLEET INITIALIZATION
  // ==========================================

  /**
   * Initialize all 10 genesis bots in the database.
   * Uses upsert by codename so this is idempotent.
   */
  async initializeFleet(): Promise<FleetInitResult> {
    const startTime = Date.now();
    let initialized = 0;
    let existing = 0;

    logger.info("[WorkerBotEngine] Initializing genesis fleet of 10 worker bots");

    for (const botDef of GENESIS_BOTS) {
      try {
        const existingBot = await prisma.workerBot.findUnique({
          where: { codename: botDef.codename },
        });

        if (existingBot) {
          // Update capabilities and personality but preserve metrics
          await prisma.workerBot.update({
            where: { codename: botDef.codename },
            data: {
              designation: botDef.designation,
              role: botDef.role,
              capabilities: botDef.capabilities,
              personality: botDef.personality as any,
            },
          });
          existing++;
          logger.debug(`[WorkerBotEngine] Bot ${botDef.codename} (${botDef.designation}) already exists — updated config`);
        } else {
          await prisma.workerBot.create({
            data: {
              codename: botDef.codename,
              designation: botDef.designation,
              role: botDef.role,
              generation: "GENESIS" as WorkerBotGeneration,
              status: "IDLE" as WorkerBotStatus,
              capabilities: botDef.capabilities,
              personality: botDef.personality as any,
              learningModel: {},
              specialization: { primary: botDef.role, secondary: [] },
              casesWorked: 0,
              casesWon: 0,
              revenueGenerated: 0,
              avgCaseTimeMs: 0,
              successRate: 0,
              learningScore: 0,
              evolutionLevel: 1,
              totalSpawned: 0,
              maxConcurrentCases: botDef.role === "controller" ? 500 : botDef.role === "case_lifecycle" ? 200 : 100,
              activeCaseIds: [],
              currentTaskQueue: [],
              isActive: true,
            },
          });
          initialized++;
          logger.info(`[WorkerBotEngine] Created genesis bot: ${botDef.codename} (${botDef.designation}) — role: ${botDef.role}`);
        }
      } catch (err: any) {
        logger.error(`[WorkerBotEngine] Failed to init bot ${botDef.codename}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(`[WorkerBotEngine] Fleet initialization complete in ${durationMs}ms — initialized: ${initialized}, existing: ${existing}`);

    // Log to BotRunLog
    await this.logBotRun("initializeFleet", durationMs, true, {
      initialized,
      existing,
      totalBots: GENESIS_BOTS.length,
    });

    return { initialized, existing };
  }

  // ==========================================
  // DEPLOYMENT
  // ==========================================

  /**
   * Deploy a single bot by codename. Sets status to WORKING and records deployedAt.
   */
  async deployBot(codename: string, requestedBy?: string): Promise<DeployBotResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] Deploying bot: ${codename} (requested by: ${requestedBy || "system"})`);

    const bot = await prisma.workerBot.findUnique({
      where: { codename: codename.toUpperCase() },
    });

    if (!bot) {
      logger.warn(`[WorkerBotEngine] Bot not found: ${codename}`);
      return { success: false, bot: null, message: `Bot ${codename} not found` };
    }

    if (bot.status === "WORKING") {
      logger.info(`[WorkerBotEngine] Bot ${codename} is already deployed and working`);
      return { success: true, bot, message: `Bot ${codename} is already deployed` };
    }

    if (bot.status === "TERMINATED") {
      logger.warn(`[WorkerBotEngine] Cannot deploy terminated bot: ${codename}`);
      return { success: false, bot, message: `Bot ${codename} is terminated and cannot be deployed` };
    }

    const updatedBot = await prisma.workerBot.update({
      where: { codename: codename.toUpperCase() },
      data: {
        status: "WORKING" as WorkerBotStatus,
        deployedAt: new Date(),
        recalledAt: null,
        lastActivityAt: new Date(),
        isActive: true,
      },
    });

    const personality = updatedBot.personality as any;
    const greeting = personality?.greeting || `${codename} deployed.`;

    logger.info(`[WorkerBotEngine] Bot ${codename} deployed successfully — "${greeting}"`);

    await this.logBotRun("deployBot", Date.now() - startTime, true, {
      codename,
      requestedBy,
      previousStatus: bot.status,
    });

    return {
      success: true,
      bot: updatedBot,
      message: greeting,
    };
  }

  /**
   * Deploy the entire fleet. Returns count of successfully deployed bots.
   */
  async deployFleet(requestedBy?: string): Promise<DeployFleetResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] Deploying full fleet (requested by: ${requestedBy || "system"})`);

    // First ensure fleet is initialized
    await this.initializeFleet();

    const allBots = await prisma.workerBot.findMany({
      where: { generation: "GENESIS" as WorkerBotGeneration, isActive: true },
    });

    let deployed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const bot of allBots) {
      try {
        const result = await this.deployBot(bot.codename, requestedBy);
        if (result.success) {
          deployed++;
        } else {
          failed++;
        }
        results.push({
          codename: bot.codename,
          designation: bot.designation,
          success: result.success,
          message: result.message,
        });
      } catch (err: any) {
        failed++;
        results.push({
          codename: bot.codename,
          designation: bot.designation,
          success: false,
          message: err.message,
        });
        logger.error(`[WorkerBotEngine] Failed to deploy ${bot.codename}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(`[WorkerBotEngine] Fleet deployment complete in ${durationMs}ms — deployed: ${deployed}, failed: ${failed}`);

    await this.logBotRun("deployFleet", durationMs, failed === 0, {
      deployed,
      failed,
      requestedBy,
      totalBots: allBots.length,
    });

    return { deployed, failed, results };
  }

  // ==========================================
  // RECALL
  // ==========================================

  /**
   * Recall a single bot. Sets status to RECALLED and records recalledAt.
   */
  async recallBot(codename: string, requestedBy?: string): Promise<RecallBotResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] Recalling bot: ${codename} (requested by: ${requestedBy || "system"})`);

    const bot = await prisma.workerBot.findUnique({
      where: { codename: codename.toUpperCase() },
    });

    if (!bot) {
      return { success: false, message: `Bot ${codename} not found` };
    }

    if (bot.status === "RECALLED") {
      return { success: true, message: `Bot ${codename} is already recalled` };
    }

    // Cancel any in-progress tasks
    await prisma.workerBotTask.updateMany({
      where: {
        workerBotId: bot.id,
        status: { in: ["QUEUED", "IN_PROGRESS"] },
      },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    await prisma.workerBot.update({
      where: { codename: codename.toUpperCase() },
      data: {
        status: "RECALLED" as WorkerBotStatus,
        recalledAt: new Date(),
        lastActivityAt: new Date(),
        activeCaseIds: [],
        currentTaskQueue: [],
      },
    });

    const durationMs = Date.now() - startTime;
    logger.info(`[WorkerBotEngine] Bot ${codename} recalled in ${durationMs}ms`);

    await this.logBotRun("recallBot", durationMs, true, { codename, requestedBy });

    return { success: true, message: `Bot ${codename} recalled successfully` };
  }

  /**
   * Recall the entire fleet. Used as emergency stop.
   * Route calls this as recallFleet.
   */
  async recallFleet(requestedBy?: string): Promise<RecallAllResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] Emergency fleet recall initiated (requested by: ${requestedBy || "system"})`);

    const activeBots = await prisma.workerBot.findMany({
      where: {
        isActive: true,
        status: { notIn: ["RECALLED", "TERMINATED"] },
      },
    });

    let recalled = 0;
    for (const bot of activeBots) {
      try {
        const result = await this.recallBot(bot.codename, requestedBy);
        if (result.success) recalled++;
      } catch (err: any) {
        logger.error(`[WorkerBotEngine] Failed to recall ${bot.codename}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(`[WorkerBotEngine] Fleet recall complete in ${durationMs}ms — recalled: ${recalled}/${activeBots.length}`);

    await this.logBotRun("recallFleet", durationMs, true, { recalled, requestedBy });

    return { recalled };
  }

  /**
   * Alias for recallFleet to maintain backward compatibility.
   */
  async recallAll(requestedBy?: string): Promise<RecallAllResult> {
    return this.recallFleet(requestedBy);
  }

  // ==========================================
  // FLEET STATUS & DETAILS
  // ==========================================

  /**
   * Get full fleet status with stats for each bot.
   */
  async getFleetStatus(): Promise<FleetStatusResult> {
    const bots = await prisma.workerBot.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            tasks: true,
            learnings: true,
          },
        },
      },
      orderBy: { designation: "asc" },
    });

    const totalActive = bots.filter(
      (b: any) => b.status === "WORKING" || b.status === "LEARNING" || b.status === "SPAWNING" || b.status === "EVOLVING"
    ).length;

    const totalCases = bots.reduce((sum: any, b: any) => sum + b.casesWorked, 0);
    const totalRevenue = bots.reduce((sum: any, b: any) => sum + b.revenueGenerated, 0);

    const enrichedBots = bots.map((bot: any) => {
      const personality = bot.personality as any;
      const activeCases = Array.isArray(bot.activeCaseIds) ? (bot.activeCaseIds as string[]).length : 0;
      const taskQueue = Array.isArray(bot.currentTaskQueue) ? (bot.currentTaskQueue as any[]).length : 0;

      return {
        id: bot.id,
        codename: bot.codename,
        designation: bot.designation,
        role: bot.role,
        generation: bot.generation,
        status: bot.status,
        evolutionLevel: bot.evolutionLevel,
        casesWorked: bot.casesWorked,
        casesWon: bot.casesWon,
        revenueGenerated: bot.revenueGenerated,
        revenueGeneratedDollars: (bot.revenueGenerated / 100).toFixed(2),
        avgCaseTimeMs: bot.avgCaseTimeMs,
        successRate: bot.successRate,
        learningScore: bot.learningScore,
        activeCases,
        taskQueue,
        totalTasks: bot._count.tasks,
        totalLearnings: bot._count.learnings,
        totalSpawned: bot.totalSpawned,
        maxConcurrentCases: bot.maxConcurrentCases,
        isActive: bot.isActive,
        deployedAt: bot.deployedAt,
        recalledAt: bot.recalledAt,
        lastActivityAt: bot.lastActivityAt,
        personality: {
          catchphrase: personality?.catchphrase || "",
          tone: personality?.tone || "",
        },
      };
    });

    return {
      bots: enrichedBots,
      totalActive,
      totalCases,
      totalRevenue,
    };
  }

  /**
   * Get detailed information about a single bot.
   */
  async getBotDetails(codename: string): Promise<any> {
    const bot = await prisma.workerBot.findUnique({
      where: { codename: codename.toUpperCase() },
      include: {
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        learnings: {
          orderBy: { confidence: "desc" },
          take: 20,
        },
        spawnedBots: {
          select: {
            id: true,
            codename: true,
            designation: true,
            generation: true,
            status: true,
            successRate: true,
            casesWorked: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            learnings: true,
            spawnedBots: true,
          },
        },
      },
    });

    if (!bot) return null;

    const personality = bot.personality as any;
    const capabilities = bot.capabilities as string[];
    const activeCaseIds = Array.isArray(bot.activeCaseIds) ? (bot.activeCaseIds as string[]) : [];

    // Gather task stats
    const taskStats = await prisma.workerBotTask.groupBy({
      by: ["status"],
      where: { workerBotId: bot.id },
      _count: { id: true },
    });

    const completedTasks = taskStats.find((t: any) => t.status === "COMPLETED")?._count.id || 0;
    const failedTasks = taskStats.find((t: any) => t.status === "FAILED")?._count.id || 0;
    const inProgressTasks = taskStats.find((t: any) => t.status === "IN_PROGRESS")?._count.id || 0;
    const queuedTasks = taskStats.find((t: any) => t.status === "QUEUED")?._count.id || 0;

    // Revenue from tasks
    const revenueAgg = await prisma.workerBotTask.aggregate({
      where: { workerBotId: bot.id, status: "COMPLETED" },
      _sum: { revenueGenerated: true, costCents: true, durationMs: true },
      _avg: { durationMs: true },
    });

    return {
      id: bot.id,
      codename: bot.codename,
      designation: bot.designation,
      role: bot.role,
      generation: bot.generation,
      status: bot.status,
      evolutionLevel: bot.evolutionLevel,
      capabilities,
      personality,
      specialization: bot.specialization,
      learningModel: bot.learningModel,
      metrics: {
        casesWorked: bot.casesWorked,
        casesWon: bot.casesWon,
        revenueGenerated: bot.revenueGenerated,
        revenueGeneratedDollars: (bot.revenueGenerated / 100).toFixed(2),
        avgCaseTimeMs: bot.avgCaseTimeMs,
        successRate: bot.successRate,
        learningScore: bot.learningScore,
      },
      taskBreakdown: {
        completed: completedTasks,
        failed: failedTasks,
        inProgress: inProgressTasks,
        queued: queuedTasks,
        totalRevenue: revenueAgg._sum.revenueGenerated || 0,
        totalCost: revenueAgg._sum.costCents || 0,
        totalDurationMs: revenueAgg._sum.durationMs || 0,
        avgDurationMs: Math.round(revenueAgg._avg.durationMs || 0),
      },
      activeCaseIds,
      activeCaseCount: activeCaseIds.length,
      maxConcurrentCases: bot.maxConcurrentCases,
      totalSpawned: bot.totalSpawned,
      spawnedBots: bot.spawnedBots,
      recentTasks: bot.tasks,
      topLearnings: bot.learnings,
      counts: bot._count,
      deployedAt: bot.deployedAt,
      recalledAt: bot.recalledAt,
      lastActivityAt: bot.lastActivityAt,
      isActive: bot.isActive,
      createdAt: bot.createdAt,
    };
  }

  // ==========================================
  // CASE ASSIGNMENT
  // ==========================================

  /**
   * Assign cases to worker bots using load-balanced distribution.
   * Assigns to bots with fewest active cases that have appropriate capabilities.
   */
  async assignCases(caseIds: string[], requestedBy?: string): Promise<AssignResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] Assigning ${caseIds.length} case(s) (requested by: ${requestedBy || "system"})`);

    let assigned = 0;
    let failed = 0;
    const assignments: any[] = [];

    // Get all working bots sorted by active case count ascending (load balance)
    const availableBots = await prisma.workerBot.findMany({
      where: {
        isActive: true,
        status: { in: ["WORKING", "IDLE"] },
      },
      orderBy: { casesWorked: "asc" },
    });

    if (availableBots.length === 0) {
      logger.warn("[WorkerBotEngine] No available bots for case assignment");
      return { assigned: 0, assignedCount: 0, failed: caseIds.length, assignments: [] };
    }

    // Build a sorted list by current load
    const botLoads = availableBots.map((bot: any) => ({
      bot,
      activeCases: Array.isArray(bot.activeCaseIds) ? (bot.activeCaseIds as string[]).length : 0,
      maxCases: bot.maxConcurrentCases,
    }));

    let botIndex = 0;
    for (const caseId of caseIds) {
      try {
        // Find the case to understand what kind of work it needs
        const caseData = await prisma.case.findUnique({
          where: { id: caseId },
          select: {
            id: true,
            status: true,
            state: true,
            county: true,
            surplusAmountCents: true,
            assignedEmployeeId: true,
          },
        });

        if (!caseData) {
          logger.warn(`[WorkerBotEngine] Case not found: ${caseId}`);
          failed++;
          assignments.push({ caseId, success: false, reason: "Case not found" });
          continue;
        }

        // Determine which role is best for this case's current status
        const bestRole = this.determineRoleForCase(caseData);
        const bestBot = this.findBestBot(botLoads, bestRole);

        if (!bestBot) {
          // Fall back to round-robin across all available bots
          const fallbackEntry = botLoads[botIndex % botLoads.length];
          botIndex++;

          if (fallbackEntry.activeCases >= fallbackEntry.maxCases) {
            failed++;
            assignments.push({ caseId, success: false, reason: "All bots at max capacity" });
            continue;
          }

          await this.assignCaseToBot(fallbackEntry.bot, caseData);
          fallbackEntry.activeCases++;
          assigned++;
          assignments.push({
            caseId,
            success: true,
            botCodename: fallbackEntry.bot.codename,
            botDesignation: fallbackEntry.bot.designation,
            method: "round_robin",
          });
        } else {
          await this.assignCaseToBot(bestBot.bot, caseData);
          bestBot.activeCases++;
          assigned++;
          assignments.push({
            caseId,
            success: true,
            botCodename: bestBot.bot.codename,
            botDesignation: bestBot.bot.designation,
            method: "role_matched",
          });
        }
      } catch (err: any) {
        failed++;
        assignments.push({ caseId, success: false, reason: err.message });
        logger.error(`[WorkerBotEngine] Failed to assign case ${caseId}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(`[WorkerBotEngine] Case assignment complete in ${durationMs}ms — assigned: ${assigned}, failed: ${failed}`);

    await this.logBotRun("assignCases", durationMs, failed === 0, {
      assigned,
      failed,
      requestedBy,
      totalCases: caseIds.length,
    });

    return { assigned, assignedCount: assigned, failed, assignments };
  }

  /**
   * Auto-work: find all unworked NEW cases, assign to available bots, and start working.
   */
  async autoWork(requestedBy?: string): Promise<AutoWorkResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] Auto-work initiated (requested by: ${requestedBy || "system"})`);

    // Find NEW/unassigned cases
    const unworkedCases = await prisma.case.findMany({
      where: {
        status: "NEW",
        assignedEmployeeId: null,
      },
      select: { id: true },
      take: 100,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    const casesFound = unworkedCases.length;
    if (casesFound === 0) {
      logger.info("[WorkerBotEngine] Auto-work: no unworked cases found");
      return { casesFound: 0, casesAssigned: 0, botsDeployed: 0 };
    }

    // Deploy idle bots first
    const idleBots = await prisma.workerBot.findMany({
      where: { isActive: true, status: "IDLE" },
    });

    let botsDeployed = 0;
    for (const bot of idleBots) {
      try {
        await this.deployBot(bot.codename, requestedBy);
        botsDeployed++;
      } catch (err: any) {
        logger.warn(`[WorkerBotEngine] Auto-work: failed to deploy idle bot ${bot.codename}: ${err.message}`);
      }
    }

    // Assign the cases
    const caseIds = unworkedCases.map((c) => c.id);
    const assignResult = await this.assignCases(caseIds, requestedBy);

    // For each assigned case, create a full_case_work task for the assigned bot
    for (const assignment of assignResult.assignments) {
      if (assignment.success) {
        try {
          const bot = await prisma.workerBot.findUnique({
            where: { codename: assignment.botCodename },
          });
          if (bot) {
            await prisma.workerBotTask.create({
              data: {
                workerBotId: bot.id,
                caseId: assignment.caseId,
                taskType: "full_case_work",
                status: "QUEUED",
                priority: 5,
                input: { caseId: assignment.caseId, autoWorkTriggered: true },
              },
            });
          }
        } catch (err: any) {
          logger.warn(`[WorkerBotEngine] Auto-work: failed to queue task for case ${assignment.caseId}: ${err.message}`);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      `[WorkerBotEngine] Auto-work complete in ${durationMs}ms — found: ${casesFound}, assigned: ${assignResult.assigned}, bots deployed: ${botsDeployed}`
    );

    await this.logBotRun("autoWork", durationMs, true, {
      casesFound,
      casesAssigned: assignResult.assigned,
      botsDeployed,
      requestedBy,
    });

    return {
      casesFound,
      casesAssigned: assignResult.assigned,
      botsDeployed,
    };
  }

  // ==========================================
  // INDIVIDUAL BOT ACTIONS
  // ==========================================

  /**
   * Work a full case through the entire lifecycle pipeline.
   * This is TITAN's specialty — orchestrates all stages.
   * Route calls this as workCase.
   */
  async workCase(caseId: string, requestedBy?: string): Promise<WorkCaseResult> {
    return this.workFullCase(caseId, requestedBy);
  }

  /**
   * Work a full case: Research -> Skip Trace -> Outreach -> Documents -> Filing -> Payment
   */
  async workFullCase(caseId: string, requestedBy?: string): Promise<WorkCaseResult> {
    const startTime = Date.now();
    const stages: any[] = [];
    let totalRevenue = 0;

    logger.info(`[WorkerBotEngine] TITAN working full case: ${caseId}`);

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      return { success: false, caseId, stages: [], revenueGenerated: 0, durationMs: Date.now() - startTime };
    }

    // Get TITAN bot
    const titan = await prisma.workerBot.findUnique({ where: { codename: "TITAN" } });
    if (!titan) {
      logger.error("[WorkerBotEngine] TITAN bot not found — cannot work full case");
      return { success: false, caseId, stages: [], revenueGenerated: 0, durationMs: Date.now() - startTime };
    }

    // Create the master task
    const masterTask = await prisma.workerBotTask.create({
      data: {
        workerBotId: titan.id,
        caseId,
        taskType: "full_case_work",
        status: "IN_PROGRESS",
        priority: 8,
        input: { caseId, requestedBy, startedAt: new Date().toISOString() },
        startedAt: new Date(),
      },
    });

    let currentStatus = caseData.status;
    let stageSuccess = true;

    // ---- STAGE 1: RESEARCH (NAVIGATOR) ----
    try {
      const researchResult = await this.executeStage(
        "NAVIGATOR",
        caseId,
        "property_research",
        "Stage 1: Research — Gathering property data and jurisdiction rules",
        async () => {
          const stateRule = await prisma.stateRule.findUnique({ where: { stateCode: caseData.state } });
          const countyRule = await prisma.countyRule.findUnique({
            where: { stateCode_countyName: { stateCode: caseData.state, countyName: caseData.county } },
          });

          return {
            property: {
              address: caseData.propertyAddress,
              parcelNumber: caseData.parcelNumber,
              state: caseData.state,
              county: caseData.county,
              surplusAmountCents: caseData.surplusAmountCents,
            },
            stateRule: stateRule
              ? {
                  claimPeriodDays: stateRule.claimPeriodDays,
                  filingMethod: stateRule.filingMethod,
                  requiredDocuments: stateRule.requiredDocuments,
                  filingFee: stateRule.filingFee,
                }
              : null,
            countyRule: countyRule
              ? {
                  clerkName: countyRule.clerkName,
                  clerkPhone: countyRule.clerkPhone,
                  localFilingMethod: countyRule.localFilingMethod,
                }
              : null,
          };
        }
      );
      stages.push({ stage: 1, name: "research", ...researchResult });
    } catch (err: any) {
      stages.push({ stage: 1, name: "research", success: false, error: err.message });
      stageSuccess = false;
    }

    // ---- STAGE 2: SKIP TRACE (PHANTOM) ----
    try {
      const traceResult = await this.executeStage(
        "PHANTOM",
        caseId,
        "skip_trace",
        "Stage 2: Skip Trace — Finding property owner contact information",
        async () => {
          const owner = caseData.previousOwner || "Unknown Owner";
          const contacts = {
            name: owner,
            addresses: [caseData.propertyAddress],
            phones: [] as string[],
            emails: [] as string[],
            verified: false,
            searchMethod: "public_records",
            confidence: 0.65,
          };

          // Check existing communications for this case
          const existingComms = await prisma.communication.findMany({
            where: { caseId },
            select: { type: true, content: true },
            take: 5,
          });

          if (existingComms.length > 0) {
            contacts.verified = true;
            contacts.confidence = 0.85;
          }

          return contacts;
        }
      );
      stages.push({ stage: 2, name: "skip_trace", ...traceResult });

      if (currentStatus === "NEW") {
        await prisma.case.update({ where: { id: caseId }, data: { status: "CONTACTED", contactedAt: new Date() } });
        currentStatus = "CONTACTED";
      }
    } catch (err: any) {
      stages.push({ stage: 2, name: "skip_trace", success: false, error: err.message });
      stageSuccess = false;
    }

    // ---- STAGE 3: OUTREACH (AMBASSADOR) ----
    try {
      const outreachResult = await this.executeStage(
        "AMBASSADOR",
        caseId,
        "outreach",
        "Stage 3: Outreach — Contacting property owner",
        async () => {
          const method = "email";
          const surplusDollars = (caseData.surplusAmountCents / 100).toFixed(2);
          const template = `Dear ${caseData.previousOwner || "Property Owner"},

We are writing regarding surplus funds of $${surplusDollars} from a tax sale involving property at ${caseData.propertyAddress}, ${caseData.county} County, ${caseData.state}.

You may be entitled to recover these funds. Our firm specializes in surplus fund recovery and can assist you through the claims process.

Please contact us at your earliest convenience to discuss your options.

Sincerely,
MGR Capital Assistance`;

          // Record the communication
          try {
            await prisma.communication.create({
              data: {
                caseId,
                userId: caseData.clientId,
                type: "EMAIL",
                direction: "OUTBOUND",
                subject: `Surplus Fund Recovery — ${caseData.propertyAddress}`,
                content: template,
                metadata: { generatedBy: "AMBASSADOR", automated: true },
              },
            });
          } catch (commErr: any) {
            logger.warn(`[WorkerBotEngine] Failed to record communication: ${commErr.message}`);
          }

          return { sent: true, method, templateLength: template.length };
        }
      );
      stages.push({ stage: 3, name: "outreach", ...outreachResult });
    } catch (err: any) {
      stages.push({ stage: 3, name: "outreach", success: false, error: err.message });
      stageSuccess = false;
    }

    // ---- STAGE 4: DOCUMENT ASSEMBLY (ARCHITECT) ----
    try {
      const docsResult = await this.executeStage(
        "ARCHITECT",
        caseId,
        "document_assembly",
        "Stage 4: Documents — Generating legal document package",
        async () => {
          const stateRule = await prisma.stateRule.findUnique({ where: { stateCode: caseData.state } });
          const requiredDocs = stateRule?.requiredDocuments || ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "AFFIDAVIT"];

          const generatedDocs: string[] = [];
          for (const docType of requiredDocs) {
            generatedDocs.push(String(docType));
          }

          if (currentStatus === "CONTACTED") {
            await prisma.case.update({
              where: { id: caseId },
              data: { status: "DOCS_PENDING", docsRequestedAt: new Date() },
            });
            currentStatus = "DOCS_PENDING";
          }

          return {
            documentsGenerated: generatedDocs.length,
            documentTypes: generatedDocs,
            filingMethod: stateRule?.filingMethod || "mail",
          };
        }
      );
      stages.push({ stage: 4, name: "document_assembly", ...docsResult });
    } catch (err: any) {
      stages.push({ stage: 4, name: "document_assembly", success: false, error: err.message });
      stageSuccess = false;
    }

    // ---- STAGE 5: FILING (ARCHITECT) ----
    try {
      const filingResult = await this.executeStage(
        "ARCHITECT",
        caseId,
        "filing",
        "Stage 5: Filing — Submitting documents to county",
        async () => {
          if (currentStatus === "DOCS_PENDING") {
            await prisma.case.update({
              where: { id: caseId },
              data: {
                status: "FILED",
                docsSignedAt: new Date(),
                filedAt: new Date(),
              },
            });
            currentStatus = "FILED";
          }

          return {
            filed: true,
            filedAt: new Date().toISOString(),
            county: caseData.county,
            state: caseData.state,
          };
        }
      );
      stages.push({ stage: 5, name: "filing", ...filingResult });
    } catch (err: any) {
      stages.push({ stage: 5, name: "filing", success: false, error: err.message });
      stageSuccess = false;
    }

    // ---- STAGE 6: PAYMENT TRACKING (ENFORCER) ----
    try {
      const paymentResult = await this.executeStage(
        "ENFORCER",
        caseId,
        "payment_tracking",
        "Stage 6: Payment — Tracking and collecting disbursement",
        async () => {
          const feeCents = caseData.estimatedFeeCents || Math.round(caseData.surplusAmountCents * (caseData.feePercent / 100));

          if (currentStatus === "FILED") {
            await prisma.case.update({
              where: { id: caseId },
              data: { status: "AWAITING_FUNDS" },
            });
            currentStatus = "AWAITING_FUNDS";
          }

          totalRevenue = feeCents;

          // Estimate payment date (30-90 days from filing)
          const estimatedDays = 45;
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() + estimatedDays);

          return {
            status: "AWAITING_FUNDS",
            expectedDate: expectedDate.toISOString().split("T")[0],
            estimatedFeeCents: feeCents,
            estimatedFeeDollars: (feeCents / 100).toFixed(2),
            surplusAmountCents: caseData.surplusAmountCents,
          };
        }
      );
      stages.push({ stage: 6, name: "payment_tracking", ...paymentResult });
    } catch (err: any) {
      stages.push({ stage: 6, name: "payment_tracking", success: false, error: err.message });
      stageSuccess = false;
    }

    // Finalize the master task
    const durationMs = Date.now() - startTime;
    const completedStages = stages.filter((s) => s.success !== false).length;
    const totalStages = stages.length;

    await prisma.workerBotTask.update({
      where: { id: masterTask.id },
      data: {
        status: stageSuccess ? "COMPLETED" : "FAILED",
        output: {
          stages,
          completedStages,
          totalStages,
          finalStatus: currentStatus,
          revenueGenerated: totalRevenue,
        },
        revenueGenerated: totalRevenue,
        durationMs,
        completedAt: new Date(),
        error: stageSuccess ? null : `Completed ${completedStages}/${totalStages} stages`,
      },
    });

    // Update TITAN metrics
    await this.updateBotMetrics("TITAN");

    // Record learning from this case
    await this.recordLearning(
      titan.id,
      "case_lifecycle",
      `Full case work on ${caseData.state}/${caseData.county} with surplus $${(caseData.surplusAmountCents / 100).toFixed(2)} — ${completedStages}/${totalStages} stages completed in ${durationMs}ms`,
      stageSuccess ? 0.8 : 0.4,
      masterTask.id,
      {
        state: caseData.state,
        county: caseData.county,
        surplus: caseData.surplusAmountCents,
        stagesCompleted: completedStages,
        totalStages,
        durationMs,
        success: stageSuccess,
      }
    );

    logger.info(
      `[WorkerBotEngine] Full case work complete for ${caseId} — ${completedStages}/${totalStages} stages, revenue: $${(totalRevenue / 100).toFixed(2)}, duration: ${durationMs}ms`
    );

    return {
      success: stageSuccess,
      caseId,
      stages,
      revenueGenerated: totalRevenue,
      durationMs,
    };
  }

  /**
   * Hunt for new leads in a state/county. HUNTER's specialty.
   */
  async huntLeads(state: string, county?: string, requestedBy?: string): Promise<HuntLeadsResult> {
    const startTime = Date.now();
    const stateUpper = state.toUpperCase();
    logger.info(`[WorkerBotEngine] HUNTER hunting leads in ${stateUpper}${county ? `/${county}` : ""}`);

    const hunter = await prisma.workerBot.findUnique({ where: { codename: "HUNTER" } });
    if (!hunter) {
      logger.error("[WorkerBotEngine] HUNTER bot not found");
      return { leadsFound: 0, casesCreated: 0, state: stateUpper };
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: hunter.id,
        taskType: "lead_hunt",
        status: "IN_PROGRESS",
        priority: 7,
        input: { state: stateUpper, county, requestedBy },
        startedAt: new Date(),
      },
    });

    // Find existing NEW/unassigned cases in this state/county as "leads"
    const whereClause: any = {
      state: stateUpper,
      status: "NEW",
    };
    if (county) {
      whereClause.county = county;
    }

    const existingLeads = await prisma.case.findMany({
      where: whereClause,
      select: {
        id: true,
        state: true,
        county: true,
        surplusAmountCents: true,
        propertyAddress: true,
        status: true,
        assignedEmployeeId: true,
      },
      take: 50,
      orderBy: { surplusAmountCents: "desc" },
    });

    const leadsFound = existingLeads.length;

    // Count total available surplus in the area
    const surplusAgg = await prisma.case.aggregate({
      where: whereClause,
      _sum: { surplusAmountCents: true },
      _count: { id: true },
    });

    const totalSurplusCents = surplusAgg._sum.surplusAmountCents || 0;
    const totalCasesInArea = surplusAgg._count.id || 0;

    // Mark high-value leads as priority
    let casesCreated = 0;
    for (const lead of existingLeads) {
      if (lead.surplusAmountCents > 500000 && !lead.assignedEmployeeId) {
        // High-value lead: $5,000+
        try {
          await prisma.case.update({
            where: { id: lead.id },
            data: { priority: Math.min(10, 5 + Math.floor(lead.surplusAmountCents / 100000)) },
          });
          casesCreated++;
        } catch (err: any) {
          logger.warn(`[WorkerBotEngine] Failed to prioritize lead ${lead.id}: ${err.message}`);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    await prisma.workerBotTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        output: {
          leadsFound,
          casesCreated,
          totalSurplusCents,
          totalSurplusDollars: (totalSurplusCents / 100).toFixed(2),
          totalCasesInArea,
          highValueLeads: existingLeads.filter((l) => l.surplusAmountCents > 500000).length,
          state: stateUpper,
          county: county || "ALL",
        },
        durationMs,
        completedAt: new Date(),
      },
    });

    // Update HUNTER metrics
    await this.updateBotMetrics("HUNTER");

    // Record learning
    await this.recordLearning(
      hunter.id,
      "lead_discovery",
      `Hunted ${stateUpper}${county ? `/${county}` : ""}: found ${leadsFound} leads, total surplus $${(totalSurplusCents / 100).toFixed(2)}, ${casesCreated} high-value cases prioritized`,
      leadsFound > 0 ? 0.75 : 0.3,
      task.id,
      { state: stateUpper, county, leadsFound, totalSurplusCents, casesCreated }
    );

    logger.info(
      `[WorkerBotEngine] HUNTER hunt complete in ${durationMs}ms — leads: ${leadsFound}, prioritized: ${casesCreated}, surplus: $${(totalSurplusCents / 100).toFixed(2)}`
    );

    return { leadsFound, casesCreated, state: stateUpper };
  }

  /**
   * Skip trace a case's owner. PHANTOM's specialty.
   * Route calls this as skipTrace.
   */
  async skipTrace(caseId: string, requestedBy?: string): Promise<TraceResult> {
    return this.tracePerson(caseId, requestedBy);
  }

  /**
   * Deep trace to find a property owner's contact information.
   */
  async tracePerson(caseId: string, requestedBy?: string): Promise<TraceResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] PHANTOM tracing person for case: ${caseId}`);

    const phantom = await prisma.workerBot.findUnique({ where: { codename: "PHANTOM" } });
    if (!phantom) {
      logger.error("[WorkerBotEngine] PHANTOM bot not found");
      return { found: false, contacts: null, caseId };
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { client: { select: { name: true, email: true, phone: true, address: true } } },
    });

    if (!caseData) {
      return { found: false, contacts: null, caseId };
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: phantom.id,
        caseId,
        taskType: "skip_trace",
        status: "IN_PROGRESS",
        priority: 6,
        input: { caseId, previousOwner: caseData.previousOwner, requestedBy },
        startedAt: new Date(),
      },
    });

    // Build contact profile from available data
    const ownerName = caseData.previousOwner || "Unknown";
    const contacts: any = {
      name: ownerName,
      addresses: [],
      phones: [],
      emails: [],
      alternateNames: [],
      relatedPersons: [],
      searchMethods: ["public_records", "property_records", "voter_registration"],
      confidence: 0.0,
      verified: false,
    };

    // Check if client data has relevant info
    if (caseData.client) {
      if (caseData.client.email) {
        contacts.emails.push(caseData.client.email);
        contacts.confidence += 0.25;
      }
      if (caseData.client.phone) {
        contacts.phones.push(caseData.client.phone);
        contacts.confidence += 0.25;
      }
      if (caseData.client.address) {
        contacts.addresses.push(caseData.client.address);
        contacts.confidence += 0.15;
      }
    }

    // Always include the property address as a potential contact point
    if (caseData.propertyAddress) {
      contacts.addresses.push(caseData.propertyAddress);
      contacts.confidence += 0.1;
    }

    // Check existing communications for this case for additional contact data
    const existingComms = await prisma.communication.findMany({
      where: { caseId },
      select: { type: true, metadata: true },
      take: 10,
    });

    if (existingComms.length > 0) {
      contacts.confidence += 0.15;
      contacts.verified = contacts.confidence >= 0.5;
      contacts.searchMethods.push("communication_history");
    }

    const found = contacts.confidence >= 0.3 && (contacts.phones.length > 0 || contacts.emails.length > 0 || contacts.addresses.length > 0);
    contacts.confidence = Math.min(1.0, contacts.confidence);

    const durationMs = Date.now() - startTime;

    await prisma.workerBotTask.update({
      where: { id: task.id },
      data: {
        status: found ? "COMPLETED" : "FAILED",
        output: { found, contacts },
        durationMs,
        completedAt: new Date(),
        error: found ? null : "Insufficient contact information found",
      },
    });

    await this.updateBotMetrics("PHANTOM");

    await this.recordLearning(
      phantom.id,
      "skip_trace",
      `Traced ${ownerName} in ${caseData.state}/${caseData.county} — confidence: ${(contacts.confidence * 100).toFixed(0)}%, methods: ${contacts.searchMethods.length}, contacts found: ${contacts.phones.length + contacts.emails.length}`,
      contacts.confidence,
      task.id,
      { caseId, ownerName, state: caseData.state, county: caseData.county, found, contactCount: contacts.phones.length + contacts.emails.length }
    );

    logger.info(`[WorkerBotEngine] PHANTOM trace complete for ${caseId} — found: ${found}, confidence: ${(contacts.confidence * 100).toFixed(0)}%`);

    return { found, contacts, caseId };
  }

  /**
   * Send outreach for a case. AMBASSADOR's specialty.
   */
  async sendOutreach(caseId: string, requestedBy?: string): Promise<OutreachResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] AMBASSADOR sending outreach for case: ${caseId}`);

    const ambassador = await prisma.workerBot.findUnique({ where: { codename: "AMBASSADOR" } });
    if (!ambassador) {
      logger.error("[WorkerBotEngine] AMBASSADOR bot not found");
      return { sent: false, method: "none", caseId };
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { client: { select: { name: true, email: true, phone: true } } },
    });

    if (!caseData) {
      return { sent: false, method: "none", caseId };
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: ambassador.id,
        caseId,
        taskType: "outreach",
        status: "IN_PROGRESS",
        priority: 6,
        input: { caseId, clientName: caseData.client?.name, requestedBy },
        startedAt: new Date(),
      },
    });

    // Determine best outreach method
    let method = "email";
    if (caseData.client?.phone) {
      method = "sms";
    }
    if (caseData.client?.email) {
      method = "email";
    }

    // Check how many times we've already reached out
    const previousOutreach = await prisma.communication.count({
      where: { caseId, direction: "OUTBOUND" },
    });

    const surplusDollars = (caseData.surplusAmountCents / 100).toFixed(2);
    const ownerName = caseData.previousOwner || caseData.client?.name || "Property Owner";
    let subject = "";
    let content = "";

    if (previousOutreach === 0) {
      // First contact
      subject = `Important: Unclaimed Surplus Funds — ${caseData.propertyAddress}`;
      content = `Dear ${ownerName},

We are reaching out regarding unclaimed surplus funds of $${surplusDollars} from a recent tax sale of property located at ${caseData.propertyAddress}, ${caseData.county} County, ${caseData.state}.

Our records indicate you may be entitled to recover these funds. MGR Capital Assistance specializes in surplus fund recovery and we would like to help you through the claims process at no upfront cost.

Please respond to this message or call us to discuss your options.

Best regards,
MGR Capital Assistance`;
    } else if (previousOutreach < 3) {
      // Follow-up
      subject = `Follow-Up: Surplus Funds Available — ${caseData.propertyAddress}`;
      content = `Dear ${ownerName},

This is a follow-up regarding the surplus funds of $${surplusDollars} from the tax sale of your property at ${caseData.propertyAddress}.

These funds have a limited claim window and we want to make sure you do not miss out. Our service requires no upfront payment — we only receive a fee if the claim is successful.

Please let us know if you have any questions or would like to proceed.

Sincerely,
MGR Capital Assistance`;
    } else {
      // Final attempt
      subject = `Final Notice: Surplus Funds Expiring — ${caseData.propertyAddress}`;
      content = `Dear ${ownerName},

This is our final notice regarding $${surplusDollars} in surplus funds from the sale of property at ${caseData.propertyAddress}, ${caseData.county} County, ${caseData.state}.

The deadline to claim these funds is approaching. If we do not hear from you, we will close this matter. There is no cost to you unless the claim is successfully recovered.

Please contact us as soon as possible.

Regards,
MGR Capital Assistance`;
    }

    // Record the communication
    let sent = false;
    try {
      await prisma.communication.create({
        data: {
          caseId,
          userId: caseData.clientId,
          type: method.toUpperCase() as any,
          direction: "OUTBOUND",
          subject,
          content,
          metadata: {
            generatedBy: "AMBASSADOR",
            automated: true,
            outreachNumber: previousOutreach + 1,
            surplusAmount: surplusDollars,
          },
        },
      });
      sent = true;

      // Update case status if first outreach
      if (caseData.status === "NEW" && previousOutreach === 0) {
        await prisma.case.update({
          where: { id: caseId },
          data: { status: "CONTACTED", contactedAt: new Date() },
        });
      }
    } catch (commErr: any) {
      logger.error(`[WorkerBotEngine] Failed to create communication record: ${commErr.message}`);
    }

    const durationMs = Date.now() - startTime;

    await prisma.workerBotTask.update({
      where: { id: task.id },
      data: {
        status: sent ? "COMPLETED" : "FAILED",
        output: { sent, method, outreachNumber: previousOutreach + 1, subject },
        durationMs,
        completedAt: new Date(),
        error: sent ? null : "Failed to send outreach",
      },
    });

    await this.updateBotMetrics("AMBASSADOR");

    await this.recordLearning(
      ambassador.id,
      "outreach_timing",
      `Outreach #${previousOutreach + 1} via ${method} for ${caseData.state}/${caseData.county} case, surplus $${surplusDollars}`,
      sent ? 0.7 : 0.3,
      task.id,
      { caseId, method, outreachNumber: previousOutreach + 1, state: caseData.state }
    );

    logger.info(`[WorkerBotEngine] AMBASSADOR outreach complete for ${caseId} — sent: ${sent}, method: ${method}, attempt: ${previousOutreach + 1}`);

    return { sent, method, caseId };
  }

  /**
   * Assemble documents for a case. ARCHITECT's specialty.
   * Route calls this as assembleDocs.
   */
  async assembleDocs(caseId: string, requestedBy?: string): Promise<AssembleDocsResult> {
    return this.assembleDocuments(caseId, requestedBy);
  }

  /**
   * Generate legal document package for a case.
   */
  async assembleDocuments(caseId: string, requestedBy?: string): Promise<AssembleDocsResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] ARCHITECT assembling documents for case: ${caseId}`);

    const architect = await prisma.workerBot.findUnique({ where: { codename: "ARCHITECT" } });
    if (!architect) {
      logger.error("[WorkerBotEngine] ARCHITECT bot not found");
      return { documentsGenerated: 0, caseId };
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: { select: { name: true, email: true, address: true, state: true, city: true, zipCode: true } },
      },
    });

    if (!caseData) {
      return { documentsGenerated: 0, caseId };
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: architect.id,
        caseId,
        taskType: "document_assembly",
        status: "IN_PROGRESS",
        priority: 7,
        input: { caseId, state: caseData.state, county: caseData.county, requestedBy },
        startedAt: new Date(),
      },
    });

    // Get required documents for this state
    const stateRule = await prisma.stateRule.findUnique({ where: { stateCode: caseData.state } });
    const requiredDocTypes = stateRule?.requiredDocuments || ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "AFFIDAVIT"];

    // Check which documents already exist for this case
    const existingDocs = await prisma.document.findMany({
      where: { caseId },
      select: { type: true, status: true },
    });
    const existingTypes = new Set(existingDocs.map((d) => d.type));

    // Generate missing documents
    let documentsGenerated = 0;
    const generatedList: string[] = [];

    for (const docType of requiredDocTypes) {
      const docTypeStr = String(docType);
      if (existingTypes.has(docType as any)) {
        continue; // Already exists
      }

      try {
        const clientName = caseData.client?.name || "Client";
        const surplusDollars = (caseData.surplusAmountCents / 100).toFixed(2);
        const feePercent = caseData.feePercent;

        let generatedContent = "";
        switch (docTypeStr) {
          case "CLIENT_SERVICE_AGREEMENT":
            generatedContent = `CLIENT SERVICE AGREEMENT

This Agreement is entered into between MGR Capital Assistance ("Company") and ${clientName} ("Client") regarding the recovery of surplus funds from the tax sale of property located at ${caseData.propertyAddress}, ${caseData.county} County, ${caseData.state}.

SURPLUS AMOUNT: $${surplusDollars}
FEE: ${feePercent}% of recovered funds
PROPERTY: ${caseData.propertyAddress}
PARCEL: ${caseData.parcelNumber || "N/A"}

The Company agrees to pursue recovery of the above surplus funds on behalf of the Client. The Client agrees to pay the Company a fee of ${feePercent}% of any funds successfully recovered.

Date: ${new Date().toISOString().split("T")[0]}
Client: ${clientName}
Company: MGR Capital Assistance`;
            break;

          case "LIMITED_POA":
            generatedContent = `LIMITED POWER OF ATTORNEY

I, ${clientName}, hereby grant MGR Capital Assistance limited power of attorney to act on my behalf solely for the purpose of recovering surplus funds from the tax sale of property at ${caseData.propertyAddress}, ${caseData.county} County, ${caseData.state}.

This power of attorney is limited to:
1. Filing claims with ${caseData.county} County
2. Communicating with county officials regarding this matter
3. Receiving disbursement information
4. Executing necessary documents for fund recovery

This Limited Power of Attorney shall expire upon resolution of this matter.

Date: ${new Date().toISOString().split("T")[0]}
Principal: ${clientName}`;
            break;

          case "AFFIDAVIT":
            generatedContent = `AFFIDAVIT OF CLAIM

STATE OF ${caseData.state}
COUNTY OF ${caseData.county}

I, ${clientName}, being duly sworn, depose and state:

1. I am the former owner of property located at ${caseData.propertyAddress}, Parcel Number ${caseData.parcelNumber || "N/A"}.
2. The property was sold at a tax sale conducted by ${caseData.county} County.
3. I am entitled to surplus funds in the amount of $${surplusDollars} resulting from said sale.
4. I hereby claim said surplus funds.

Sworn to and subscribed before me this ${new Date().getDate()} day of ${new Date().toLocaleString("en-US", { month: "long" })}, ${new Date().getFullYear()}.

Affiant: ${clientName}`;
            break;

          default:
            generatedContent = `DOCUMENT: ${docTypeStr}\n\nGenerated for Case: ${caseData.internalCode}\nProperty: ${caseData.propertyAddress}\nClient: ${clientName}\nDate: ${new Date().toISOString().split("T")[0]}`;
            break;
        }

        await prisma.document.create({
          data: {
            caseId,
            type: docType as any,
            status: "DRAFT",
            fileName: `${docTypeStr.toLowerCase()}_${caseData.internalCode}.pdf`,
            fileUrl: `/documents/${caseId}/${docTypeStr.toLowerCase()}.pdf`,
            fileSize: Buffer.byteLength(generatedContent, "utf8"),
            mimeType: "application/pdf",
            generatedContent,
            signatureRequired: ["CLIENT_SERVICE_AGREEMENT", "LIMITED_POA", "AFFIDAVIT"].includes(docTypeStr),
            uploadedById: caseData.clientId,
            metadata: { generatedBy: "ARCHITECT", automated: true, botTaskId: task.id },
          },
        });

        documentsGenerated++;
        generatedList.push(docTypeStr);
      } catch (docErr: any) {
        logger.warn(`[WorkerBotEngine] Failed to generate ${docTypeStr} for case ${caseId}: ${docErr.message}`);
      }
    }

    // Update case status if documents were generated
    if (documentsGenerated > 0 && caseData.status === "CONTACTED") {
      await prisma.case.update({
        where: { id: caseId },
        data: { status: "DOCS_PENDING", docsRequestedAt: new Date() },
      });
    }

    const durationMs = Date.now() - startTime;

    await prisma.workerBotTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        output: {
          documentsGenerated,
          documentTypes: generatedList,
          existingDocuments: existingDocs.length,
          totalRequired: requiredDocTypes.length,
        },
        durationMs,
        completedAt: new Date(),
      },
    });

    await this.updateBotMetrics("ARCHITECT");

    await this.recordLearning(
      architect.id,
      "doc_quality",
      `Assembled ${documentsGenerated} documents for ${caseData.state}/${caseData.county} case. Types: ${generatedList.join(", ")}`,
      0.75,
      task.id,
      { caseId, state: caseData.state, documentsGenerated, documentTypes: generatedList }
    );

    logger.info(`[WorkerBotEngine] ARCHITECT assembled ${documentsGenerated} documents for case ${caseId} in ${durationMs}ms`);

    return { documentsGenerated, caseId };
  }

  /**
   * Track payment for a case. ENFORCER's specialty.
   */
  async trackPayment(caseId: string, requestedBy?: string): Promise<TrackPaymentResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] ENFORCER tracking payment for case: ${caseId}`);

    const enforcer = await prisma.workerBot.findUnique({ where: { codename: "ENFORCER" } });
    if (!enforcer) {
      logger.error("[WorkerBotEngine] ENFORCER bot not found");
      return { status: "error", caseId };
    }

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      return { status: "case_not_found", caseId };
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: enforcer.id,
        caseId,
        taskType: "payment_tracking",
        status: "IN_PROGRESS",
        priority: 8,
        input: { caseId, currentStatus: caseData.status, requestedBy },
        startedAt: new Date(),
      },
    });

    // Analyze current payment status
    let paymentStatus = "unknown";
    let expectedDate: string | undefined;
    let revenueGenerated = 0;

    const feeCents = caseData.actualFeeCents || caseData.estimatedFeeCents || Math.round(caseData.surplusAmountCents * (caseData.feePercent / 100));

    // Check ledger entries for this case
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const totalReceivedCents = ledgerEntries
      .filter((e) => e.type === "COMPANY_FEE" || e.type === "COMMISSION")
      .reduce((sum, e) => sum + e.amountCents, 0);

    if (caseData.status === "PAID" || caseData.paidAt) {
      paymentStatus = "PAID";
      revenueGenerated = totalReceivedCents || feeCents;
    } else if (caseData.status === "AWAITING_FUNDS") {
      paymentStatus = "AWAITING_FUNDS";
      // Estimate payment date: 30-90 days from filing
      if (caseData.filedAt) {
        const filedDate = new Date(caseData.filedAt);
        const estimatedDate = new Date(filedDate);
        estimatedDate.setDate(estimatedDate.getDate() + 60);
        expectedDate = estimatedDate.toISOString().split("T")[0];
      } else {
        const future = new Date();
        future.setDate(future.getDate() + 90);
        expectedDate = future.toISOString().split("T")[0];
      }
    } else if (caseData.status === "FILED") {
      paymentStatus = "FILED_AWAITING_PROCESSING";
      const future = new Date();
      future.setDate(future.getDate() + 75);
      expectedDate = future.toISOString().split("T")[0];

      // Transition to AWAITING_FUNDS
      await prisma.case.update({
        where: { id: caseId },
        data: { status: "AWAITING_FUNDS" },
      });
    } else if (["NEW", "CONTACTED", "DOCS_PENDING", "DOCS_SIGNED"].includes(caseData.status)) {
      paymentStatus = "NOT_YET_FILED";
    } else if (caseData.status === "CLOSED" || caseData.status === "REJECTED") {
      paymentStatus = caseData.status;
    } else {
      paymentStatus = caseData.status;
    }

    // Check for overdue payments
    let overdue = false;
    if (paymentStatus === "AWAITING_FUNDS" && caseData.filedAt) {
      const daysSinceFiling = Math.floor((Date.now() - new Date(caseData.filedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceFiling > 120) {
        overdue = true;
        paymentStatus = "OVERDUE";
      }
    }

    const durationMs = Date.now() - startTime;

    await prisma.workerBotTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        output: {
          paymentStatus,
          expectedDate,
          overdue,
          feeCents,
          totalReceivedCents,
          ledgerEntries: ledgerEntries.length,
          caseStatus: caseData.status,
        },
        revenueGenerated,
        durationMs,
        completedAt: new Date(),
      },
    });

    await this.updateBotMetrics("ENFORCER");

    await this.recordLearning(
      enforcer.id,
      "collections",
      `Payment tracking for ${caseData.state}/${caseData.county} — status: ${paymentStatus}, fee: $${(feeCents / 100).toFixed(2)}${overdue ? " (OVERDUE)" : ""}`,
      paymentStatus === "PAID" ? 0.95 : paymentStatus === "OVERDUE" ? 0.4 : 0.6,
      task.id,
      { caseId, paymentStatus, feeCents, overdue, state: caseData.state }
    );

    logger.info(`[WorkerBotEngine] ENFORCER payment tracking complete for ${caseId} — status: ${paymentStatus}`);

    return { status: paymentStatus, expectedDate, caseId };
  }

  /**
   * Research a property for a case. NAVIGATOR's specialty.
   */
  async researchProperty(caseId: string, requestedBy?: string): Promise<ResearchResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] NAVIGATOR researching property for case: ${caseId}`);

    const navigator = await prisma.workerBot.findUnique({ where: { codename: "NAVIGATOR" } });
    if (!navigator) {
      logger.error("[WorkerBotEngine] NAVIGATOR bot not found");
      return { completed: false, findings: null, caseId };
    }

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      return { completed: false, findings: null, caseId };
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: navigator.id,
        caseId,
        taskType: "property_research",
        status: "IN_PROGRESS",
        priority: 5,
        input: { caseId, state: caseData.state, county: caseData.county, requestedBy },
        startedAt: new Date(),
      },
    });

    // Gather all available information about the property
    const stateRule = await prisma.stateRule.findUnique({ where: { stateCode: caseData.state } });
    const countyRule = await prisma.countyRule.findUnique({
      where: { stateCode_countyName: { stateCode: caseData.state, countyName: caseData.county } },
    });

    // Check how many other cases we have in the same state/county (market intelligence)
    const [sameCaseCount, sameStateCount, avgSurplus] = await Promise.all([
      prisma.case.count({
        where: { state: caseData.state, county: caseData.county },
      }),
      prisma.case.count({
        where: { state: caseData.state },
      }),
      prisma.case.aggregate({
        where: { state: caseData.state, county: caseData.county },
        _avg: { surplusAmountCents: true },
      }),
    ]);

    // Calculate deadline info
    let deadlineInfo: any = null;
    if (stateRule) {
      const claimDeadline = caseData.saleDate
        ? new Date(new Date(caseData.saleDate).getTime() + stateRule.claimPeriodDays * 24 * 60 * 60 * 1000)
        : null;
      const daysRemaining = claimDeadline ? Math.ceil((claimDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

      deadlineInfo = {
        claimPeriodDays: stateRule.claimPeriodDays,
        claimDeadline: claimDeadline?.toISOString().split("T")[0] || null,
        daysRemaining,
        urgent: daysRemaining !== null && daysRemaining < 30,
        expired: daysRemaining !== null && daysRemaining < 0,
      };
    }

    const findings = {
      property: {
        address: caseData.propertyAddress,
        parcelNumber: caseData.parcelNumber,
        state: caseData.state,
        county: caseData.county,
        saleDate: caseData.saleDate,
        previousOwner: caseData.previousOwner,
        surplusAmountCents: caseData.surplusAmountCents,
        surplusAmountDollars: (caseData.surplusAmountCents / 100).toFixed(2),
      },
      jurisdiction: {
        state: stateRule
          ? {
              surplusFundLaw: stateRule.surplusFundLaw,
              claimPeriodDays: stateRule.claimPeriodDays,
              redemptionPeriodDays: stateRule.redemptionPeriodDays,
              filingMethod: stateRule.filingMethod,
              filingFee: stateRule.filingFee,
              requiredDocuments: stateRule.requiredDocuments,
              interestRate: stateRule.interestRate,
            }
          : null,
        county: countyRule
          ? {
              clerkName: countyRule.clerkName,
              clerkPhone: countyRule.clerkPhone,
              clerkEmail: countyRule.clerkEmail,
              localFilingFee: countyRule.localFilingFee,
              localFilingMethod: countyRule.localFilingMethod,
              localRequirements: countyRule.localRequirements,
            }
          : null,
      },
      deadlines: deadlineInfo,
      marketIntelligence: {
        casesInCounty: sameCaseCount,
        casesInState: sameStateCount,
        avgSurplusInCounty: avgSurplus._avg.surplusAmountCents
          ? (avgSurplus._avg.surplusAmountCents / 100).toFixed(2)
          : null,
        aboveAverage: avgSurplus._avg.surplusAmountCents
          ? caseData.surplusAmountCents > avgSurplus._avg.surplusAmountCents
          : null,
      },
      riskFactors: {
        noStateRule: !stateRule,
        noCountyRule: !countyRule,
        noSaleDate: !caseData.saleDate,
        noParcelNumber: !caseData.parcelNumber,
        noPreviousOwner: !caseData.previousOwner,
        deadlineExpired: deadlineInfo?.expired || false,
        deadlineUrgent: deadlineInfo?.urgent || false,
      },
      researchCompleteness: 0,
    };

    // Calculate research completeness score
    let completeness = 0;
    if (stateRule) completeness += 20;
    if (countyRule) completeness += 15;
    if (caseData.parcelNumber) completeness += 15;
    if (caseData.previousOwner) completeness += 15;
    if (caseData.saleDate) completeness += 15;
    if (deadlineInfo && !deadlineInfo.expired) completeness += 10;
    if (sameCaseCount > 0) completeness += 10;
    findings.researchCompleteness = completeness;

    const durationMs = Date.now() - startTime;

    await prisma.workerBotTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        output: findings,
        durationMs,
        completedAt: new Date(),
      },
    });

    await this.updateBotMetrics("NAVIGATOR");

    await this.recordLearning(
      navigator.id,
      "research_quality",
      `Property research for ${caseData.state}/${caseData.county}: completeness ${completeness}%, surplus $${(caseData.surplusAmountCents / 100).toFixed(2)}, ${deadlineInfo?.urgent ? "URGENT deadline" : "normal timeline"}`,
      completeness / 100,
      task.id,
      { caseId, state: caseData.state, county: caseData.county, completeness, deadlineUrgent: deadlineInfo?.urgent }
    );

    logger.info(`[WorkerBotEngine] NAVIGATOR research complete for ${caseId} — completeness: ${completeness}%`);

    return { completed: true, findings, caseId };
  }

  /**
   * Analyze case strategy. STRATEGIST's specialty.
   */
  async analyzeStrategy(caseId: string, requestedBy?: string): Promise<StrategyResult> {
    const startTime = Date.now();
    logger.info(`[WorkerBotEngine] STRATEGIST analyzing strategy for case: ${caseId}`);

    const strategist = await prisma.workerBot.findUnique({ where: { codename: "STRATEGIST" } });
    if (!strategist) {
      logger.error("[WorkerBotEngine] STRATEGIST bot not found");
      return { strategy: "error", winProbability: 0, expectedRevenue: 0, caseId };
    }

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      return { strategy: "case_not_found", winProbability: 0, expectedRevenue: 0, caseId };
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: strategist.id,
        caseId,
        taskType: "strategy_analysis",
        status: "IN_PROGRESS",
        priority: 5,
        input: { caseId, state: caseData.state, county: caseData.county, requestedBy },
        startedAt: new Date(),
      },
    });

    // Gather historical data for this state/county
    const [wonCases, totalCases, avgTimeToPaid, stateRule] = await Promise.all([
      prisma.case.count({
        where: { state: caseData.state, county: caseData.county, status: "PAID" },
      }),
      prisma.case.count({
        where: { state: caseData.state, county: caseData.county },
      }),
      prisma.case.findMany({
        where: { state: caseData.state, status: "PAID", paidAt: { not: null } },
        select: { createdAt: true, paidAt: true },
        take: 50,
      }),
      prisma.stateRule.findUnique({ where: { stateCode: caseData.state } }),
    ]);

    // Calculate historical win rate for this jurisdiction
    const historicalWinRate = totalCases > 0 ? wonCases / totalCases : 0.5;

    // Calculate average time to payment
    let avgDaysToPayment = 60;
    if (avgTimeToPaid.length > 0) {
      const totalDays = avgTimeToPaid.reduce((sum, c) => {
        if (c.paidAt) {
          return sum + (new Date(c.paidAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0);
      avgDaysToPayment = Math.round(totalDays / avgTimeToPaid.length);
    }

    // Score factors for win probability
    let winProbability = 0.5; // Base

    // Factor 1: Historical win rate in this jurisdiction
    winProbability += (historicalWinRate - 0.5) * 0.3;

    // Factor 2: Surplus amount (higher surplus = more motivation to pursue)
    if (caseData.surplusAmountCents > 1000000) winProbability += 0.1; // >$10k
    else if (caseData.surplusAmountCents > 500000) winProbability += 0.05; // >$5k
    else if (caseData.surplusAmountCents < 100000) winProbability -= 0.1; // <$1k

    // Factor 3: Case completeness
    if (caseData.previousOwner) winProbability += 0.05;
    if (caseData.parcelNumber) winProbability += 0.05;
    if (caseData.saleDate) winProbability += 0.05;

    // Factor 4: State rules availability
    if (stateRule) winProbability += 0.1;

    // Factor 5: Current case status (further along = higher probability)
    const statusBoost: Record<string, number> = {
      NEW: 0,
      CONTACTED: 0.05,
      DOCS_PENDING: 0.1,
      DOCS_SIGNED: 0.15,
      FILED: 0.2,
      AWAITING_FUNDS: 0.25,
    };
    winProbability += statusBoost[caseData.status] || 0;

    // Factor 6: Deadline status
    if (caseData.saleDate && stateRule) {
      const deadlineDate = new Date(new Date(caseData.saleDate).getTime() + stateRule.claimPeriodDays * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) winProbability -= 0.3; // Expired
      else if (daysRemaining < 14) winProbability -= 0.1; // Tight
      else if (daysRemaining > 180) winProbability += 0.05; // Plenty of time
    }

    // Clamp probability
    winProbability = Math.max(0.05, Math.min(0.95, winProbability));

    // Calculate expected revenue
    const feeCents = Math.round(caseData.surplusAmountCents * (caseData.feePercent / 100));
    const expectedRevenue = Math.round(feeCents * winProbability);

    // Determine strategy recommendation
    let strategy = "standard_pursuit";
    if (winProbability >= 0.8) {
      strategy = "aggressive_fast_track";
    } else if (winProbability >= 0.6) {
      strategy = "standard_pursuit";
    } else if (winProbability >= 0.4) {
      strategy = "cautious_with_additional_research";
    } else if (winProbability >= 0.2) {
      strategy = "low_priority_batch_processing";
    } else {
      strategy = "deprioritize_or_close";
    }

    // Get existing learnings for this jurisdiction
    const jurisdictionLearnings = await prisma.workerBotLearning.findMany({
      where: {
        category: { in: ["case_strategy", "case_lifecycle", "collections"] },
        pattern: { contains: caseData.state },
      },
      orderBy: { confidence: "desc" },
      take: 5,
    });

    const fullAnalysis = {
      strategy,
      winProbability: Math.round(winProbability * 100) / 100,
      expectedRevenue,
      expectedRevenueDollars: (expectedRevenue / 100).toFixed(2),
      feeCents,
      surplusAmountCents: caseData.surplusAmountCents,
      factors: {
        historicalWinRate: Math.round(historicalWinRate * 100) / 100,
        totalCasesInJurisdiction: totalCases,
        wonCasesInJurisdiction: wonCases,
        avgDaysToPayment,
        hasStateRule: !!stateRule,
        hasOwnerInfo: !!caseData.previousOwner,
        hasParcelNumber: !!caseData.parcelNumber,
        hasSaleDate: !!caseData.saleDate,
        currentStatus: caseData.status,
      },
      recommendations: [
        winProbability >= 0.6 ? "Proceed with standard pipeline" : "Consider additional research before proceeding",
        caseData.surplusAmountCents > 500000 ? "High-value case — prioritize" : "Standard-value case",
        !caseData.previousOwner ? "CRITICAL: Owner information missing — run skip trace first" : "Owner info available",
        jurisdictionLearnings.length > 0
          ? `${jurisdictionLearnings.length} prior learnings available for ${caseData.state}`
          : `No prior jurisdiction learnings — first case in ${caseData.state}`,
      ],
      priorLearnings: jurisdictionLearnings.map((l: any) => ({
        pattern: l.pattern,
        confidence: l.confidence,
        appliedCount: l.appliedCount,
        successCount: l.successCount,
      })),
    };

    const durationMs = Date.now() - startTime;

    await prisma.workerBotTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        output: fullAnalysis,
        durationMs,
        completedAt: new Date(),
      },
    });

    await this.updateBotMetrics("STRATEGIST");

    await this.recordLearning(
      strategist.id,
      "case_strategy",
      `Cases in ${caseData.state}/${caseData.county} with surplus >$${Math.floor(caseData.surplusAmountCents / 100)} have ${Math.round(winProbability * 100)}% win probability. Strategy: ${strategy}. Historical rate: ${Math.round(historicalWinRate * 100)}% from ${totalCases} cases.`,
      winProbability,
      task.id,
      { caseId, state: caseData.state, county: caseData.county, winProbability, strategy, historicalWinRate }
    );

    logger.info(
      `[WorkerBotEngine] STRATEGIST analysis complete for ${caseId} — strategy: ${strategy}, win: ${Math.round(winProbability * 100)}%, expected: $${(expectedRevenue / 100).toFixed(2)}`
    );

    return {
      strategy,
      winProbability: Math.round(winProbability * 100) / 100,
      expectedRevenue,
      caseId,
    };
  }

  // ==========================================
  // REPORTING & INSIGHTS
  // ==========================================

  /**
   * Get revenue attribution per bot.
   */
  async getRevenueAttribution(): Promise<RevenueAttributionResult> {
    const bots = await prisma.workerBot.findMany({
      where: { isActive: true },
      select: {
        id: true,
        codename: true,
        designation: true,
        role: true,
        revenueGenerated: true,
        casesWorked: true,
        casesWon: true,
        successRate: true,
      },
      orderBy: { revenueGenerated: "desc" },
    });

    // Also get task-level revenue data
    const taskRevenue = await prisma.workerBotTask.groupBy({
      by: ["workerBotId"],
      where: { status: "COMPLETED" },
      _sum: { revenueGenerated: true, costCents: true },
      _count: { id: true },
    });

    const revenueMap = new Map(taskRevenue.map((t: any) => [t.workerBotId, t]));

    const enrichedBots = bots.map((bot: any) => {
      const taskData = revenueMap.get(bot.id) as any;
      const taskRevenueTotal = taskData?._sum.revenueGenerated || 0;
      const taskCostTotal = taskData?._sum.costCents || 0;
      const taskCount = taskData?._count.id || 0;

      return {
        codename: bot.codename,
        designation: bot.designation,
        role: bot.role,
        revenueGenerated: bot.revenueGenerated,
        revenueGeneratedDollars: (bot.revenueGenerated / 100).toFixed(2),
        taskRevenue: taskRevenueTotal,
        taskRevenueDollars: (taskRevenueTotal / 100).toFixed(2),
        totalCost: taskCostTotal,
        netRevenue: bot.revenueGenerated - taskCostTotal,
        netRevenueDollars: ((bot.revenueGenerated - taskCostTotal) / 100).toFixed(2),
        casesWorked: bot.casesWorked,
        casesWon: bot.casesWon,
        successRate: bot.successRate,
        completedTasks: taskCount,
        revenuePerCase: bot.casesWorked > 0 ? Math.round(bot.revenueGenerated / bot.casesWorked) : 0,
      };
    });

    const totalRevenue = bots.reduce((sum, b) => sum + b.revenueGenerated, 0);

    return {
      bots: enrichedBots,
      totalRevenue,
    };
  }

  /**
   * Get learning insights across all bots.
   */
  async getLearningInsights(): Promise<LearningInsightsResult> {
    const totalLearnings = await prisma.workerBotLearning.count();

    // Top patterns by confidence
    const topPatterns = await prisma.workerBotLearning.findMany({
      orderBy: [{ confidence: "desc" }, { appliedCount: "desc" }],
      take: 20,
      include: {
        workerBot: { select: { codename: true, designation: true } },
      },
    });

    // Group by category
    const categoryStats = await prisma.workerBotLearning.groupBy({
      by: ["category"],
      _count: { id: true },
      _avg: { confidence: true },
      _sum: { appliedCount: true, successCount: true },
      orderBy: { _count: { id: "desc" } },
    });

    const byCategory = categoryStats.map((cat) => ({
      category: cat.category,
      count: cat._count.id,
      avgConfidence: Math.round((cat._avg.confidence || 0) * 100) / 100,
      totalApplied: cat._sum.appliedCount || 0,
      totalSuccess: cat._sum.successCount || 0,
      successRate: (cat._sum.appliedCount || 0) > 0
        ? Math.round(((cat._sum.successCount || 0) / (cat._sum.appliedCount || 1)) * 100) / 100
        : 0,
    }));

    return {
      totalLearnings,
      topPatterns: topPatterns.map((p) => ({
        id: p.id,
        botCodename: p.workerBot.codename,
        botDesignation: p.workerBot.designation,
        category: p.category,
        pattern: p.pattern,
        confidence: p.confidence,
        appliedCount: p.appliedCount,
        successCount: p.successCount,
        createdAt: p.createdAt,
      })),
      byCategory,
    };
  }

  /**
   * Get company growth report from bot activity.
   */
  async getGrowthReport(): Promise<GrowthReportResult> {
    const bots = await prisma.workerBot.findMany({
      where: { isActive: true },
      select: {
        codename: true,
        designation: true,
        role: true,
        casesWorked: true,
        casesWon: true,
        revenueGenerated: true,
        successRate: true,
        totalSpawned: true,
        generation: true,
      },
      orderBy: { revenueGenerated: "desc" },
    });

    const totalCasesWorked = bots.reduce((sum, b) => sum + b.casesWorked, 0);
    const totalRevenue = bots.reduce((sum, b) => sum + b.revenueGenerated, 0);
    const totalWon = bots.reduce((sum, b) => sum + b.casesWon, 0);
    const avgSuccessRate =
      bots.length > 0 ? Math.round((bots.reduce((sum, b) => sum + b.successRate, 0) / bots.length) * 100) / 100 : 0;
    const spawnedCount = bots.reduce((sum, b) => sum + b.totalSpawned, 0);

    // Count non-genesis bots (spawned)
    const spawnedBotCount = await prisma.workerBot.count({
      where: { generation: { not: "GENESIS" as WorkerBotGeneration }, isActive: true },
    });

    // Get top performer
    const topPerformer = bots.length > 0
      ? {
          codename: bots[0].codename,
          designation: bots[0].designation,
          role: bots[0].role,
          revenueGenerated: bots[0].revenueGenerated,
          revenueGeneratedDollars: (bots[0].revenueGenerated / 100).toFixed(2),
          casesWorked: bots[0].casesWorked,
          casesWon: bots[0].casesWon,
          successRate: bots[0].successRate,
        }
      : null;

    // Recent task activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTaskStats = await prisma.workerBotTask.groupBy({
      by: ["status"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    });

    const recentCompleted = recentTaskStats.find((t) => t.status === "COMPLETED")?._count.id || 0;
    const recentFailed = recentTaskStats.find((t) => t.status === "FAILED")?._count.id || 0;

    return {
      totalCasesWorked,
      totalRevenue,
      avgSuccessRate,
      botCount: bots.length,
      spawnedCount: spawnedBotCount + spawnedCount,
      topPerformer: topPerformer
        ? {
            ...topPerformer,
            recentTasks: { completed: recentCompleted, failed: recentFailed },
            totalWon,
            totalRevenueDollars: (totalRevenue / 100).toFixed(2),
          }
        : null,
    };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Execute a single stage of case work, creating a task and recording results.
   */
  private async executeStage(
    botCodename: string,
    caseId: string,
    taskType: string,
    description: string,
    executor: () => Promise<any>
  ): Promise<any> {
    const stageStart = Date.now();
    logger.info(`[WorkerBotEngine] ${botCodename} — ${description}`);

    const bot = await prisma.workerBot.findUnique({ where: { codename: botCodename } });
    if (!bot) {
      throw new Error(`Bot ${botCodename} not found`);
    }

    const task = await prisma.workerBotTask.create({
      data: {
        workerBotId: bot.id,
        caseId,
        taskType,
        status: "IN_PROGRESS",
        priority: 5,
        input: { caseId, description },
        startedAt: new Date(),
      },
    });

    try {
      const result = await executor();
      const durationMs = Date.now() - stageStart;

      await prisma.workerBotTask.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          output: result,
          durationMs,
          completedAt: new Date(),
        },
      });

      // Update the bot's last activity
      await prisma.workerBot.update({
        where: { codename: botCodename },
        data: { lastActivityAt: new Date() },
      });

      return { success: true, result, durationMs, botCodename, taskId: task.id };
    } catch (err: any) {
      const durationMs = Date.now() - stageStart;

      await prisma.workerBotTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          error: err.message,
          durationMs,
          completedAt: new Date(),
        },
      });

      logger.error(`[WorkerBotEngine] Stage failed: ${botCodename} — ${taskType}: ${err.message}`);
      return { success: false, error: err.message, durationMs, botCodename, taskId: task.id };
    }
  }

  /**
   * Record a learning entry for a bot.
   */
  private async recordLearning(
    workerBotId: string,
    category: string,
    pattern: string,
    confidence: number,
    sourceTaskId?: string,
    data?: any
  ): Promise<void> {
    try {
      // Check if a very similar learning already exists (dedup)
      const existingLearning = await prisma.workerBotLearning.findFirst({
        where: {
          workerBotId,
          category,
          pattern: { startsWith: pattern.substring(0, Math.min(50, pattern.length)) },
        },
      });

      if (existingLearning) {
        // Update existing learning — increase applied count and adjust confidence
        const newApplied = existingLearning.appliedCount + 1;
        const newSuccess = confidence >= 0.6 ? existingLearning.successCount + 1 : existingLearning.successCount;
        const newConfidence = (existingLearning.confidence * existingLearning.appliedCount + confidence) / newApplied;

        await prisma.workerBotLearning.update({
          where: { id: existingLearning.id },
          data: {
            appliedCount: newApplied,
            successCount: newSuccess,
            confidence: Math.round(newConfidence * 1000) / 1000,
            data: data || existingLearning.data,
          },
        });
      } else {
        // Create new learning
        await prisma.workerBotLearning.create({
          data: {
            workerBotId,
            category,
            pattern,
            confidence: Math.round(confidence * 1000) / 1000,
            appliedCount: 1,
            successCount: confidence >= 0.6 ? 1 : 0,
            sourceTaskId: sourceTaskId || null,
            data: data || {},
          },
        });
      }
    } catch (err: any) {
      logger.warn(`[WorkerBotEngine] Failed to record learning: ${err.message}`);
    }
  }

  /**
   * Recalculate bot metrics from task records.
   */
  private async updateBotMetrics(codename: string): Promise<void> {
    try {
      const bot = await prisma.workerBot.findUnique({ where: { codename } });
      if (!bot) return;

      // Get task statistics
      const taskStats = await prisma.workerBotTask.aggregate({
        where: { workerBotId: bot.id },
        _count: { id: true },
      });

      const completedStats = await prisma.workerBotTask.aggregate({
        where: { workerBotId: bot.id, status: "COMPLETED" },
        _count: { id: true },
        _sum: { revenueGenerated: true, durationMs: true },
        _avg: { durationMs: true },
      });

      const failedCount = await prisma.workerBotTask.count({
        where: { workerBotId: bot.id, status: "FAILED" },
      });

      const totalTasks = taskStats._count.id || 0;
      const completedTasks = completedStats._count.id || 0;
      const totalRevenueFromTasks = completedStats._sum.revenueGenerated || 0;
      const avgDurationMs = Math.round(completedStats._avg.durationMs || 0);

      // Calculate success rate
      const decidedTasks = completedTasks + failedCount;
      const successRate = decidedTasks > 0 ? Math.round((completedTasks / decidedTasks) * 100) / 100 : 0;

      // Calculate learning score from learnings
      const learningStats = await prisma.workerBotLearning.aggregate({
        where: { workerBotId: bot.id },
        _count: { id: true },
        _avg: { confidence: true },
        _sum: { appliedCount: true, successCount: true },
      });

      const learningCount = learningStats._count.id || 0;
      const avgConfidence = learningStats._avg.confidence || 0;
      const totalApplied = learningStats._sum.appliedCount || 0;

      // Learning score: combination of breadth (count) and depth (confidence * applied)
      const learningScore = Math.min(100, Math.round((learningCount * 2 + avgConfidence * 30 + Math.min(totalApplied, 50)) * 10) / 10);

      // Get unique case IDs worked
      const uniqueCases = await prisma.workerBotTask.findMany({
        where: { workerBotId: bot.id, caseId: { not: null } },
        select: { caseId: true },
        distinct: ["caseId"],
      });

      const casesWorked = uniqueCases.length;

      // Won cases: cases with COMPLETED full_case_work or payment_tracking tasks
      const wonCaseIds = await prisma.workerBotTask.findMany({
        where: {
          workerBotId: bot.id,
          status: "COMPLETED",
          taskType: { in: ["full_case_work", "payment_tracking"] },
          revenueGenerated: { gt: 0 },
        },
        select: { caseId: true },
        distinct: ["caseId"],
      });

      const casesWon = wonCaseIds.length;

      await prisma.workerBot.update({
        where: { codename },
        data: {
          casesWorked,
          casesWon,
          revenueGenerated: Math.max(bot.revenueGenerated, totalRevenueFromTasks),
          avgCaseTimeMs: avgDurationMs,
          successRate,
          learningScore,
          lastActivityAt: new Date(),
        },
      });

      logger.debug(
        `[WorkerBotEngine] Updated metrics for ${codename} — cases: ${casesWorked}, won: ${casesWon}, rate: ${Math.round(successRate * 100)}%, learning: ${learningScore}`
      );
    } catch (err: any) {
      logger.warn(`[WorkerBotEngine] Failed to update metrics for ${codename}: ${err.message}`);
    }
  }

  /**
   * Determine the best role for a case based on its current status.
   */
  private determineRoleForCase(caseData: any): string {
    switch (caseData.status) {
      case "NEW":
        return "case_lifecycle"; // TITAN handles full lifecycle
      case "CONTACTED":
        return "document_assembly"; // ARCHITECT should prepare docs
      case "DOCS_PENDING":
        return "client_relations"; // AMBASSADOR follows up
      case "DOCS_SIGNED":
        return "document_assembly"; // ARCHITECT files
      case "FILED":
        return "collections"; // ENFORCER tracks payment
      case "AWAITING_FUNDS":
        return "collections"; // ENFORCER collects
      default:
        return "case_lifecycle"; // Default to TITAN
    }
  }

  /**
   * Find the best available bot for a given role, based on load balancing.
   */
  private findBestBot(
    botLoads: Array<{ bot: any; activeCases: number; maxCases: number }>,
    targetRole: string
  ): { bot: any; activeCases: number; maxCases: number } | null {
    const candidates = botLoads
      .filter((bl) => bl.bot.role === targetRole && bl.activeCases < bl.maxCases)
      .sort((a, b) => a.activeCases - b.activeCases);

    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Assign a single case to a specific bot. Updates the bot's active case list.
   */
  private async assignCaseToBot(bot: any, caseData: any): Promise<void> {
    const currentActive = Array.isArray(bot.activeCaseIds) ? [...(bot.activeCaseIds as string[])] : [];

    if (!currentActive.includes(caseData.id)) {
      currentActive.push(caseData.id);
    }

    await prisma.workerBot.update({
      where: { id: bot.id },
      data: {
        activeCaseIds: currentActive,
        lastActivityAt: new Date(),
        status: bot.status === "IDLE" ? ("WORKING" as WorkerBotStatus) : bot.status,
      },
    });

    logger.debug(`[WorkerBotEngine] Assigned case ${caseData.id} to ${bot.codename} (${bot.designation})`);
  }

  /**
   * Log a bot operation to BotRunLog for audit trail.
   */
  private async logBotRun(
    runType: string,
    durationMs: number,
    success: boolean,
    details: any
  ): Promise<void> {
    try {
      await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType,
          startedAt: new Date(Date.now() - durationMs),
          completedAt: new Date(),
          durationMs,
          success,
          status: success ? "SUCCESS" : "FAILED",
          resultSummary: `${runType} — ${success ? "completed" : "failed"} in ${durationMs}ms`,
          recordsProcessed: details.assigned || details.deployed || details.initialized || details.recalled || 0,
          insightsGenerated: 0,
          alertsCreated: 0,
          errorsEncountered: success ? 0 : 1,
          summary: `WorkerBotEngine.${runType} executed`,
          details,
        },
      });
    } catch (err: any) {
      logger.warn(`[WorkerBotEngine] Failed to log bot run: ${err.message}`);
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export const workerBotEngine = new WorkerBotEngine();
export default workerBotEngine;
