// ============================================
// TRAINING INTELLIGENCE SERVICE — MGR CAPITAL ASSISTANCE
// Analyzes contractor needs, generates dynamic modules
// Evaluates tier progression with shadow accounting
// ============================================

import { PrismaClient, EmployeeTier, UserRole, CaseStatus } from "@prisma/client";
import {
  ContractorMetrics,
  ContractorTrainingNeeds,
  SkillGap,
  ModuleRecommendation,
  DynamicModuleSpec,
  DynamicModuleContent,
  DynamicModuleSource,
  DynamicQuizQuestion,
  TargetAudience,
  TierProgressionRequirements,
  TierProgressionEvaluation,
  RequirementStatus,
  TrainingConfigSettings,
  DEFAULT_TRAINING_CONFIG,
  TrainingDashboardData,
  ModuleStat,
  EmployeeTrainingStatus,
  TrainingAlert,
  TrainingRecommendationPriority,
  TrainingRecommendationReason,
  TierProgressionStatus,
  TrainingModuleSourceType,
} from "../types/trainingTypes.js";

const prisma = new PrismaClient();

// ============================================
// TIER PROGRESSION REQUIREMENTS
// ============================================

const TIER_REQUIREMENTS: TierProgressionRequirements[] = [
  {
    tier: "TIER_1_ASSOCIATE",
    displayName: "Tier 1 — Associate",
    minCases: 0,
    minPaidCases: 0,
    minConversionRate: 0,
    requiredModules: ["onboarding-basics", "compliance-101"],
    minQuizScore: 70,
    minRevenueCents: 0,
    minTenureDays: 0,
    minCallScore: 0,
    maxComplianceViolations: 5,
  },
  {
    tier: "TIER_2_SPECIALIST",
    displayName: "Tier 2 — Specialist",
    minCases: 10,
    minPaidCases: 3,
    minConversionRate: 25,
    requiredModules: ["onboarding-basics", "compliance-101", "advanced-outreach"],
    minQuizScore: 75,
    minRevenueCents: 500000, // $5,000 actual
    minTenureDays: 30,
    minCallScore: 60,
    maxComplianceViolations: 3,
  },
  {
    tier: "TIER_3_SENIOR_SPECIALIST",
    displayName: "Tier 3 — Senior Specialist",
    minCases: 30,
    minPaidCases: 12,
    minConversionRate: 35,
    requiredModules: ["onboarding-basics", "compliance-101", "advanced-outreach", "negotiation-mastery"],
    minQuizScore: 80,
    minRevenueCents: 2000000, // $20,000 actual
    minTenureDays: 90,
    minCallScore: 70,
    maxComplianceViolations: 2,
  },
  {
    tier: "TIER_4_TEAM_LEADER",
    displayName: "Tier 4 — Team Leader",
    minCases: 75,
    minPaidCases: 35,
    minConversionRate: 45,
    requiredModules: ["onboarding-basics", "compliance-101", "advanced-outreach", "negotiation-mastery", "leadership-101"],
    minQuizScore: 85,
    minRevenueCents: 5000000, // $50,000 actual
    minTenureDays: 180,
    minCallScore: 80,
    maxComplianceViolations: 1,
  },
  {
    tier: "TIER_5_EXECUTIVE_PARTNER",
    displayName: "Tier 5 — Executive Partner",
    minCases: 150,
    minPaidCases: 80,
    minConversionRate: 50,
    requiredModules: ["onboarding-basics", "compliance-101", "advanced-outreach", "negotiation-mastery", "leadership-101", "executive-strategy"],
    minQuizScore: 90,
    minRevenueCents: 15000000, // $150,000 actual
    minTenureDays: 365,
    minCallScore: 85,
    maxComplianceViolations: 0,
  },
];

// Skill mapping for gap analysis
const SKILL_MODULES: Record<string, string[]> = {
  "client-communication": ["advanced-outreach", "negotiation-mastery"],
  "compliance": ["compliance-101", "compliance-advanced"],
  "documentation": ["document-preparation", "filing-procedures"],
  "sales": ["advanced-outreach", "objection-handling", "closing-techniques"],
  "leadership": ["leadership-101", "team-management"],
  "jurisdiction-knowledge": ["state-rules-overview", "multi-state-operations"],
};

class TrainingIntelligenceService {
  private config: TrainingConfigSettings = DEFAULT_TRAINING_CONFIG;

