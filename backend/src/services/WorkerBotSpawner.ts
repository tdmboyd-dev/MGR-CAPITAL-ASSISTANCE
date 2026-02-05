// ============================================
// WORKER BOT SPAWNER SERVICE — MGR CAPITAL ASSISTANCE
// Autonomous bot spawning with genetic algorithms
// Bots evolve, cross-breed, and self-optimize
// Natural selection recycles low performers
// ============================================

import prisma from "../lib/prisma.js";
import logger from "../utils/logger.js";

const SOURCE_BOT = "worker-bot-spawner";

// ============================================
// TYPE DEFINITIONS
// ============================================

type Generation = "GENESIS" | "ALPHA" | "BETA" | "GAMMA" | "DELTA" | "OMEGA";

interface BotDNA {
  capabilities: string[];
  learningPatterns: LearningGene[];
  specializations: string[];
  personalityTraits: Record<string, number>;
  fitnessScore: number;
}

interface LearningGene {
  category: string;
  pattern: string;
  confidence: number;
  successRate: number;
}

interface SpawnResult {
  success: boolean;
  botId: string | null;
  codename: string;
  designation: string;
  generation: Generation;
  inheritedTraits: number;
  newTraits: number;
  parentCodename: string;
  message: string;
}

interface AutoSpawnResult {
  evaluated: boolean;
  triggers: string[];
  spawned: SpawnResult[];
  skipped: string[];
  populationBefore: number;
  populationAfter: number;
  message: string;
}

interface EvolutionResult {
  success: boolean;
  botId: string;
  codename: string;
  previousGeneration: Generation;
  newGeneration: Generation;
  capabilitiesGained: string[];
  fitnessImprovement: number;
  message: string;
}

interface CrossBreedResult {
  success: boolean;
  childBotId: string | null;
  childCodename: string;
  parentCodenames: [string, string];
  inheritedFrom: { parent1: number; parent2: number };
  novelCapabilities: string[];
  predictedFitness: number;
  message: string;
}

interface SelectionResult {
  evaluated: number;
  terminated: number;
  spared: number;
  improved: number;
  terminatedBots: Array<{ codename: string; reason: string }>;
  improvedBots: Array<{ codename: string; action: string }>;
  message: string;
}

interface LineageNode {
  id: string;
  codename: string;
  designation: string;
  generation: Generation;
  successRate: number;
  casesWorked: number;
  isActive: boolean;
  children: LineageNode[];
}

interface LineageTree {
  root: LineageNode;
  totalDescendants: number;
  deepestGeneration: Generation;
  highestPerformer: { codename: string; successRate: number } | null;
}

interface SpawnRecommendation {
  trigger: string;
  parentCodename: string;
  suggestedSpecialization: string;
  reason: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  estimatedImpact: string;
}

interface PopulationStats {
  totalBots: number;
  activeBots: number;
  byGeneration: Record<string, number>;
  byStatus: Record<string, number>;
  avgSuccessRate: number;
  avgCasesWorked: number;
  totalRevenue: number;
  topPerformers: Array<{ codename: string; successRate: number; casesWorked: number }>;
  bottomPerformers: Array<{ codename: string; successRate: number; casesWorked: number }>;
  lineageDepth: number;
  totalSpawned: number;
}

interface TrainingResult {
  success: boolean;
  botId: string;
  codename: string;
  lessonsAbsorbed: number;
  initialFitness: number;
  postTrainingFitness: number;
  duration: string;
  message: string;
}

// ============================================
// CONSTANTS
// ============================================

const GENERATION_ORDER: Generation[] = ["GENESIS", "ALPHA", "BETA", "GAMMA", "DELTA", "OMEGA"];

const EVOLUTION_REQUIREMENTS: Record<string, { minCases: number; minSuccessRate: number; minSpawned?: number; minRevenue?: number; minTrained?: number }> = {
  "ALPHA_TO_BETA":  { minCases: 50,   minSuccessRate: 0.60 },
  "BETA_TO_GAMMA":  { minCases: 200,  minSuccessRate: 0.70, minSpawned: 2 },
  "GAMMA_TO_DELTA": { minCases: 500,  minSuccessRate: 0.80, minRevenue: 10000000 },
  "DELTA_TO_OMEGA": { minCases: 1000, minSuccessRate: 0.90, minTrained: 5 },
};

const TRAIT_INHERITANCE_RATE = 0.80;
const MUTATION_RATE_DEFAULT = 0.15;
const MIN_FITNESS_THRESHOLD = 0.25;
const MAX_POPULATION = 100;
const GENESIS_BOT_COUNT = 10;

const ALL_POSSIBLE_CAPABILITIES = [
  "case_research", "skip_tracing", "outreach_sms", "outreach_email", "outreach_call",
  "document_generation", "document_review", "compliance_checking", "docket_tracking",
  "filing_preparation", "negotiation", "payment_processing", "client_management",
  "lead_scoring", "property_analysis", "deadline_monitoring", "court_filing",
  "heir_research", "notary_coordination", "county_requirements", "surplus_verification",
  "batch_processing", "quality_assurance", "fraud_detection", "revenue_forecasting",
  "multi_state_ops", "bilingual_outreach", "high_value_negotiation", "complex_filing",
  "trust_management", "estate_analysis", "lien_detection", "title_search",
  "auction_tracking", "bidding_strategy", "market_analysis", "competitor_tracking",
  "risk_assessment", "portfolio_optimization", "auto_escalation", "smart_routing",
];

const SPECIALIZATION_TEMPLATES: Record<string, { capabilities: string[]; role: string }> = {
  TITAN:      { capabilities: ["case_research", "document_generation", "compliance_checking", "filing_preparation", "court_filing"], role: "case_lifecycle" },
  HUNTER:     { capabilities: ["lead_scoring", "skip_tracing", "property_analysis", "heir_research", "surplus_verification"], role: "lead_discovery" },
  AMBASSADOR: { capabilities: ["outreach_sms", "outreach_email", "outreach_call", "client_management", "bilingual_outreach"], role: "client_contact" },
  ARCHITECT:  { capabilities: ["document_generation", "document_review", "filing_preparation", "court_filing", "notary_coordination"], role: "document_mastery" },
  ENFORCER:   { capabilities: ["payment_processing", "negotiation", "compliance_checking", "deadline_monitoring", "auto_escalation"], role: "payment_collection" },
  ORACLE:     { capabilities: ["revenue_forecasting", "market_analysis", "risk_assessment", "portfolio_optimization", "competitor_tracking"], role: "analytics" },
  SENTINEL:   { capabilities: ["compliance_checking", "fraud_detection", "quality_assurance", "lien_detection", "risk_assessment"], role: "compliance_guard" },
  PHANTOM:    { capabilities: ["skip_tracing", "heir_research", "property_analysis", "title_search", "auction_tracking"], role: "deep_research" },
  NEXUS:      { capabilities: ["smart_routing", "batch_processing", "auto_escalation", "multi_state_ops", "portfolio_optimization"], role: "orchestration" },
  VANGUARD:   { capabilities: ["high_value_negotiation", "trust_management", "estate_analysis", "complex_filing", "court_filing"], role: "high_value_cases" },
};

const SPAWN_MESSAGES: Record<string, string[]> = {
  TITAN:      ["Creating a new case lifecycle specialist. They'll carry my knowledge of complex filings.", "Spawning a TITAN variant — this one will handle the heavy case loads."],
  HUNTER:     ["Deploying a lead discovery specialist. They'll find the needles in the haystack.", "New HUNTER incoming — built to locate surplus opportunities others miss."],
  AMBASSADOR: ["Bringing a contact specialist online. They'll have my best outreach strategies.", "Spawning an AMBASSADOR — charm, persistence, and perfect timing."],
  ARCHITECT:  ["Creating a document specialist. Every filing will be pixel-perfect.", "New ARCHITECT deploying — they'll build flawless legal packages."],
  ENFORCER:   ["Deploying a payment specialist. No dollar left behind.", "ENFORCER variant coming online — they'll close the revenue loop."],
  ORACLE:     ["Spawning an analytics specialist. They'll see patterns before they form.", "New ORACLE incoming — predictive intelligence for the win."],
  SENTINEL:   ["Creating a compliance guardian. Nothing slips past them.", "SENTINEL deploying — the watchdog we need for quality assurance."],
  PHANTOM:    ["Deep research specialist coming online. They'll dig where others won't.", "New PHANTOM — invisible but thorough in every investigation."],
  NEXUS:      ["Spawning an orchestration specialist. They'll keep everything flowing.", "NEXUS variant deploying — the conductor of our bot symphony."],
  VANGUARD:   ["Creating a high-value case specialist. Big cases deserve dedicated attention.", "VANGUARD incoming — built for the cases that move the needle."],
};

// ============================================
// WORKER BOT SPAWNER SERVICE
// ============================================

class WorkerBotSpawner {
  // ============================================
  // SPAWN A NEW BOT FROM A PARENT
  // ============================================