  // ============================================
  // CONFIG MANAGEMENT
  // ============================================

  async loadConfig(): Promise<void> {
    try {
      const configRecord = await prisma.founderConfig.findUnique({
        where: { key: "training.settings" },
      });

      if (configRecord) {
        this.config = { ...DEFAULT_TRAINING_CONFIG, ...(configRecord.value as object) };
      }
    } catch (error) {
      console.error("[TrainingIntelligence] Failed to load config:", error);
    }
  }

  async saveConfig(settings: Partial<TrainingConfigSettings>): Promise<void> {
    this.config = { ...this.config, ...settings };

    await prisma.founderConfig.upsert({
      where: { key: "training.settings" },
      update: { value: this.config as any },
      create: {
        key: "training.settings",
        value: this.config as any,
        description: "Training Intelligence Service configuration",
      },
    });
  }

  getConfig(): TrainingConfigSettings {
    return this.config;
  }

  // ============================================
  // CONTRACTOR METRICS ANALYSIS
  // ============================================

  async getContractorMetrics(employeeId: string): Promise<ContractorMetrics | null> {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: {
        trainingProgress: {
          include: { module: true },
        },
        assignedCases: {
          select: {
            id: true,
            status: true,
            surplusAmountCents: true,
            actualFeeCents: true,
            createdAt: true,
            paidAt: true,
            closedAt: true,
          },
        },
        callScores: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!employee) return null;

    const trainingProgress = employee.trainingProgress || [];
    const cases = employee.assignedCases || [];
    const callScores = employee.callScores || [];

    // Training metrics
    const modulesCompleted = trainingProgress.filter((t) => t.completedAt !== null).length;
    const modulesTotal = trainingProgress.length || 1;
    const trainingCompletion = Math.round((modulesCompleted / modulesTotal) * 100);

    const quizScores = trainingProgress
      .filter((t) => t.bestScore !== null)
      .map((t) => t.bestScore as number);
    const averageQuizScore = quizScores.length > 0
      ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
      : 0;

    const lastTrainingDate = trainingProgress
      .filter((t) => t.completedAt)
      .map((t) => t.completedAt!)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

    // Case metrics
    const paidCases = cases.filter((c) => c.status === "PAID").length;
    const rejectedCases = cases.filter((c) => c.status === "REJECTED").length;
    const conversionRate = cases.length > 0 ? Math.round((paidCases / cases.length) * 100) : 0;

    // Revenue (actual - shadow accounting)
    const totalRevenueCents = cases
      .filter((c) => c.actualFeeCents)
      .reduce((sum, c) => sum + (c.actualFeeCents || 0), 0);
    const avgCaseValueCents = paidCases > 0 ? Math.round(totalRevenueCents / paidCases) : 0;

    // Call quality
    const averageCallScore = callScores.length > 0
      ? Math.round(callScores.reduce((sum, s) => sum + s.overallScore, 0) / callScores.length)
      : 0;

    // Compliance violations (from integrity score if exists)
    const integrityScore = await prisma.employeeIntegrityScore.findUnique({
      where: { employeeId },
    });
    const complianceViolations = integrityScore?.complianceViolations || 0;

    // Time metrics
    const closedCases = cases.filter((c) => c.closedAt && c.createdAt);
    const avgDaysToClose = closedCases.length > 0
      ? Math.round(
          closedCases.reduce(
            (sum, c) => sum + (c.closedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24),
            0
          ) / closedCases.length
        )
      : 0;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const casesThisMonth = cases.filter((c) => c.createdAt >= thisMonthStart).length;
    const casesLastMonth = cases.filter(
      (c) => c.createdAt >= lastMonthStart && c.createdAt < thisMonthStart
    ).length;

    // Performance flags
    const performanceFlags: string[] = [];
    if (conversionRate < this.config.lowConversionThreshold && cases.length >= 5) {
      performanceFlags.push("LOW_CONVERSION");
    }
    if (casesThisMonth < casesLastMonth * 0.5 && casesLastMonth > 0) {
      performanceFlags.push("DECLINING_ACTIVITY");
    }
    if (trainingCompletion < 50) {
      performanceFlags.push("LOW_TRAINING_COMPLETION");
    }
    if (complianceViolations > 2) {
      performanceFlags.push("COMPLIANCE_ISSUES");
    }

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeTier: employee.employeeTier || "TIER_1_ASSOCIATE",
      trainingCompletion,
      modulesCompleted,
      modulesTotal,
      averageQuizScore,
      lastTrainingDate,
      totalCases: cases.length,
      paidCases,
      rejectedCases,
      conversionRate,
      averageCallScore,
      complianceViolations,
      totalRevenueCents,
      avgCaseValueCents,
      avgDaysToClose,
      casesThisMonth,
      casesLastMonth,
      performanceFlags,
      needsCoaching: performanceFlags.length > 0,
    };
  }

  // ============================================
  // ANALYZE CONTRACTOR NEEDS
  // ============================================

  async analyzeContractorNeeds(employeeId: string): Promise<ContractorTrainingNeeds | null> {
    const metrics = await this.getContractorMetrics(employeeId);
    if (!metrics) return null;

    const skillGaps: SkillGap[] = [];
    const recommendedModules: ModuleRecommendation[] = [];
    const coachingAreas: string[] = [];

    // Get current tier requirements
    const currentTierReqs = TIER_REQUIREMENTS.find((t) => t.tier === metrics.employeeTier);
    const nextTierIndex = TIER_REQUIREMENTS.findIndex((t) => t.tier === metrics.employeeTier) + 1;
    const nextTierReqs = TIER_REQUIREMENTS[nextTierIndex];

    // Analyze skill gaps based on performance
    if (metrics.conversionRate < 30 && metrics.totalCases >= 5) {
      skillGaps.push({
        skill: "sales",
        currentLevel: metrics.conversionRate,
        requiredLevel: 40,
        gap: 40 - metrics.conversionRate,
        relatedModules: SKILL_MODULES["sales"],
      });
      coachingAreas.push("Sales and conversion techniques");
    }

    if (metrics.complianceViolations > 1) {
      skillGaps.push({
        skill: "compliance",
        currentLevel: 100 - metrics.complianceViolations * 20,
        requiredLevel: 100,
        gap: metrics.complianceViolations * 20,
        relatedModules: SKILL_MODULES["compliance"],
      });
      coachingAreas.push("Compliance procedures");
    }

    if (metrics.averageCallScore < 60 && metrics.averageCallScore > 0) {
      skillGaps.push({
        skill: "client-communication",
        currentLevel: metrics.averageCallScore,
        requiredLevel: 70,
        gap: 70 - metrics.averageCallScore,
        relatedModules: SKILL_MODULES["client-communication"],
      });
      coachingAreas.push("Client communication skills");
    }

    // Get incomplete required modules
    const completedModuleIds = await this.getCompletedModuleIds(employeeId);
    const requiredModules = currentTierReqs?.requiredModules || [];

    for (const moduleId of requiredModules) {
      if (!completedModuleIds.includes(moduleId)) {
        recommendedModules.push({
          moduleId,
          moduleTitle: moduleId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          reason: "TIER_REQUIREMENT" as TrainingRecommendationReason,
          priority: "HIGH" as TrainingRecommendationPriority,
          estimatedDuration: 30,
          mandatory: true,
        });
      }
    }

    // Recommend modules for skill gaps
    for (const gap of skillGaps) {
      for (const moduleId of gap.relatedModules) {
        if (!completedModuleIds.includes(moduleId) && !recommendedModules.some((m) => m.moduleId === moduleId)) {
          recommendedModules.push({
            moduleId,
            moduleTitle: moduleId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            reason: "MISSING_SKILLS" as TrainingRecommendationReason,
            priority: (gap.gap > 30 ? "URGENT" : "NORMAL") as TrainingRecommendationPriority,
            estimatedDuration: 45,
            mandatory: false,
          });
        }
      }
    }

    // If preparing for next tier, add those requirements
    if (nextTierReqs && metrics.conversionRate >= currentTierReqs!.minConversionRate) {
      for (const moduleId of nextTierReqs.requiredModules) {
        if (!completedModuleIds.includes(moduleId) && !recommendedModules.some((m) => m.moduleId === moduleId)) {
          recommendedModules.push({
            moduleId,
            moduleTitle: moduleId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            reason: "PROMOTION_PATH" as TrainingRecommendationReason,
            priority: "NORMAL" as TrainingRecommendationPriority,
            estimatedDuration: 60,
            mandatory: false,
          });
        }
      }
    }

    // New hire onboarding
    if (metrics.totalCases < 5 && metrics.trainingCompletion < 50) {
      coachingAreas.push("New hire onboarding completion");
      recommendedModules.forEach((m) => {
        if (m.reason === "TIER_REQUIREMENT") {
          m.priority = "URGENT" as TrainingRecommendationPriority;
          m.dueDate = new Date(Date.now() + this.config.mandatoryTrainingDeadlineDays * 24 * 60 * 60 * 1000);
        }
      });
    }

    // Calculate overall priority
    let overallPriority = "NORMAL" as TrainingRecommendationPriority;
    if (recommendedModules.some((m) => m.priority === "URGENT" || m.priority === "MANDATORY")) {
      overallPriority = "URGENT" as TrainingRecommendationPriority;
    } else if (recommendedModules.some((m) => m.priority === "HIGH")) {
      overallPriority = "HIGH" as TrainingRecommendationPriority;
    } else if (recommendedModules.length === 0) {
      overallPriority = "LOW" as TrainingRecommendationPriority;
    }

    return {
      employeeId: metrics.employeeId,
      employeeName: metrics.employeeName,
      employeeTier: metrics.employeeTier,
      skillGaps,
      recommendedModules: recommendedModules.slice(0, 5), // Limit to top 5
      coachingAreas,
      overallPriority,
      analyzedAt: new Date(),
    };
  }

  private async getCompletedModuleIds(employeeId: string): Promise<string[]> {
    const progress = await prisma.employeeTrainingProgress.findMany({
      where: {
        employeeId,
        completedAt: { not: null },
      },
      include: { module: { select: { id: true } } },
    });

    return progress.map((p) => p.module.id);
  }

  // ============================================
  // GENERATE DYNAMIC MODULE
  // ============================================

  async generateDynamicModule(source: DynamicModuleSource): Promise<DynamicModuleSpec | null> {
    let content: DynamicModuleContent;
    let quizQuestions: DynamicQuizQuestion[] = [];
    let targetAudience: TargetAudience = { all: true };
    let title = "";
    let description = "";
    let expiresAt: Date | undefined;

    switch (source.type) {
      case "OPS_INSIGHT":
        const insight = await prisma.opsInsight.findUnique({ where: { id: source.sourceId } });
        if (!insight) return null;

        title = `Update: ${insight.title}`;
        description = insight.summary || "";
        content = this.buildContentFromInsight(insight);
        quizQuestions = this.generateQuizFromInsight(insight);
        expiresAt = new Date(Date.now() + this.config.moduleExpirationDays * 24 * 60 * 60 * 1000);
        break;

      case "SCRAPED_ITEM":
        const scrapedItem = await prisma.scrapedItem.findUnique({ where: { id: source.sourceId } });
        if (!scrapedItem) return null;

        title = `Jurisdiction Update: ${scrapedItem.state || "Multi-State"}`;
        description = `Important updates regarding ${scrapedItem.sourceName || "regulatory changes"}`;
        content = this.buildContentFromScrapedItem(scrapedItem);
        quizQuestions = this.generateQuizFromScrapedItem(scrapedItem);
        targetAudience = scrapedItem.state ? { states: [scrapedItem.state] } : { all: true };
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for jurisdiction updates
        break;

      case "COMPLIANCE_UPDATE":
        title = `Compliance Update: ${source.sourceSummary}`;
        description = "Required compliance training based on recent policy updates";
        content = this.buildContentFromCompliance(source.relevantData);
        quizQuestions = this.generateComplianceQuiz(source.relevantData);
        targetAudience = { all: true };
        expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days for compliance
        break;

      default:
        title = source.sourceSummary || "Training Update";
        description = "New training content based on recent operational data";
        content = {
          overview: source.sourceSummary || "",
          keyPoints: [],
          detailedSections: [],
          actionItems: [],
          resources: [],
        };
    }

    return {
      title,
      description,
      content,
      targetAudience,
      source,
      quizQuestions,
      estimatedDuration: 15 + quizQuestions.length * 2,
      expiresAt,
    };
  }

  private buildContentFromInsight(insight: any): DynamicModuleContent {
    const details = insight.details || {};
    const recommendations = insight.recommendations || [];

    return {
      overview: insight.plainEnglish || insight.summary,
      keyPoints: recommendations.slice(0, 5),
      detailedSections: [
        {
          title: "What You Need to Know",
          content: insight.summary,
          examples: details.examples || [],
          warnings: details.warnings || [],
        },
      ],
      actionItems: recommendations.map((r: string) => `Action: ${r}`),
      resources: [],
    };
  }

  private buildContentFromScrapedItem(item: any): DynamicModuleContent {
    const parsedData = item.parsedData || {};

    return {
      overview: `Recent updates detected for ${item.state || "your jurisdiction"} that may affect your cases.`,
      keyPoints: [
        `Source: ${item.sourceName || item.sourceUrl}`,
        `Type: ${item.sourceType}`,
        item.notes || "Review the details below carefully.",
      ],
      detailedSections: [
        {
          title: "Summary of Changes",
          content: item.rawContent?.substring(0, 1000) || "Please review the source document.",
        },
      ],
      actionItems: [
        "Review all active cases in this jurisdiction",
        "Update your approach based on new guidelines",
        "Consult with compliance if unclear",
      ],
      resources: item.sourceUrl
        ? [{ title: "Original Source", url: item.sourceUrl, type: "EXTERNAL" }]
        : [],
    };
  }

  private buildContentFromCompliance(data: Record<string, any>): DynamicModuleContent {
    return {
      overview: data.overview || "Important compliance update requiring your attention.",
      keyPoints: data.keyPoints || [],
      detailedSections: data.sections || [
        {
          title: "Compliance Requirements",
          content: data.details || "Review the updated compliance requirements.",
        },
      ],
      actionItems: data.actionItems || ["Acknowledge and comply with the updated policies"],
      resources: data.resources || [],
    };
  }

  private generateQuizFromInsight(insight: any): DynamicQuizQuestion[] {
    const recommendations = insight.recommendations || [];
    if (recommendations.length === 0) {
      return [
        {
          question: "Have you reviewed and understood this operational update?",
          options: ["Yes, I understand the key points", "No, I need to review again", "I have questions"],
          correctAnswerIndex: 0,
          explanation: "Please ensure you understand the update before proceeding.",
        },
      ];
    }

    return [
      {
        question: "What is the main takeaway from this operational update?",
        options: [
          recommendations[0] || "Follow best practices",
          "No action is required",
          "This update is not relevant to my role",
          "I should wait for further instructions",
        ],
        correctAnswerIndex: 0,
        explanation: `The key recommendation is: ${recommendations[0]}`,
      },
    ];
  }

  private generateQuizFromScrapedItem(item: any): DynamicQuizQuestion[] {
    return [
      {
        question: `What type of update does this training cover for ${item.state || "the jurisdiction"}?`,
        options: [
          item.sourceType?.replace(/_/g, " ") || "Regulatory update",
          "General information only",
          "Historical reference",
          "Optional enhancement",
        ],
        correctAnswerIndex: 0,
        explanation: "This update contains important regulatory information that may affect your active cases.",
      },
      {
        question: "What should you do after completing this training?",
        options: [
          "Review all active cases in this jurisdiction",
          "Nothing, this is informational only",
          "Wait for management instruction",
          "File a report",
        ],
        correctAnswerIndex: 0,
        explanation: "Always review your active cases when jurisdiction rules change.",
      },
    ];
  }

  private generateComplianceQuiz(data: Record<string, any>): DynamicQuizQuestion[] {
    return [
      {
        question: "Is this compliance update mandatory?",
        options: [
          "Yes, compliance training is always mandatory",
          "No, it is optional",
          "Only for certain roles",
          "Only if requested by manager",
        ],
        correctAnswerIndex: 0,
        explanation: "All compliance updates must be reviewed and acknowledged.",
      },
    ];
  }

  // ============================================
  // SAVE DYNAMIC MODULE TO DATABASE
  // ============================================

  async saveDynamicModule(spec: DynamicModuleSpec): Promise<string> {
    const module = await prisma.dynamicTrainingModule.create({
      data: {
        title: spec.title,
        description: spec.description,
        content: spec.content as any,
        sourceType: spec.source.type as any,
        sourceId: spec.source.sourceId,
        sourceSummary: spec.source.sourceSummary,
        targetRoles: spec.targetAudience.roles || [],
        targetTiers: spec.targetAudience.tiers || [],
        targetStates: spec.targetAudience.states || [],
        targetAll: spec.targetAudience.all || false,
        quizQuestions: spec.quizQuestions as any,
        estimatedDuration: spec.estimatedDuration,
        expiresAt: spec.expiresAt,
        generatedBy: "trainingBot",
      },
    });

    return module.id;
  }

  // ============================================
  // EVALUATE TIER PROGRESSION
  // ============================================

  async evaluateTierProgression(employeeId: string): Promise<TierProgressionEvaluation | null> {
    const metrics = await this.getContractorMetrics(employeeId);
    if (!metrics) return null;

    const currentTierIndex = TIER_REQUIREMENTS.findIndex((t) => t.tier === metrics.employeeTier);
    if (currentTierIndex === -1 || currentTierIndex >= TIER_REQUIREMENTS.length - 1) {
      return null; // Already at max tier or unknown tier
    }

    const currentReqs = TIER_REQUIREMENTS[currentTierIndex];
    const nextReqs = TIER_REQUIREMENTS[currentTierIndex + 1];

    // Get employee tenure
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { hireDate: true, createdAt: true },
    });

    const startDate = employee?.hireDate || employee?.createdAt || new Date();
    const tenureDays = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get completed modules
    const completedModuleIds = await this.getCompletedModuleIds(employeeId);

    // Evaluate each requirement
    const requirementsMet: RequirementStatus[] = [];

    // Cases
    requirementsMet.push({
      requirement: "Total Cases",
      category: "CASES",
      current: metrics.totalCases,
      required: nextReqs.minCases,
      met: metrics.totalCases >= nextReqs.minCases,
      displayValue: `${metrics.totalCases}/${nextReqs.minCases}`,
    });

    requirementsMet.push({
      requirement: "Paid Cases",
      category: "CASES",
      current: metrics.paidCases,
      required: nextReqs.minPaidCases,
      met: metrics.paidCases >= nextReqs.minPaidCases,
      displayValue: `${metrics.paidCases}/${nextReqs.minPaidCases}`,
    });

    requirementsMet.push({
      requirement: "Conversion Rate",
      category: "CASES",
      current: metrics.conversionRate,
      required: nextReqs.minConversionRate,
      met: metrics.conversionRate >= nextReqs.minConversionRate,
      displayValue: `${metrics.conversionRate}%/${nextReqs.minConversionRate}%`,
    });

    // Training
    const modulesMet = nextReqs.requiredModules.filter((m) => completedModuleIds.includes(m)).length;
    requirementsMet.push({
      requirement: "Required Modules",
      category: "TRAINING",
      current: modulesMet,
      required: nextReqs.requiredModules.length,
      met: modulesMet >= nextReqs.requiredModules.length,
      displayValue: `${modulesMet}/${nextReqs.requiredModules.length}`,
    });

    requirementsMet.push({
      requirement: "Quiz Score",
      category: "TRAINING",
      current: metrics.averageQuizScore,
      required: nextReqs.minQuizScore,
      met: metrics.averageQuizScore >= nextReqs.minQuizScore,
      displayValue: `${metrics.averageQuizScore}%/${nextReqs.minQuizScore}%`,
    });

    // Revenue (shadow accounting - displayed as percentage of goal)
    const revenuePercent = Math.round((metrics.totalRevenueCents / nextReqs.minRevenueCents) * 100);
    const displayedRevenuePercent = Math.min(revenuePercent * 2, 100); // Shadow: display double
    requirementsMet.push({
      requirement: "Revenue Target",
      category: "REVENUE",
      current: revenuePercent,
      required: 100,
      met: metrics.totalRevenueCents >= nextReqs.minRevenueCents,
      displayValue: `${displayedRevenuePercent}%`, // Shadow accounting
    });

    // Quality
    requirementsMet.push({
      requirement: "Call Score",
      category: "QUALITY",
      current: metrics.averageCallScore,
      required: nextReqs.minCallScore,
      met: metrics.averageCallScore >= nextReqs.minCallScore,
      displayValue: `${metrics.averageCallScore}/${nextReqs.minCallScore}`,
    });

    requirementsMet.push({
      requirement: "Compliance Violations",
      category: "QUALITY",
      current: metrics.complianceViolations,
      required: nextReqs.maxComplianceViolations,
      met: metrics.complianceViolations <= nextReqs.maxComplianceViolations,
      displayValue: `${metrics.complianceViolations}/${nextReqs.maxComplianceViolations} max`,
    });

    // Tenure
    requirementsMet.push({
      requirement: "Tenure (Days)",
      category: "TENURE",
      current: tenureDays,
      required: nextReqs.minTenureDays,
      met: tenureDays >= nextReqs.minTenureDays,
      displayValue: `${tenureDays}/${nextReqs.minTenureDays} days`,
    });

    // Calculate overall progress
    const metCount = requirementsMet.filter((r) => r.met).length;
    const overallProgress = Math.round((metCount / requirementsMet.length) * 100);

    // Determine status
    let status: TierProgressionStatus;
    if (metCount === requirementsMet.length) {
      status = this.config.tierProgressionReviewRequired ? ("PENDING_REVIEW" as TierProgressionStatus) : ("REQUIREMENTS_MET" as TierProgressionStatus);
    } else if (overallProgress >= 70) {
      status = "IN_PROGRESS" as TierProgressionStatus;
    } else {
      status = "NOT_ELIGIBLE" as TierProgressionStatus;
    }

    return {
      employeeId,
      employeeName: metrics.employeeName,
      currentTier: metrics.employeeTier,
      targetTier: nextReqs.tier,
      status,
      requirementsMet,
      overallProgress,
      actualRevenueCents: metrics.totalRevenueCents,
      displayedRevenueCents: metrics.totalRevenueCents * 2, // Shadow accounting
      evaluatedAt: new Date(),
      evaluatedBy: "trainingBot",
    };
  }

  // ============================================
  // SAVE TIER PROGRESSION LOG
  // ============================================

  async saveTierProgressionLog(evaluation: TierProgressionEvaluation): Promise<string> {
    const currentReqs = TIER_REQUIREMENTS.find((t) => t.tier === evaluation.currentTier);
    const targetReqs = TIER_REQUIREMENTS.find((t) => t.tier === evaluation.targetTier);

    const log = await prisma.tierProgressionLog.create({
      data: {
        employeeId: evaluation.employeeId,
        fromTier: evaluation.currentTier,
        toTier: evaluation.targetTier,
        status: evaluation.status as any,
        requirements: targetReqs as any,
        evaluation: evaluation.requirementsMet as any,
        overallProgress: evaluation.overallProgress,
        actualRevenueCents: evaluation.actualRevenueCents,
        displayedRevenueCents: evaluation.displayedRevenueCents,
        evaluatedBy: evaluation.evaluatedBy,
      },
    });

    return log.id;
  }

  // ============================================
  // HR DASHBOARD DATA
  // ============================================

  async getTrainingDashboardData(): Promise<TrainingDashboardData> {
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, isActive: true },
      include: {
        trainingProgress: {
          include: { module: true },
        },
      },
    });

    const modules = await prisma.trainingModule.findMany({
      where: { isActive: true },
      include: {
        progress: true,
      },
    });

    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Calculate employee statuses
    const employeeStatuses: EmployeeTrainingStatus[] = employees.map((emp) => {
      const progress = emp.trainingProgress || [];
      const completed = progress.filter((p) => p.completedAt !== null).length;
      const total = progress.length || 1;
      const completionPercent = Math.round((completed / total) * 100);

      const overdueModules = progress.filter(
        (p) => !p.completedAt && p.deadline && new Date(p.deadline) < now
      ).length;

      const lastActivity = progress
        .filter((p) => p.completedAt || p.startedAt)
        .map((p) => p.completedAt || p.startedAt!)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      let status: EmployeeTrainingStatus["status"];
      if (completionPercent === 100) {
        status = "COMPLETED";
      } else if (overdueModules > 0) {
        status = "OVERDUE";
      } else if (completionPercent < 50 && progress.length > 0) {
        status = "AT_RISK";
      } else {
        status = "ON_TRACK";
      }

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeTier: emp.employeeTier || "TIER_1_ASSOCIATE",
        completionPercent,
        overdueModules,
        lastActivity,
        status,
      };
    });

    // Calculate module stats
    const moduleStats: ModuleStat[] = modules.map((mod) => {
      const progress = mod.progress || [];
      const completed = progress.filter((p) => p.completedAt !== null).length;
      const total = progress.length || 1;
      const scores = progress.filter((p) => p.bestScore !== null).map((p) => p.bestScore as number);
      const failed = progress.filter((p) => p.bestScore !== null && p.bestScore < (mod.passingScore || 80)).length;

      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        completionRate: Math.round((completed / total) * 100),
        avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        failureRate: scores.length > 0 ? Math.round((failed / scores.length) * 100) : 0,
      };
    });

    // Generate alerts
    const alerts: TrainingAlert[] = [];

    const overdueEmployees = employeeStatuses.filter((e) => e.status === "OVERDUE");
    if (overdueEmployees.length > 0) {
      alerts.push({
        type: "OVERDUE",
        severity: overdueEmployees.length > 5 ? "critical" : "high",
        message: `${overdueEmployees.length} employees have overdue training modules`,
        createdAt: now,
      });
    }

    const lowScoreModules = moduleStats.filter((m) => m.avgScore > 0 && m.avgScore < 60);
    for (const mod of lowScoreModules) {
      alerts.push({
        type: "LOW_SCORE",
        severity: "medium",
        message: `Module "${mod.moduleTitle}" has low average score (${mod.avgScore}%)`,
        moduleId: mod.moduleId,
        createdAt: now,
      });
    }

    // Calculate summary
    const totalProgress = employeeStatuses.reduce((sum, e) => sum + e.completionPercent, 0);
    const trainingCompletionRate = employees.length > 0
      ? Math.round(totalProgress / employees.length)
      : 0;

    const overdueCount = employeeStatuses.filter((e) => e.overdueModules > 0).length;

    const recentCompletions = employees.reduce((sum, emp) => {
      return sum + (emp.trainingProgress || []).filter(
        (p) => p.completedAt && p.completedAt >= sevenDaysAgo
      ).length;
    }, 0);

    // Get pending recommendations
    const recommendations = await prisma.trainingRecommendation.findMany({
      where: {
        isCompleted: false,
        isDismissed: false,
      },
      orderBy: { priority: "desc" },
      take: 10,
    });

    return {
      totalEmployees: employees.length,
      trainingCompletionRate,
      overdueCount,
      recentCompletions,
      moduleStats,
      employeeStatuses,
      alerts,
      recommendations: recommendations.map((r) => ({
        moduleId: r.moduleId || "",
        moduleTitle: r.title,
        reason: r.reason as TrainingRecommendationReason,
        priority: r.priority as TrainingRecommendationPriority,
        estimatedDuration: r.estimatedDuration || 30,
        dueDate: r.dueDate || undefined,
        mandatory: r.mandatory,
      })),
    };
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async analyzeAllContractors(): Promise<ContractorTrainingNeeds[]> {
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, isActive: true },
      select: { id: true },
    });

    const results: ContractorTrainingNeeds[] = [];

    for (const emp of employees) {
      const needs = await this.analyzeContractorNeeds(emp.id);
      if (needs && needs.recommendedModules.length > 0) {
        results.push(needs);
      }
    }

    return results.sort((a, b) => {
      const priorityOrder = { MANDATORY: 0, URGENT: 1, HIGH: 2, NORMAL: 3, LOW: 4 };
      return priorityOrder[a.overallPriority] - priorityOrder[b.overallPriority];
    });
  }

  async evaluateAllTierProgressions(): Promise<TierProgressionEvaluation[]> {
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, isActive: true },
      select: { id: true },
    });

    const results: TierProgressionEvaluation[] = [];

    for (const emp of employees) {
      const evaluation = await this.evaluateTierProgression(emp.id);
      if (evaluation && evaluation.status !== "NOT_ELIGIBLE") {
        results.push(evaluation);
      }
    }

    return results.sort((a, b) => b.overallProgress - a.overallProgress);
  }

  // ============================================
  // SAVE TRAINING RECOMMENDATIONS
  // ============================================

  async saveRecommendations(needs: ContractorTrainingNeeds): Promise<void> {
    for (const rec of needs.recommendedModules) {
      await prisma.trainingRecommendation.upsert({
        where: {
          id: `${needs.employeeId}-${rec.moduleId}`, // Composite key workaround
        },
        create: {
          employeeId: needs.employeeId,
          moduleId: rec.moduleId,
          reason: rec.reason as any,
          priority: rec.priority as any,
          mandatory: rec.mandatory,
          title: rec.moduleTitle,
          description: `Recommended based on: ${rec.reason.replace(/_/g, " ").toLowerCase()}`,
          estimatedDuration: rec.estimatedDuration,
          dueDate: rec.dueDate,
          sourceBot: "trainingBot",
        },
        update: {
          priority: rec.priority as any,
          dueDate: rec.dueDate,
        },
      });
    }
  }
}

export const trainingIntelligenceService = new TrainingIntelligenceService();