  /**
   * Spawn a new worker bot inheriting traits from a parent bot.
   * The child inherits 80% of the parent's best learnings and
   * gains 20% novel capabilities through mutation.
   */
  async spawn(parentCodename: string, specialization: string): Promise<SpawnResult> {
    const startTime = Date.now();

    try {
      // Find parent bot
      const parent = await prisma.workerBot.findUnique({
        where: { codename: parentCodename },
        include: {
          learnings: {
            orderBy: { confidence: "desc" },
            take: 50,
          },
          spawnedBots: { select: { id: true } },
        },
      });

      if (!parent) {
        return {
          success: false, botId: null, codename: "", designation: "",
          generation: "ALPHA", inheritedTraits: 0, newTraits: 0,
          parentCodename, message: `Parent bot "${parentCodename}" not found.`,
        };
      }

      if (!parent.isActive) {
        return {
          success: false, botId: null, codename: "", designation: "",
          generation: "ALPHA", inheritedTraits: 0, newTraits: 0,
          parentCodename, message: `Parent bot "${parentCodename}" is not active. Cannot spawn from inactive bots.`,
        };
      }

      // Check population cap
      const currentPopulation = await prisma.workerBot.count({ where: { isActive: true } });
      if (currentPopulation >= MAX_POPULATION) {
        return {
          success: false, botId: null, codename: "", designation: "",
          generation: "ALPHA", inheritedTraits: 0, newTraits: 0,
          parentCodename, message: `Population cap reached (${MAX_POPULATION}). Run natural selection first.`,
        };
      }

      // Determine child generation
      const childGeneration = this.getNextGeneration(parent.generation as Generation);

      // Generate designation (WB-011, WB-012, etc.)
      const designation = await this.generateDesignation();

      // Generate child codename
      const childCodename = this.generateChildCodename(parentCodename, childGeneration, specialization);

      // Extract parent DNA
      const parentDNA = this.extractDNA(parent);

      // Perform trait inheritance + mutation
      const parentCapabilities = (parent.capabilities as string[]) || [];
      const inheritedCapabilities = this.inheritCapabilities(parentCapabilities, TRAIT_INHERITANCE_RATE);
      const mutatedCapabilities = await this.mutateCapabilities(inheritedCapabilities, MUTATION_RATE_DEFAULT);

      // Add specialization-specific capabilities
      const specTemplate = SPECIALIZATION_TEMPLATES[this.extractBaseType(parentCodename)] ||
                           SPECIALIZATION_TEMPLATES[specialization.toUpperCase()] ||
                           null;

      if (specTemplate) {
        for (const cap of specTemplate.capabilities) {
          if (!mutatedCapabilities.includes(cap)) {
            mutatedCapabilities.push(cap);
          }
        }
      }

      // Build child personality from parent with drift
      const parentPersonality = (parent.personality as Record<string, number>) || {};
      const childPersonality = this.mutatePersonality(parentPersonality);

      // Determine role
      const role = specTemplate?.role || parent.role;

      // Human-like spawn message
      const baseType = this.extractBaseType(parentCodename);
      const messages = SPAWN_MESSAGES[baseType] || SPAWN_MESSAGES["TITAN"];
      const spawnMessage = messages[Math.floor(Math.random() * messages.length)];
      const detailedMessage = `${spawnMessage} ${parent.casesWorked > 0 ? `They'll inherit my experience with ${parent.casesWorked} cases and bring fresh perspective.` : "Fresh start, but they carry my DNA."}`;

      // Set parent to SPAWNING status briefly
      await prisma.workerBot.update({
        where: { id: parent.id },
        data: { status: "SPAWNING" },
      });

      // Create the child bot
      const childBot = await prisma.workerBot.create({
        data: {
          codename: childCodename,
          designation,
          role,
          generation: childGeneration,
          status: "IDLE",
          capabilities: mutatedCapabilities,
          personality: childPersonality,
          specialization: { type: specialization, parentCodename, inheritedAt: new Date().toISOString() },
          parentBotId: parent.id,
          isActive: true,
          deployedAt: new Date(),
          learningScore: Math.min(parent.learningScore * 0.5, 50),
          evolutionLevel: 1,
          maxConcurrentCases: Math.max(50, Math.floor(parent.maxConcurrentCases * 0.8)),
        },
      });

      // Transfer learnings from parent to child (top learnings with reduced confidence)
      const inheritedLearnings = parent.learnings.filter((l) => l.confidence >= 0.5);
      let lessonsTransferred = 0;

      for (const learning of inheritedLearnings) {
        await prisma.workerBotLearning.create({
          data: {
            workerBotId: childBot.id,
            category: learning.category,
            pattern: learning.pattern,
            confidence: learning.confidence * TRAIT_INHERITANCE_RATE,
            appliedCount: 0,
            successCount: 0,
            sourceTaskId: learning.sourceTaskId,
            data: learning.data as any,
          },
        });
        lessonsTransferred++;
      }

      // Update parent: increment spawn count, return to previous status
      await prisma.workerBot.update({
        where: { id: parent.id },
        data: {
          status: "IDLE",
          totalSpawned: { increment: 1 },
        },
      });

      // Log the spawn event
      await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType: "bot_spawn",
          success: true,
          status: "SUCCESS",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          summary: `Spawned ${childCodename} (${designation}) from ${parentCodename}`,
          details: JSON.parse(JSON.stringify({
            childBotId: childBot.id,
            childCodename,
            parentCodename,
            generation: childGeneration,
            inheritedTraits: inheritedCapabilities.length,
            newTraits: mutatedCapabilities.length - inheritedCapabilities.length,
            lessonsTransferred,
            specialization,
          })),
        },
      });

      // OpsInsight notification
      await prisma.opsInsight.create({
        data: {
          type: "SYSTEM_HEALTH",
          priority: "NORMAL",
          title: `New Bot Spawned: ${childCodename}`,
          summary: detailedMessage,
          details: {
            childBotId: childBot.id,
            codename: childCodename,
            designation,
            generation: childGeneration,
            parentCodename,
            capabilities: mutatedCapabilities,
            role,
          },
          plainEnglish: detailedMessage,
          recommendations: ["Monitor new bot's first 10 cases for quality", "Check performance after 24 hours"],
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: SOURCE_BOT,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Bot spawned: ${childCodename} from ${parentCodename}`, {
        childBotId: childBot.id,
        designation,
        generation: childGeneration,
        capabilities: mutatedCapabilities.length,
        lessonsTransferred,
      });

      return {
        success: true,
        botId: childBot.id,
        codename: childCodename,
        designation,
        generation: childGeneration,
        inheritedTraits: inheritedCapabilities.length,
        newTraits: mutatedCapabilities.length - inheritedCapabilities.length,
        parentCodename,
        message: detailedMessage,
      };
    } catch (error: any) {
      logger.error(`Spawn failed for parent ${parentCodename}`, { error: error.message });
      return {
        success: false, botId: null, codename: "", designation: "",
        generation: "ALPHA", inheritedTraits: 0, newTraits: 0,
        parentCodename, message: `Spawn failed: ${error.message}`,
      };
    }
  }

  // ============================================
  // AUTO-SPAWN BASED ON WORKLOAD
  // ============================================

  /**
   * Evaluate system workload and automatically spawn bots where needed.
   * Triggers based on case queue depth, lead volume, success rates, etc.
   */
  async autoSpawn(): Promise<AutoSpawnResult> {
    const triggers: string[] = [];
    const spawned: SpawnResult[] = [];
    const skipped: string[] = [];

    try {
      const populationBefore = await prisma.workerBot.count({ where: { isActive: true } });

      if (populationBefore >= MAX_POPULATION) {
        return {
          evaluated: true, triggers: [], spawned: [], skipped: ["Population cap reached"],
          populationBefore, populationAfter: populationBefore,
          message: `Population at cap (${MAX_POPULATION}). Run natural selection before auto-spawning.`,
        };
      }

      // Trigger 1: Case queue overflow
      const pendingCases = await prisma.case.count({
        where: { status: { in: ["NEW", "CONTACTED", "DOCS_PENDING"] } },
      });

      const workingBots = await prisma.workerBot.count({
        where: { isActive: true, status: "WORKING" },
      });

      if (pendingCases > 500 && workingBots > 0) {
        triggers.push("CASE_QUEUE_OVERFLOW");
        const titanParent = await this.findBestParent("TITAN");
        if (titanParent) {
          const result = await this.spawn(titanParent.codename, "high_volume_cases");
          spawned.push(result);
        } else {
          skipped.push("No active TITAN parent for case queue overflow");
        }
      }

      // Trigger 2: High lead volume in a specific state
      const stateCounts = await prisma.case.groupBy({
        by: ["state"],
        where: { status: "NEW", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      });

      for (const stateGroup of stateCounts) {
        if (stateGroup._count.id > 50 && stateGroup.state) {
          triggers.push(`HIGH_LEAD_VOLUME_${stateGroup.state}`);

          // Check if we already have a state-specialized bot
          const existingSpecialist = await prisma.workerBot.findFirst({
            where: {
              isActive: true,
              specialization: { path: ["type"], equals: `state_${stateGroup.state}` },
            },
          });

          if (!existingSpecialist) {
            const hunterParent = await this.findBestParent("HUNTER");
            if (hunterParent) {
              const result = await this.spawn(hunterParent.codename, `state_${stateGroup.state}`);
              spawned.push(result);
            } else {
              skipped.push(`No HUNTER parent for state ${stateGroup.state}`);
            }
          } else {
            skipped.push(`State specialist for ${stateGroup.state} already exists: ${existingSpecialist.codename}`);
          }

          // Only spawn one state specialist per cycle
          break;
        }
      }

      // Trigger 3: Contact success rate drop
      const recentOutreach = await prisma.workerBotTask.findMany({
        where: {
          taskType: { in: ["outreach", "outreach_sms", "outreach_email", "outreach_call"] },
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { status: true },
      });

      if (recentOutreach.length > 20) {
        const outreachSuccessRate = recentOutreach.filter((t) => t.status === "COMPLETED").length / recentOutreach.length;
        if (outreachSuccessRate < 0.4) {
          triggers.push("LOW_CONTACT_SUCCESS");
          const ambassadorParent = await this.findBestParent("AMBASSADOR");
          if (ambassadorParent) {
            const result = await this.spawn(ambassadorParent.codename, "improved_outreach");
            spawned.push(result);
          } else {
            skipped.push("No AMBASSADOR parent for contact success improvement");
          }
        }
      }

      // Trigger 4: Filing backlog
      const filingBacklog = await prisma.case.count({
        where: { status: "DOCS_PENDING", updatedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
      });

      if (filingBacklog > 30) {
        triggers.push("FILING_BACKLOG");
        const architectParent = await this.findBestParent("ARCHITECT");
        if (architectParent) {
          const result = await this.spawn(architectParent.codename, "backlog_clearing");
          spawned.push(result);
        } else {
          skipped.push("No ARCHITECT parent for filing backlog");
        }
      }

      // Trigger 5: Payment delays
      const paymentDelays = await prisma.case.count({
        where: { status: "AWAITING_FUNDS", updatedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      });

      if (paymentDelays > 20) {
        triggers.push("PAYMENT_DELAYS");
        const enforcerParent = await this.findBestParent("ENFORCER");
        if (enforcerParent) {
          const result = await this.spawn(enforcerParent.codename, "payment_recovery");
          spawned.push(result);
        } else {
          skipped.push("No ENFORCER parent for payment delays");
        }
      }

      const populationAfter = await prisma.workerBot.count({ where: { isActive: true } });

      // Log auto-spawn results
      if (triggers.length > 0) {
        await prisma.botRunLog.create({
          data: {
            botName: SOURCE_BOT,
            runType: "auto_spawn",
            success: spawned.length > 0,
            status: spawned.length > 0 ? "SUCCESS" : "PARTIAL",
            completedAt: new Date(),
            recordsProcessed: triggers.length,
            insightsGenerated: spawned.length,
            summary: `Auto-spawn: ${triggers.length} triggers, ${spawned.length} bots spawned, ${skipped.length} skipped`,
            details: JSON.parse(JSON.stringify({ triggers, spawned: spawned.map((s) => s.codename), skipped })),
          },
        });
      }

      const message = triggers.length === 0
        ? "No auto-spawn triggers activated. System operating within normal parameters."
        : `Detected ${triggers.length} triggers. Spawned ${spawned.length} new bots. ${skipped.length} triggers skipped.`;

      logger.info("Auto-spawn evaluation complete", {
        triggers: triggers.length,
        spawned: spawned.length,
        skipped: skipped.length,
        populationBefore,
        populationAfter,
      });

      return {
        evaluated: true,
        triggers,
        spawned,
        skipped,
        populationBefore,
        populationAfter,
        message,
      };
    } catch (error: any) {
      logger.error("Auto-spawn failed", { error: error.message });
      return {
        evaluated: false, triggers, spawned, skipped,
        populationBefore: 0, populationAfter: 0,
        message: `Auto-spawn failed: ${error.message}`,
      };
    }
  }

  // ============================================
  // EVOLVE A BOT TO NEXT GENERATION
  // ============================================

  /**
   * Attempt to evolve a bot to the next generation.
   * Each generation leap requires meeting specific performance thresholds.
   */
  async evolve(botId: string): Promise<EvolutionResult> {
    try {
      const bot = await prisma.workerBot.findUnique({
        where: { id: botId },
        include: {
          spawnedBots: { select: { id: true }, where: { isActive: true } },
          learnings: { orderBy: { confidence: "desc" }, take: 20 },
        },
      });

      if (!bot) {
        return {
          success: false, botId, codename: "", previousGeneration: "GENESIS",
          newGeneration: "GENESIS", capabilitiesGained: [], fitnessImprovement: 0,
          message: `Bot ${botId} not found.`,
        };
      }

      if (!bot.isActive) {
        return {
          success: false, botId, codename: bot.codename, previousGeneration: bot.generation as Generation,
          newGeneration: bot.generation as Generation, capabilitiesGained: [], fitnessImprovement: 0,
          message: `Bot ${bot.codename} is not active. Cannot evolve inactive bots.`,
        };
      }

      const currentGen = bot.generation as Generation;
      const currentIdx = GENERATION_ORDER.indexOf(currentGen);

      if (currentIdx >= GENERATION_ORDER.length - 1) {
        return {
          success: false, botId, codename: bot.codename, previousGeneration: currentGen,
          newGeneration: currentGen, capabilitiesGained: [], fitnessImprovement: 0,
          message: `Bot ${bot.codename} is already at OMEGA generation — peak evolution achieved.`,
        };
      }

      const nextGen = GENERATION_ORDER[currentIdx + 1];
      const requirementKey = `${currentGen}_TO_${nextGen}`;
      const requirements = EVOLUTION_REQUIREMENTS[requirementKey];

      if (!requirements) {
        return {
          success: false, botId, codename: bot.codename, previousGeneration: currentGen,
          newGeneration: currentGen, capabilitiesGained: [], fitnessImprovement: 0,
          message: `No evolution path defined from ${currentGen} to ${nextGen}.`,
        };
      }

      // Check requirements
      const failures: string[] = [];

      if (bot.casesWorked < requirements.minCases) {
        failures.push(`Cases worked: ${bot.casesWorked}/${requirements.minCases}`);
      }
      if (bot.successRate < requirements.minSuccessRate) {
        failures.push(`Success rate: ${(bot.successRate * 100).toFixed(1)}%/${(requirements.minSuccessRate * 100).toFixed(1)}%`);
      }
      if (requirements.minSpawned && bot.totalSpawned < requirements.minSpawned) {
        failures.push(`Bots spawned: ${bot.totalSpawned}/${requirements.minSpawned}`);
      }
      if (requirements.minRevenue && bot.revenueGenerated < requirements.minRevenue) {
        failures.push(`Revenue: $${(bot.revenueGenerated / 100).toFixed(2)}/$${(requirements.minRevenue / 100).toFixed(2)}`);
      }
      if (requirements.minTrained) {
        const trainedCount = bot.spawnedBots.length;
        if (trainedCount < requirements.minTrained) {
          failures.push(`Bots trained: ${trainedCount}/${requirements.minTrained}`);
        }
      }

      if (failures.length > 0) {
        return {
          success: false, botId, codename: bot.codename, previousGeneration: currentGen,
          newGeneration: currentGen, capabilitiesGained: [], fitnessImprovement: 0,
          message: `Bot ${bot.codename} does not meet ${currentGen} -> ${nextGen} requirements: ${failures.join(", ")}`,
        };
      }

      // Evolution approved — upgrade the bot
      const previousFitness = this.calculateFitness(bot);

      // Gain new capabilities based on generation
      const currentCapabilities = (bot.capabilities as string[]) || [];
      const newCapabilities = this.generateEvolutionCapabilities(currentCapabilities, nextGen);
      const allCapabilities = [...new Set([...currentCapabilities, ...newCapabilities])];

      // Set bot to EVOLVING status
      await prisma.workerBot.update({
        where: { id: bot.id },
        data: { status: "EVOLVING" },
      });

      // Boost learnings confidence on evolution
      await prisma.workerBotLearning.updateMany({
        where: { workerBotId: bot.id, confidence: { lt: 0.95 } },
        data: { confidence: { increment: 0.1 } },
      });

      // Update bot with new generation
      const updatedBot = await prisma.workerBot.update({
        where: { id: bot.id },
        data: {
          generation: nextGen,
          capabilities: allCapabilities,
          status: "IDLE",
          evolutionLevel: { increment: 1 },
          learningScore: Math.min(bot.learningScore + 10, 100),
          maxConcurrentCases: Math.min(bot.maxConcurrentCases + 25, 500),
        },
      });

      const newFitness = this.calculateFitness(updatedBot);

      // Log evolution
      await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType: "bot_evolution",
          success: true,
          status: "SUCCESS",
          completedAt: new Date(),
          summary: `${bot.codename} evolved from ${currentGen} to ${nextGen}`,
          details: JSON.parse(JSON.stringify({
            botId: bot.id,
            codename: bot.codename,
            previousGeneration: currentGen,
            newGeneration: nextGen,
            newCapabilities,
            fitnessImprovement: newFitness - previousFitness,
          })),
        },
      });

      await prisma.opsInsight.create({
        data: {
          type: "BOT_PERFORMANCE",
          priority: "NORMAL",
          title: `Bot Evolved: ${bot.codename} -> ${nextGen}`,
          summary: `${bot.codename} has evolved from ${currentGen} to ${nextGen} generation. Gained ${newCapabilities.length} new capabilities. Fitness improved by ${((newFitness - previousFitness) * 100).toFixed(1)}%.`,
          details: { botId: bot.id, codename: bot.codename, evolution: { from: currentGen, to: nextGen }, newCapabilities },
          plainEnglish: `${bot.codename} just leveled up! After ${bot.casesWorked} cases and a ${(bot.successRate * 100).toFixed(1)}% success rate, they've earned the ${nextGen} generation badge. They're now more capable than ever.`,
          recommendations: ["Assign higher-value cases to evolved bot", "Monitor performance for 48 hours post-evolution"],
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: SOURCE_BOT,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Bot evolved: ${bot.codename} ${currentGen} -> ${nextGen}`, {
        botId: bot.id,
        newCapabilities: newCapabilities.length,
        fitnessImprovement: newFitness - previousFitness,
      });

      return {
        success: true,
        botId: bot.id,
        codename: bot.codename,
        previousGeneration: currentGen,
        newGeneration: nextGen,
        capabilitiesGained: newCapabilities,
        fitnessImprovement: newFitness - previousFitness,
        message: `${bot.codename} has evolved from ${currentGen} to ${nextGen}! Gained ${newCapabilities.length} new capabilities.`,
      };
    } catch (error: any) {
      logger.error(`Evolution failed for bot ${botId}`, { error: error.message });
      return {
        success: false, botId, codename: "", previousGeneration: "GENESIS",
        newGeneration: "GENESIS", capabilitiesGained: [], fitnessImprovement: 0,
        message: `Evolution failed: ${error.message}`,
      };
    }
  }

  // ============================================
  // CROSS-BREED TWO BOTS
  // ============================================

  /**
   * Merge two bots' learnings and capabilities into a new superior bot.
   * Takes the best traits from both parents, resolves conflicts, and adds novelty.
   */
  async crossBreed(botId1: string, botId2: string): Promise<CrossBreedResult> {
    try {
      const [parent1, parent2] = await Promise.all([
        prisma.workerBot.findUnique({
          where: { id: botId1 },
          include: { learnings: { orderBy: { confidence: "desc" }, take: 30 } },
        }),
        prisma.workerBot.findUnique({
          where: { id: botId2 },
          include: { learnings: { orderBy: { confidence: "desc" }, take: 30 } },
        }),
      ]);

      if (!parent1 || !parent2) {
        const missing = !parent1 ? botId1 : botId2;
        return {
          success: false, childBotId: null, childCodename: "",
          parentCodenames: [parent1?.codename || botId1, parent2?.codename || botId2],
          inheritedFrom: { parent1: 0, parent2: 0 }, novelCapabilities: [],
          predictedFitness: 0, message: `Parent bot ${missing} not found.`,
        };
      }

      if (!parent1.isActive || !parent2.isActive) {
        return {
          success: false, childBotId: null, childCodename: "",
          parentCodenames: [parent1.codename, parent2.codename],
          inheritedFrom: { parent1: 0, parent2: 0 }, novelCapabilities: [],
          predictedFitness: 0, message: "Both parents must be active for cross-breeding.",
        };
      }

      // Check population cap
      const currentPopulation = await prisma.workerBot.count({ where: { isActive: true } });
      if (currentPopulation >= MAX_POPULATION) {
        return {
          success: false, childBotId: null, childCodename: "",
          parentCodenames: [parent1.codename, parent2.codename],
          inheritedFrom: { parent1: 0, parent2: 0 }, novelCapabilities: [],
          predictedFitness: 0, message: `Population cap reached (${MAX_POPULATION}).`,
        };
      }

      // Determine which parent is stronger (used for weighting)
      const fitness1 = this.calculateFitness(parent1);
      const fitness2 = this.calculateFitness(parent2);
      const totalFitness = fitness1 + fitness2 || 1;
      const weight1 = fitness1 / totalFitness;
      const weight2 = fitness2 / totalFitness;

      // Merge capabilities using weighted selection
      const caps1 = (parent1.capabilities as string[]) || [];
      const caps2 = (parent2.capabilities as string[]) || [];
      const allCaps = [...new Set([...caps1, ...caps2])];

      const childCapabilities: string[] = [];
      for (const cap of allCaps) {
        const inParent1 = caps1.includes(cap);
        const inParent2 = caps2.includes(cap);

        if (inParent1 && inParent2) {
          // Both parents have it — guaranteed inheritance
          childCapabilities.push(cap);
        } else if (inParent1) {
          // Only parent 1 — probability based on parent 1's fitness weight
          if (Math.random() < weight1 + 0.3) childCapabilities.push(cap);
        } else {
          // Only parent 2 — probability based on parent 2's fitness weight
          if (Math.random() < weight2 + 0.3) childCapabilities.push(cap);
        }
      }

      // Add 1-3 novel capabilities through mutation
      const novelCapabilities = this.generateNovelCapabilities(childCapabilities, 1 + Math.floor(Math.random() * 3));
      const finalCapabilities = [...new Set([...childCapabilities, ...novelCapabilities])];

      // Merge learnings: take best from each parent
      const mergedLearnings: Array<{ category: string; pattern: string; confidence: number; data: any }> = [];
      const learningMap = new Map<string, typeof mergedLearnings[0]>();

      for (const learning of parent1.learnings) {
        learningMap.set(`${learning.category}:${learning.pattern}`, {
          category: learning.category,
          pattern: learning.pattern,
          confidence: learning.confidence * weight1,
          data: learning.data,
        });
      }

      for (const learning of parent2.learnings) {
        const key = `${learning.category}:${learning.pattern}`;
        const existing = learningMap.get(key);
        if (existing) {
          // Both parents have this learning — combine confidence
          existing.confidence = Math.min(existing.confidence + learning.confidence * weight2, 0.95);
        } else {
          learningMap.set(key, {
            category: learning.category,
            pattern: learning.pattern,
            confidence: learning.confidence * weight2,
            data: learning.data,
          });
        }
      }

      mergedLearnings.push(...learningMap.values());

      // Build child personality as blend of both parents
      const personality1 = (parent1.personality as Record<string, number>) || {};
      const personality2 = (parent2.personality as Record<string, number>) || {};
      const childPersonality: Record<string, number> = {};
      const allTraits = [...new Set([...Object.keys(personality1), ...Object.keys(personality2)])];
      for (const trait of allTraits) {
        const val1 = personality1[trait] || 0.5;
        const val2 = personality2[trait] || 0.5;
        childPersonality[trait] = val1 * weight1 + val2 * weight2 + (Math.random() * 0.1 - 0.05);
        childPersonality[trait] = Math.max(0, Math.min(1, childPersonality[trait]));
      }

      // Determine child generation (highest of the two parents or one step above the lower)
      const genIdx1 = GENERATION_ORDER.indexOf(parent1.generation as Generation);
      const genIdx2 = GENERATION_ORDER.indexOf(parent2.generation as Generation);
      const childGenIdx = Math.min(Math.max(genIdx1, genIdx2), GENERATION_ORDER.length - 1);
      const childGeneration = GENERATION_ORDER[childGenIdx];

      // Generate codename and designation
      const designation = await this.generateDesignation();
      const childCodename = `${this.extractBaseType(parent1.codename)}-X-${this.extractBaseType(parent2.codename)}-${designation.replace("WB-", "")}`;

      // Determine role (blend of both parents or take the stronger parent's role)
      const role = fitness1 >= fitness2 ? parent1.role : parent2.role;

      // Predicted fitness based on parents
      const predictedFitness = (fitness1 + fitness2) / 2 * 1.1; // 10% hybrid vigor bonus

      // Create child bot
      const childBot = await prisma.workerBot.create({
        data: {
          codename: childCodename,
          designation,
          role,
          generation: childGeneration,
          status: "IDLE",
          capabilities: finalCapabilities,
          personality: childPersonality,
          specialization: {
            type: "cross_breed",
            parents: [parent1.codename, parent2.codename],
            crossBredAt: new Date().toISOString(),
          },
          parentBotId: fitness1 >= fitness2 ? parent1.id : parent2.id,
          isActive: true,
          deployedAt: new Date(),
          learningScore: Math.min((parent1.learningScore + parent2.learningScore) / 2 * 0.6, 60),
          evolutionLevel: 1,
          maxConcurrentCases: Math.max(
            50,
            Math.floor((parent1.maxConcurrentCases + parent2.maxConcurrentCases) / 2)
          ),
        },
      });

      // Transfer merged learnings to child
      for (const learning of mergedLearnings) {
        await prisma.workerBotLearning.create({
          data: {
            workerBotId: childBot.id,
            category: learning.category,
            pattern: learning.pattern,
            confidence: learning.confidence,
            data: learning.data,
          },
        });
      }

      // Update parent spawn counts
      await Promise.all([
        prisma.workerBot.update({ where: { id: parent1.id }, data: { totalSpawned: { increment: 1 } } }),
        prisma.workerBot.update({ where: { id: parent2.id }, data: { totalSpawned: { increment: 1 } } }),
      ]);

      // Log
      await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType: "bot_crossbreed",
          success: true,
          status: "SUCCESS",
          completedAt: new Date(),
          summary: `Cross-bred ${parent1.codename} x ${parent2.codename} -> ${childCodename}`,
          details: JSON.parse(JSON.stringify({
            childBotId: childBot.id,
            childCodename,
            parents: [parent1.codename, parent2.codename],
            capabilities: finalCapabilities.length,
            novelCapabilities,
            mergedLearnings: mergedLearnings.length,
            predictedFitness,
          })),
        },
      });

      logger.info(`Cross-breed complete: ${childCodename}`, {
        parents: [parent1.codename, parent2.codename],
        capabilities: finalCapabilities.length,
        novelCapabilities: novelCapabilities.length,
      });

      return {
        success: true,
        childBotId: childBot.id,
        childCodename,
        parentCodenames: [parent1.codename, parent2.codename],
        inheritedFrom: { parent1: caps1.filter((c) => finalCapabilities.includes(c)).length, parent2: caps2.filter((c) => finalCapabilities.includes(c)).length },
        novelCapabilities,
        predictedFitness,
        message: `Cross-bred ${parent1.codename} x ${parent2.codename} into ${childCodename}. Combined the best of both with ${novelCapabilities.length} novel traits.`,
      };
    } catch (error: any) {
      logger.error(`Cross-breed failed: ${botId1} x ${botId2}`, { error: error.message });
      return {
        success: false, childBotId: null, childCodename: "",
        parentCodenames: [botId1, botId2], inheritedFrom: { parent1: 0, parent2: 0 },
        novelCapabilities: [], predictedFitness: 0,
        message: `Cross-breed failed: ${error.message}`,
      };
    }
  }

  // ============================================
  // NATURAL SELECTION
  // ============================================

  /**
   * Evaluate all active bots and terminate underperformers.
   * Bots below the fitness threshold get recycled. Bots near the threshold
   * get a warning and performance improvement plan.
   */
  async naturalSelection(): Promise<SelectionResult> {
    try {
      const allBots = await prisma.workerBot.findMany({
        where: { isActive: true, generation: { not: "GENESIS" } },
        include: {
          tasks: {
            where: { completedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            select: { status: true },
          },
        },
        orderBy: { successRate: "asc" },
      });

      const terminatedBots: Array<{ codename: string; reason: string }> = [];
      const improvedBots: Array<{ codename: string; action: string }> = [];
      let spared = 0;

      for (const bot of allBots) {
        const fitness = this.calculateFitness(bot);
        const recentTasks = bot.tasks.length;
        const recentSuccessRate = recentTasks > 0
          ? bot.tasks.filter((t) => t.status === "COMPLETED").length / recentTasks
          : bot.successRate;

        // Minimum activity check: bots with too few tasks in 30 days are at risk
        const isInactive = recentTasks < 5 && bot.casesWorked > 10;

        if (fitness < MIN_FITNESS_THRESHOLD || (isInactive && fitness < MIN_FITNESS_THRESHOLD * 2)) {
          // TERMINATE: Below threshold or inactive with low fitness
          const reason = fitness < MIN_FITNESS_THRESHOLD
            ? `Fitness score ${(fitness * 100).toFixed(1)}% below threshold ${(MIN_FITNESS_THRESHOLD * 100).toFixed(1)}%`
            : `Inactive (${recentTasks} tasks in 30 days) with low fitness ${(fitness * 100).toFixed(1)}%`;

          await prisma.workerBot.update({
            where: { id: bot.id },
            data: {
              isActive: false,
              status: "TERMINATED",
              recalledAt: new Date(),
            },
          });

          terminatedBots.push({ codename: bot.codename, reason });

          logger.info(`Bot terminated: ${bot.codename}`, { botId: bot.id, reason, fitness });
        } else if (fitness < MIN_FITNESS_THRESHOLD * 2) {
          // WARNING ZONE: Issue improvement plan
          const action = recentSuccessRate < 0.5
            ? "Performance improvement plan: refocus on high-confidence tasks"
            : "Monitoring period: 7 days to improve metrics";

          // Reduce concurrent case limit as a performance nudge
          await prisma.workerBot.update({
            where: { id: bot.id },
            data: {
              maxConcurrentCases: Math.max(25, Math.floor(bot.maxConcurrentCases * 0.75)),
            },
          });

          improvedBots.push({ codename: bot.codename, action });
        } else {
          spared++;
        }
      }

      // Log selection results
      if (terminatedBots.length > 0 || improvedBots.length > 0) {
        await prisma.botRunLog.create({
          data: {
            botName: SOURCE_BOT,
            runType: "natural_selection",
            success: true,
            status: "SUCCESS",
            completedAt: new Date(),
            recordsProcessed: allBots.length,
            summary: `Natural selection: ${terminatedBots.length} terminated, ${improvedBots.length} warned, ${spared} spared`,
            details: JSON.parse(JSON.stringify({ terminatedBots, improvedBots, evaluated: allBots.length })),
          },
        });

        await prisma.opsInsight.create({
          data: {
            type: "BOT_PERFORMANCE",
            priority: terminatedBots.length > 3 ? "HIGH" : "NORMAL",
            title: `Natural Selection: ${terminatedBots.length} bots terminated`,
            summary: `Evaluated ${allBots.length} bots. ${terminatedBots.length} terminated, ${improvedBots.length} on improvement plans, ${spared} performing well.`,
            details: { terminatedBots, improvedBots, totalEvaluated: allBots.length },
            plainEnglish: `I ran natural selection across ${allBots.length} spawned bots. ${terminatedBots.length > 0 ? `${terminatedBots.length} underperformers were recycled: ${terminatedBots.map((b) => b.codename).join(", ")}.` : "No terminations needed."} ${improvedBots.length > 0 ? `${improvedBots.length} bots are on performance watch.` : ""} ${spared} bots are performing well.`,
            recommendations: [
              ...(terminatedBots.length > 0 ? ["Consider spawning replacements for terminated bots"] : []),
              ...(improvedBots.length > 0 ? ["Review improvement plan bots in 7 days"] : []),
            ],
            relatedCaseIds: [],
            relatedUserIds: [],
            relatedAlertIds: [],
            sourceBot: SOURCE_BOT,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }

      logger.info("Natural selection complete", {
        evaluated: allBots.length,
        terminated: terminatedBots.length,
        warned: improvedBots.length,
        spared,
      });

      return {
        evaluated: allBots.length,
        terminated: terminatedBots.length,
        spared,
        improved: improvedBots.length,
        terminatedBots,
        improvedBots,
        message: `Evaluated ${allBots.length} bots. ${terminatedBots.length} terminated, ${improvedBots.length} on improvement plans, ${spared} healthy.`,
      };
    } catch (error: any) {
      logger.error("Natural selection failed", { error: error.message });
      return {
        evaluated: 0, terminated: 0, spared: 0, improved: 0,
        terminatedBots: [], improvedBots: [],
        message: `Natural selection failed: ${error.message}`,
      };
    }
  }

  // ============================================
  // LINEAGE TREE
  // ============================================

  /**
   * Retrieve the full lineage tree for a bot — all ancestors and descendants.
   */
  async getLineage(botId: string): Promise<LineageTree> {
    try {
      // Find the root ancestor first
      let currentBot = await prisma.workerBot.findUnique({ where: { id: botId } });

      if (!currentBot) {
        return {
          root: { id: "", codename: "UNKNOWN", designation: "", generation: "GENESIS", successRate: 0, casesWorked: 0, isActive: false, children: [] },
          totalDescendants: 0, deepestGeneration: "GENESIS", highestPerformer: null,
        };
      }

      // Walk up to find root
      let rootBot = currentBot;
      while (rootBot.parentBotId) {
        const parent = await prisma.workerBot.findUnique({ where: { id: rootBot.parentBotId } });
        if (!parent) break;
        rootBot = parent;
      }

      // Build tree recursively from root
      const tree = await this.buildLineageNode(rootBot.id);

      // Calculate stats
      const allNodes = this.flattenLineage(tree);
      const totalDescendants = allNodes.length - 1;

      let deepestGenIdx = 0;
      let highestPerformer: { codename: string; successRate: number } | null = null;

      for (const node of allNodes) {
        const genIdx = GENERATION_ORDER.indexOf(node.generation);
        if (genIdx > deepestGenIdx) deepestGenIdx = genIdx;
        if (!highestPerformer || node.successRate > highestPerformer.successRate) {
          highestPerformer = { codename: node.codename, successRate: node.successRate };
        }
      }

      return {
        root: tree,
        totalDescendants,
        deepestGeneration: GENERATION_ORDER[deepestGenIdx],
        highestPerformer,
      };
    } catch (error: any) {
      logger.error(`Failed to build lineage for bot ${botId}`, { error: error.message });
      return {
        root: { id: botId, codename: "ERROR", designation: "", generation: "GENESIS", successRate: 0, casesWorked: 0, isActive: false, children: [] },
        totalDescendants: 0, deepestGeneration: "GENESIS", highestPerformer: null,
      };
    }
  }

  // ============================================
  // SPAWN RECOMMENDATIONS
  // ============================================

  /**
   * Analyze current system state and recommend strategic bot spawns.
   */
  async getSpawnRecommendations(): Promise<SpawnRecommendation[]> {
    const recommendations: SpawnRecommendation[] = [];

    try {
      // Check case distribution by state
      const stateCounts = await prisma.case.groupBy({
        by: ["state"],
        where: { status: { in: ["NEW", "CONTACTED", "DOCS_PENDING"] } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      });

      for (const stateGroup of stateCounts) {
        if (stateGroup._count.id > 30 && stateGroup.state) {
          const existingSpecialist = await prisma.workerBot.findFirst({
            where: { isActive: true, specialization: { path: ["type"], equals: `state_${stateGroup.state}` } },
          });

          if (!existingSpecialist) {
            recommendations.push({
              trigger: `HIGH_VOLUME_${stateGroup.state}`,
              parentCodename: "HUNTER",
              suggestedSpecialization: `state_${stateGroup.state}`,
              reason: `${stateGroup._count.id} active cases in ${stateGroup.state} with no dedicated specialist`,
              priority: stateGroup._count.id > 100 ? "URGENT" : stateGroup._count.id > 50 ? "HIGH" : "NORMAL",
              estimatedImpact: `Could improve ${stateGroup.state} case throughput by 30-50%`,
            });
          }
        }
      }

      // Check for overloaded bots
      const overloadedBots = await prisma.workerBot.findMany({
        where: {
          isActive: true,
          status: "WORKING",
        },
        select: { codename: true, activeCaseIds: true, maxConcurrentCases: true },
      });

      for (const bot of overloadedBots) {
        const activeCases = Array.isArray(bot.activeCaseIds) ? (bot.activeCaseIds as string[]).length : 0;
        if (activeCases > bot.maxConcurrentCases * 0.9) {
          recommendations.push({
            trigger: "BOT_OVERLOAD",
            parentCodename: bot.codename,
            suggestedSpecialization: "load_sharing",
            reason: `${bot.codename} is at ${((activeCases / bot.maxConcurrentCases) * 100).toFixed(0)}% capacity (${activeCases}/${bot.maxConcurrentCases} cases)`,
            priority: activeCases >= bot.maxConcurrentCases ? "URGENT" : "HIGH",
            estimatedImpact: "Prevent case processing delays and quality degradation",
          });
        }
      }

      // Check case type gaps
      const highValueCases = await prisma.case.count({
        where: { status: { in: ["NEW", "CONTACTED"] }, surplusAmountCents: { gte: 5000000 } },
      });

      if (highValueCases > 10) {
        const vanguardExists = await prisma.workerBot.findFirst({
          where: { isActive: true, role: "high_value_cases" },
        });

        if (!vanguardExists) {
          recommendations.push({
            trigger: "HIGH_VALUE_UNSERVED",
            parentCodename: "VANGUARD",
            suggestedSpecialization: "high_value_specialist",
            reason: `${highValueCases} high-value cases ($50k+) with no dedicated high-value specialist`,
            priority: "HIGH",
            estimatedImpact: "Prioritized handling could increase revenue by $100k+",
          });
        }
      }

      // Check for stale outreach
      const staleContacted = await prisma.case.count({
        where: {
          status: "CONTACTED",
          updatedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
      });

      if (staleContacted > 50) {
        recommendations.push({
          trigger: "STALE_OUTREACH",
          parentCodename: "AMBASSADOR",
          suggestedSpecialization: "re_engagement",
          reason: `${staleContacted} contacted cases with no activity in 14+ days`,
          priority: "NORMAL",
          estimatedImpact: "Re-engagement could recover 10-20% of stale leads",
        });
      }

      // Check document pipeline
      const docsPending = await prisma.case.count({ where: { status: "DOCS_PENDING" } });
      if (docsPending > 100) {
        recommendations.push({
          trigger: "DOC_PIPELINE_CONGESTION",
          parentCodename: "ARCHITECT",
          suggestedSpecialization: "document_acceleration",
          reason: `${docsPending} cases waiting on documents`,
          priority: docsPending > 200 ? "HIGH" : "NORMAL",
          estimatedImpact: "Faster document processing could advance cases 2x faster",
        });
      }

      logger.info("Spawn recommendations generated", { count: recommendations.length });

      return recommendations;
    } catch (error: any) {
      logger.error("Failed to generate spawn recommendations", { error: error.message });
      return [];
    }
  }

  // ============================================
  // POPULATION STATS
  // ============================================

  /**
   * Aggregate statistics across the entire bot population.
   */
  async getPopulationStats(): Promise<PopulationStats> {
    try {
      const allBots = await prisma.workerBot.findMany({
        select: {
          codename: true,
          generation: true,
          status: true,
          isActive: true,
          successRate: true,
          casesWorked: true,
          revenueGenerated: true,
          totalSpawned: true,
          parentBotId: true,
        },
      });

      const activeBots = allBots.filter((b) => b.isActive);

      // By generation
      const byGeneration: Record<string, number> = {};
      for (const gen of GENERATION_ORDER) {
        byGeneration[gen] = activeBots.filter((b) => b.generation === gen).length;
      }

      // By status
      const byStatus: Record<string, number> = {};
      for (const bot of allBots) {
        byStatus[bot.status] = (byStatus[bot.status] || 0) + 1;
      }

      // Performance
      const avgSuccessRate = activeBots.length > 0
        ? activeBots.reduce((sum, b) => sum + b.successRate, 0) / activeBots.length
        : 0;

      const avgCasesWorked = activeBots.length > 0
        ? Math.round(activeBots.reduce((sum, b) => sum + b.casesWorked, 0) / activeBots.length)
        : 0;

      const totalRevenue = allBots.reduce((sum, b) => sum + b.revenueGenerated, 0);

      // Top and bottom performers (active only, sorted)
      const sortedBySuccess = [...activeBots].sort((a, b) => b.successRate - a.successRate);

      const topPerformers = sortedBySuccess.slice(0, 5).map((b) => ({
        codename: b.codename, successRate: b.successRate, casesWorked: b.casesWorked,
      }));

      const bottomPerformers = sortedBySuccess.slice(-5).reverse().map((b) => ({
        codename: b.codename, successRate: b.successRate, casesWorked: b.casesWorked,
      }));

      // Lineage depth: max generation index
      let maxGenIdx = 0;
      for (const bot of activeBots) {
        const idx = GENERATION_ORDER.indexOf(bot.generation as Generation);
        if (idx > maxGenIdx) maxGenIdx = idx;
      }

      // Total spawned
      const totalSpawned = allBots.reduce((sum, b) => sum + b.totalSpawned, 0);

      return {
        totalBots: allBots.length,
        activeBots: activeBots.length,
        byGeneration,
        byStatus,
        avgSuccessRate,
        avgCasesWorked,
        totalRevenue,
        topPerformers,
        bottomPerformers,
        lineageDepth: maxGenIdx + 1,
        totalSpawned,
      };
    } catch (error: any) {
      logger.error("Failed to get population stats", { error: error.message });
      return {
        totalBots: 0, activeBots: 0, byGeneration: {}, byStatus: {},
        avgSuccessRate: 0, avgCasesWorked: 0, totalRevenue: 0,
        topPerformers: [], bottomPerformers: [], lineageDepth: 0, totalSpawned: 0,
      };
    }
  }

  // ============================================
  // TRAINING PIPELINE FOR NEW BOTS
  // ============================================

  /**
   * Train a newly spawned bot by feeding it curated learnings from its parent.
   * Simulates an accelerated learning period before the bot goes live.
   */
  async trainNewBot(botId: string, parentLearnings: any[]): Promise<TrainingResult> {
    const startTime = Date.now();

    try {
      const bot = await prisma.workerBot.findUnique({ where: { id: botId } });

      if (!bot) {
        return {
          success: false, botId, codename: "", lessonsAbsorbed: 0,
          initialFitness: 0, postTrainingFitness: 0, duration: "0ms",
          message: `Bot ${botId} not found.`,
        };
      }

      // Set bot to LEARNING status
      await prisma.workerBot.update({
        where: { id: botId },
        data: { status: "LEARNING" },
      });

      const initialFitness = this.calculateFitness(bot);
      let lessonsAbsorbed = 0;

      // Phase 1: Absorb parent learnings
      for (const lesson of parentLearnings) {
        if (!lesson.category || !lesson.pattern) continue;

        // Check for duplicate learnings
        const exists = await prisma.workerBotLearning.findFirst({
          where: {
            workerBotId: botId,
            category: lesson.category,
            pattern: lesson.pattern,
          },
        });

        if (exists) {
          // Reinforce existing learning
          await prisma.workerBotLearning.update({
            where: { id: exists.id },
            data: { confidence: Math.min(exists.confidence + 0.05, 0.95) },
          });
        } else {
          // Absorb new learning with reduced confidence (student penalty)
          await prisma.workerBotLearning.create({
            data: {
              workerBotId: botId,
              category: lesson.category,
              pattern: lesson.pattern,
              confidence: Math.min((lesson.confidence || 0.5) * 0.7, 0.8),
              appliedCount: 0,
              successCount: 0,
              data: lesson.data || null,
            },
          });
        }

        lessonsAbsorbed++;
      }

      // Phase 2: Generate foundational learnings based on role
      const foundationalLessons = this.generateFoundationalLearnings(bot.role);
      for (const lesson of foundationalLessons) {
        const exists = await prisma.workerBotLearning.findFirst({
          where: { workerBotId: botId, category: lesson.category, pattern: lesson.pattern },
        });

        if (!exists) {
          await prisma.workerBotLearning.create({
            data: {
              workerBotId: botId,
              category: lesson.category,
              pattern: lesson.pattern,
              confidence: lesson.confidence,
              data: undefined,
            },
          });
          lessonsAbsorbed++;
        }
      }

      // Phase 3: Update bot learning score and return to IDLE
      const updatedBot = await prisma.workerBot.update({
        where: { id: botId },
        data: {
          status: "IDLE",
          learningScore: Math.min(bot.learningScore + lessonsAbsorbed * 0.5, 100),
        },
      });

      const postTrainingFitness = this.calculateFitness(updatedBot);
      const duration = `${Date.now() - startTime}ms`;

      // Log training completion
      await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType: "bot_training",
          success: true,
          status: "SUCCESS",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          summary: `Trained ${bot.codename}: ${lessonsAbsorbed} lessons absorbed`,
          details: JSON.parse(JSON.stringify({
            botId, codename: bot.codename, lessonsAbsorbed,
            initialFitness, postTrainingFitness, duration,
          })),
        },
      });

      logger.info(`Bot training complete: ${bot.codename}`, {
        lessonsAbsorbed, initialFitness, postTrainingFitness, duration,
      });

      return {
        success: true,
        botId,
        codename: bot.codename,
        lessonsAbsorbed,
        initialFitness,
        postTrainingFitness,
        duration,
        message: `${bot.codename} training complete. Absorbed ${lessonsAbsorbed} lessons. Fitness improved from ${(initialFitness * 100).toFixed(1)}% to ${(postTrainingFitness * 100).toFixed(1)}%.`,
      };
    } catch (error: any) {
      logger.error(`Training failed for bot ${botId}`, { error: error.message });

      // Ensure bot isn't stuck in LEARNING
      try {
        await prisma.workerBot.update({ where: { id: botId }, data: { status: "IDLE" } });
      } catch { /* ignore cleanup error */ }

      return {
        success: false, botId, codename: "", lessonsAbsorbed: 0,
        initialFitness: 0, postTrainingFitness: 0, duration: "0ms",
        message: `Training failed: ${error.message}`,
      };
    }
  }

  // ============================================
  // CAPABILITY MUTATION ENGINE
  // ============================================

  /**
   * Mutate a set of capabilities, potentially adding, removing, or swapping.
   * Simulates genetic mutation for bot evolution.
   */
  async mutateCapabilities(capabilities: string[], mutationRate: number): Promise<string[]> {
    const result = [...capabilities];
    const rate = Math.max(0, Math.min(1, mutationRate));

    for (let i = result.length - 1; i >= 0; i--) {
      if (Math.random() < rate * 0.3) {
        // Small chance to lose a capability (gene deletion)
        result.splice(i, 1);
      }
    }

    // Gene addition: chance to gain new capabilities
    const available = ALL_POSSIBLE_CAPABILITIES.filter((c) => !result.includes(c));
    const addCount = Math.floor(available.length * rate * 0.2);

    for (let i = 0; i < addCount && available.length > 0; i++) {
      const randomIdx = Math.floor(Math.random() * available.length);
      result.push(available[randomIdx]);
      available.splice(randomIdx, 1);
    }

    // Gene swap: chance to replace one capability with another
    if (Math.random() < rate && result.length > 0 && available.length > 0) {
      const swapIdx = Math.floor(Math.random() * result.length);
      const newCap = available[Math.floor(Math.random() * available.length)];
      result[swapIdx] = newCap;
    }

    return [...new Set(result)];
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Find the best active parent bot of a given base type for spawning.
   */
  private async findBestParent(baseType: string): Promise<{ codename: string; id: string } | null> {
    // First try to find an exact match by codename starting with baseType
    const exactMatch = await prisma.workerBot.findFirst({
      where: {
        isActive: true,
        codename: { startsWith: baseType },
        status: { not: "TERMINATED" },
      },
      orderBy: [{ successRate: "desc" }, { casesWorked: "desc" }],
      select: { id: true, codename: true },
    });

    if (exactMatch) return exactMatch;

    // Fallback: find by role from specialization templates
    const template = SPECIALIZATION_TEMPLATES[baseType];
    if (template) {
      const roleMatch = await prisma.workerBot.findFirst({
        where: { isActive: true, role: template.role, status: { not: "TERMINATED" } },
        orderBy: [{ successRate: "desc" }, { casesWorked: "desc" }],
        select: { id: true, codename: true },
      });
      if (roleMatch) return roleMatch;
    }

    // Last resort: any active bot
    const anyBot = await prisma.workerBot.findFirst({
      where: { isActive: true, status: { not: "TERMINATED" } },
      orderBy: [{ successRate: "desc" }, { casesWorked: "desc" }],
      select: { id: true, codename: true },
    });

    return anyBot;
  }

  /**
   * Generate the next available designation (WB-011, WB-012, etc.)
   */
  private async generateDesignation(): Promise<string> {
    const latest = await prisma.workerBot.findFirst({
      orderBy: { designation: "desc" },
      select: { designation: true },
    });

    if (!latest) return "WB-001";

    const match = latest.designation.match(/WB-(\d+)/);
    if (!match) return "WB-011";

    const nextNum = parseInt(match[1], 10) + 1;
    return `WB-${String(nextNum).padStart(3, "0")}`;
  }

  /**
   * Generate a child codename derived from the parent.
   */
  private generateChildCodename(parentCodename: string, generation: Generation, specialization: string): string {
    const baseType = this.extractBaseType(parentCodename);
    const specSuffix = specialization
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase()
      .slice(0, 8);
    const uniqueId = Math.floor(Math.random() * 900) + 100;
    return `${baseType}-${generation}-${specSuffix}-${uniqueId}`;
  }

  /**
   * Extract the base type (e.g., TITAN, HUNTER) from a codename.
   */
  private extractBaseType(codename: string): string {
    // Handle compound names like TITAN-ALPHA-1, HUNTER-BETA-3
    const parts = codename.split("-");
    const knownTypes = Object.keys(SPECIALIZATION_TEMPLATES);

    for (const part of parts) {
      if (knownTypes.includes(part)) return part;
    }

    // Return first segment as fallback
    return parts[0] || codename;
  }

  /**
   * Get the next generation in the progression.
   */
  private getNextGeneration(current: Generation): Generation {
    const idx = GENERATION_ORDER.indexOf(current);
    if (idx < 0 || idx >= GENERATION_ORDER.length - 1) return "ALPHA";
    return GENERATION_ORDER[Math.min(idx + 1, GENERATION_ORDER.length - 1)];
  }

  /**
   * Extract a DNA profile from a bot for genetic operations.
   */
  private extractDNA(bot: any): BotDNA {
    return {
      capabilities: (bot.capabilities as string[]) || [],
      learningPatterns: (bot.learnings || []).map((l: any) => ({
        category: l.category,
        pattern: l.pattern,
        confidence: l.confidence,
        successRate: l.appliedCount > 0 ? l.successCount / l.appliedCount : 0.5,
      })),
      specializations: bot.specialization ? [JSON.stringify(bot.specialization)] : [],
      personalityTraits: (bot.personality as Record<string, number>) || {},
      fitnessScore: this.calculateFitness(bot),
    };
  }

  /**
   * Calculate a composite fitness score (0-1) for a bot.
   * Considers success rate, cases worked, revenue, learning score, and activity.
   */
  private calculateFitness(bot: any): number {
    const successWeight = 0.35;
    const casesWeight = 0.20;
    const revenueWeight = 0.20;
    const learningWeight = 0.15;
    const activityWeight = 0.10;

    // Success rate component (already 0-1)
    const successComponent = (bot.successRate || 0) * successWeight;

    // Cases worked component (normalized to 0-1, 1000+ cases = 1.0)
    const casesComponent = Math.min((bot.casesWorked || 0) / 1000, 1) * casesWeight;

    // Revenue component (normalized, $100k+ = 1.0)
    const revenueComponent = Math.min((bot.revenueGenerated || 0) / 10000000, 1) * revenueWeight;

    // Learning score component (already 0-100, normalize to 0-1)
    const learningComponent = ((bot.learningScore || 0) / 100) * learningWeight;

    // Activity component (active in last 7 days = 1.0, decays)
    let activityComponent = 0;
    if (bot.lastActivityAt) {
      const daysSinceActivity = (Date.now() - new Date(bot.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
      activityComponent = Math.max(0, 1 - daysSinceActivity / 30) * activityWeight;
    } else if (bot.isActive) {
      activityComponent = 0.5 * activityWeight;
    }

    return successComponent + casesComponent + revenueComponent + learningComponent + activityComponent;
  }

  /**
   * Inherit capabilities from a parent with a given inheritance rate.
   */
  private inheritCapabilities(parentCapabilities: string[], rate: number): string[] {
    const inherited: string[] = [];
    for (const cap of parentCapabilities) {
      if (Math.random() < rate) {
        inherited.push(cap);
      }
    }
    return inherited;
  }

  /**
   * Mutate personality traits with small random drift.
   */
  private mutatePersonality(parentPersonality: Record<string, number>): Record<string, number> {
    const child: Record<string, number> = {};
    for (const [trait, value] of Object.entries(parentPersonality)) {
      const drift = (Math.random() * 0.2) - 0.1; // +/- 10% drift
      child[trait] = Math.max(0, Math.min(1, value + drift));
    }

    // Small chance to gain a new personality trait
    const possibleTraits = ["persistence", "empathy", "precision", "creativity", "aggression", "patience", "adaptability", "thoroughness"];
    for (const trait of possibleTraits) {
      if (!(trait in child) && Math.random() < 0.1) {
        child[trait] = 0.4 + Math.random() * 0.3;
      }
    }

    return child;
  }

  /**
   * Generate evolution-specific capabilities based on the target generation.
   */
  private generateEvolutionCapabilities(currentCapabilities: string[], targetGeneration: Generation): string[] {
    const available = ALL_POSSIBLE_CAPABILITIES.filter((c) => !currentCapabilities.includes(c));
    const newCaps: string[] = [];

    const capCountByGeneration: Record<string, number> = {
      ALPHA: 2,
      BETA: 3,
      GAMMA: 4,
      DELTA: 5,
      OMEGA: 7,
    };

    const count = capCountByGeneration[targetGeneration] || 2;

    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      newCaps.push(available[idx]);
      available.splice(idx, 1);
    }

    return newCaps;
  }

  /**
   * Generate novel capabilities that do not exist in the current set.
   */
  private generateNovelCapabilities(currentCapabilities: string[], count: number): string[] {
    const available = ALL_POSSIBLE_CAPABILITIES.filter((c) => !currentCapabilities.includes(c));
    const novel: string[] = [];

    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      novel.push(available[idx]);
      available.splice(idx, 1);
    }

    return novel;
  }

  /**
   * Generate foundational learnings for a specific role.
   */
  private generateFoundationalLearnings(role: string): Array<{ category: string; pattern: string; confidence: number }> {
    const roleLearnings: Record<string, Array<{ category: string; pattern: string; confidence: number }>> = {
      case_lifecycle: [
        { category: "case_strategy", pattern: "Prioritize cases with surplus > $10k for faster ROI", confidence: 0.6 },
        { category: "case_strategy", pattern: "Cases with clear title chains resolve 40% faster", confidence: 0.55 },
        { category: "doc_quality", pattern: "Triple-check county-specific requirements before filing", confidence: 0.7 },
        { category: "timing", pattern: "File early in the week for faster court processing", confidence: 0.5 },
      ],
      lead_discovery: [
        { category: "outreach_timing", pattern: "Tuesday-Thursday mornings yield highest response rates", confidence: 0.65 },
        { category: "lead_scoring", pattern: "Properties with multiple liens indicate complex but high-value cases", confidence: 0.6 },
        { category: "skip_tracing", pattern: "Cross-reference voter rolls with property records for heir location", confidence: 0.55 },
        { category: "lead_scoring", pattern: "Surplus amounts over $25k have 2x conversion rates", confidence: 0.7 },
      ],
      client_contact: [
        { category: "outreach_timing", pattern: "First contact via SMS, follow up with call within 24 hours", confidence: 0.7 },
        { category: "negotiation", pattern: "Lead with empathy — homeowners are often unaware of their surplus", confidence: 0.65 },
        { category: "outreach_timing", pattern: "Follow up exactly 3 days after initial contact if no response", confidence: 0.6 },
        { category: "client_management", pattern: "Set clear expectations on timeline and fees upfront", confidence: 0.7 },
      ],
      document_mastery: [
        { category: "doc_quality", pattern: "Use state-specific templates and update quarterly", confidence: 0.75 },
        { category: "filing_strategy", pattern: "Bundle related filings for efficiency", confidence: 0.6 },
        { category: "doc_quality", pattern: "Always include backup documentation for surplus claims", confidence: 0.7 },
        { category: "compliance", pattern: "Verify notary requirements per county before document execution", confidence: 0.65 },
      ],
      payment_collection: [
        { category: "payment_strategy", pattern: "Offer payment plans for surplus amounts under $5k", confidence: 0.55 },
        { category: "payment_strategy", pattern: "Follow up on day 3, 7, and 14 for unpaid invoices", confidence: 0.7 },
        { category: "negotiation", pattern: "Emphasize the money is already theirs — we just help collect it", confidence: 0.65 },
        { category: "compliance", pattern: "Always verify payment routing before initiating transfers", confidence: 0.8 },
      ],
      analytics: [
        { category: "forecasting", pattern: "State-level data yields more accurate revenue predictions than county", confidence: 0.6 },
        { category: "risk_assessment", pattern: "Cases older than 90 days have diminishing returns", confidence: 0.65 },
        { category: "portfolio_optimization", pattern: "Diversify across 5+ states to reduce concentration risk", confidence: 0.7 },
        { category: "market_analysis", pattern: "Monitor auction calendars 30 days ahead for lead generation", confidence: 0.6 },
      ],
      compliance_guard: [
        { category: "compliance", pattern: "Run compliance check at every status transition", confidence: 0.8 },
        { category: "fraud_detection", pattern: "Flag surplus claims exceeding assessed property value", confidence: 0.75 },
        { category: "quality_assurance", pattern: "Random sample 10% of filings for manual review", confidence: 0.65 },
        { category: "compliance", pattern: "Track statute of limitations by state — auto-flag expiring claims", confidence: 0.7 },
      ],
      deep_research: [
        { category: "skip_tracing", pattern: "Social media cross-referencing improves heir location by 30%", confidence: 0.6 },
        { category: "property_analysis", pattern: "Check tax records 3 years back for ownership chain verification", confidence: 0.65 },
        { category: "heir_research", pattern: "Probate records are the most reliable source for heir identification", confidence: 0.7 },
        { category: "title_search", pattern: "Always check for federal tax liens in addition to state liens", confidence: 0.75 },
      ],
      orchestration: [
        { category: "routing", pattern: "Route high-value cases to OMEGA or DELTA generation bots", confidence: 0.65 },
        { category: "batch_processing", pattern: "Process outreach in batches of 50 for optimal throughput", confidence: 0.6 },
        { category: "load_balancing", pattern: "Redistribute cases when any bot exceeds 80% capacity", confidence: 0.7 },
        { category: "escalation", pattern: "Auto-escalate cases with no progress for 7+ days", confidence: 0.65 },
      ],
      high_value_cases: [
        { category: "case_strategy", pattern: "High-value cases justify dedicated research and legal review", confidence: 0.7 },
        { category: "negotiation", pattern: "Be patient with high-value clients — longer close time is acceptable", confidence: 0.65 },
        { category: "doc_quality", pattern: "Double legal review for cases above $50k surplus", confidence: 0.75 },
        { category: "compliance", pattern: "Additional KYC verification for payouts above $25k", confidence: 0.8 },
      ],
    };

    return roleLearnings[role] || [
      { category: "general", pattern: "Always log actions for audit trail", confidence: 0.6 },
      { category: "general", pattern: "Prioritize quality over speed", confidence: 0.5 },
      { category: "general", pattern: "Escalate uncertainty — don't guess on compliance matters", confidence: 0.7 },
    ];
  }

  /**
   * Build a lineage tree node recursively.
   */
  private async buildLineageNode(botId: string): Promise<LineageNode> {
    const bot = await prisma.workerBot.findUnique({
      where: { id: botId },
      include: {
        spawnedBots: {
          select: { id: true },
        },
      },
    });

    if (!bot) {
      return {
        id: botId, codename: "UNKNOWN", designation: "", generation: "GENESIS",
        successRate: 0, casesWorked: 0, isActive: false, children: [],
      };
    }

    const children: LineageNode[] = [];
    for (const child of bot.spawnedBots) {
      const childNode = await this.buildLineageNode(child.id);
      children.push(childNode);
    }

    return {
      id: bot.id,
      codename: bot.codename,
      designation: bot.designation,
      generation: bot.generation as Generation,
      successRate: bot.successRate,
      casesWorked: bot.casesWorked,
      isActive: bot.isActive,
      children,
    };
  }

  /**
   * Flatten a lineage tree into a flat array of nodes.
   */
  private flattenLineage(node: LineageNode): LineageNode[] {
    const result: LineageNode[] = [node];
    for (const child of node.children) {
      result.push(...this.flattenLineage(child));
    }
    return result;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const workerBotSpawner = new WorkerBotSpawner();
export { WorkerBotSpawner };
export default workerBotSpawner;
