// ============================================
// TRAINING BOT — MGR CAPITAL ASSISTANCE
// Enhanced Training Intelligence Layer
// Personalized recommendations, dynamic modules
// Auto-tier progression with shadow accounting
// ============================================

import { PrismaClient, OpsInsightType, OpsInsightPriority, EmployeeTier } from "@prisma/client";
import { trainingIntelligenceService } from "../services/TrainingIntelligenceService.js";
import { notificationService } from "../services/notificationService.js";
import { botSubscriptionService } from "../services/BotSubscriptionService.js";
import logger from "../utils/logger.js";
import {
  TrainingBotAnalysis,
  ContractorTrainingNeeds,
  TierProgressionEvaluation,
  DynamicModuleSpec,
  PerformanceCorrelation,
  TrainingPattern,
  UrgentTrainingAction,
  TrainingModuleSourceType,
} from "../types/trainingTypes.js";

const prisma = new PrismaClient();

const BOT_NAME = "trainingBot";

class TrainingBot {
  // ============================================
  // MAIN ANALYSIS — ENHANCED
  // ============================================

  /**
   * Run full training intelligence analysis
   */
  async analyze(): Promise<TrainingBotAnalysis> {
    const startTime = Date.now();

    // Load config
    await trainingIntelligenceService.loadConfig();
    const config = trainingIntelligenceService.getConfig();

    // Get all employees
    const employees = await prisma.user.findMany({
      where: { role: { in: ["EMPLOYEE", "TEAM_LEAD"] }, isActive: true },
      include: {
        trainingProgress: {
          include: { module: true },
        },
        assignedCases: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    });

    const modules = await prisma.trainingModule.findMany({
      where: { isActive: true },
    });

    // 1. Analyze all contractors for training needs
    const allNeeds = await trainingIntelligenceService.analyzeAllContractors();
    const needsCoaching = allNeeds.filter((n) => n.recommendedModules.length > 0);

    // 2. Evaluate tier progressions
    const allProgressions = await trainingIntelligenceService.evaluateAllTierProgressions();
    const eligibleForPromotion = allProgressions.filter(
      (p) => p.status === "REQUIREMENTS_MET" || p.status === "PENDING_REVIEW"
    );

    // 3. Generate dynamic modules from recent insights
    const newModulesGenerated: DynamicModuleSpec[] = [];
    if (config.autoGenerateModulesFromInsights) {
      const dynamicModules = await this.generateModulesFromInsights(config.insightTypesForModules);
      newModulesGenerated.push(...dynamicModules);
    }

    // 4. Calculate metrics
    const totalAssignments = employees.reduce(
      (sum, e) => sum + e.trainingProgress.length,
      0
    );
    const completedAssignments = employees.reduce(
      (sum, e) => sum + e.trainingProgress.filter((t) => t.completedAt !== null).length,
      0
    );
    const overallCompletionRate =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    // Calculate average quiz score
    const allScores: number[] = [];
    for (const emp of employees) {
      for (const progress of emp.trainingProgress) {
        if (progress.bestScore !== null) {
          allScores.push(progress.bestScore);
        }
      }
    }
    const avgQuizScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

    // 5. Analyze training-performance correlation
    const trainingCorrelation = this.analyzeCorrelation(employees);

    // 6. Detect patterns
    const patterns = this.detectPatterns(employees, modules, needsCoaching);

    // 7. Generate recommendations
    const recommendations = this.generateRecommendations(
      needsCoaching,
      eligibleForPromotion,
      overallCompletionRate,
      patterns
    );

    // 8. Save recommendations to database
    for (const needs of needsCoaching) {
      await trainingIntelligenceService.saveRecommendations(needs);
    }

    // 9. Save tier progression logs
    for (const progression of eligibleForPromotion) {
      await trainingIntelligenceService.saveTierProgressionLog(progression);
    }

    // Build analysis result
    const analysis: TrainingBotAnalysis = {
      analysisDate: new Date(),
      totalEmployees: employees.length,
      employeesAnalyzed: employees.length,
      needsCoaching,
      eligibleForPromotion,
      newModulesGenerated,
      overallCompletionRate,
      avgQuizScore,
      trainingCorrelation,
      recommendations,
      plainEnglish: "", // Will be generated below
    };

    analysis.plainEnglish = this.generatePlainEnglish(analysis, patterns);

    // 10. Save insight
    await this.saveInsight(analysis, patterns);

    // 11. Log bot run
    await this.logBotRun(startTime, analysis);

    return analysis;
  }

  // ============================================
  // GENERATE MODULES FROM INSIGHTS
  // ============================================

  private async generateModulesFromInsights(insightTypes: string[]): Promise<DynamicModuleSpec[]> {
    const generatedModules: DynamicModuleSpec[] = [];

    // Get recent actionable insights
    const recentInsights = await prisma.opsInsight.findMany({
      where: {
        type: { in: insightTypes as any[] },
        isActioned: false,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { priority: "desc" },
      take: 5,
    });

    for (const insight of recentInsights) {
      // Check if module already exists for this insight
      const existingModule = await prisma.dynamicTrainingModule.findFirst({
        where: { sourceId: insight.id },
      });

      if (!existingModule) {
        const moduleSpec = await trainingIntelligenceService.generateDynamicModule({
          type: TrainingModuleSourceType.OPS_INSIGHT,
          sourceId: insight.id,
          sourceSummary: insight.summary || "",
          relevantData: insight.details as any || {},
        });

        if (moduleSpec) {
          await trainingIntelligenceService.saveDynamicModule(moduleSpec);
          generatedModules.push(moduleSpec);
        }
      }
    }

    // Get recent actionable scraped items (jurisdiction changes)
    const recentScrapedItems = await prisma.scrapedItem.findMany({
      where: {
        reviewStatus: "ACTIONABLE",
        fetchedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      take: 3,
    });

    for (const item of recentScrapedItems) {
      const existingModule = await prisma.dynamicTrainingModule.findFirst({
        where: { sourceId: item.id },
      });

      if (!existingModule) {
        const moduleSpec = await trainingIntelligenceService.generateDynamicModule({
          type: TrainingModuleSourceType.SCRAPED_ITEM,
          sourceId: item.id,
          sourceSummary: item.sourceName || item.sourceType,
          relevantData: item.parsedData as any || {},
        });

        if (moduleSpec) {
          await trainingIntelligenceService.saveDynamicModule(moduleSpec);
          generatedModules.push(moduleSpec);
        }
      }
    }

    return generatedModules;
  }

  // ============================================
  // CORRELATION ANALYSIS
  // ============================================

  private analyzeCorrelation(employees: any[]): PerformanceCorrelation {
    // Split employees into trained (>80% completion) and untrained (<50%)
    const trained = employees.filter((e) => {
      const completion =
        e.trainingProgress.length > 0
          ? e.trainingProgress.filter((t: any) => t.completedAt !== null).length /
            e.trainingProgress.length
          : 0;
      return completion >= 0.8;
    });

    const untrained = employees.filter((e) => {
      const completion =
        e.trainingProgress.length > 0
          ? e.trainingProgress.filter((t: any) => t.completedAt !== null).length /
            e.trainingProgress.length
          : 0;
      return completion < 0.5;
    });

    const trainedMetrics = this.calculateGroupMetrics(trained);
    const untrainedMetrics = this.calculateGroupMetrics(untrained);

    const conversionDiff = trainedMetrics.avgConversion - untrainedMetrics.avgConversion;

    let correlation: PerformanceCorrelation["correlation"];
    let description: string;

    if (conversionDiff > 20) {
      correlation = "strong";
      description = "Training completion strongly correlates with better performance. Trained employees convert at significantly higher rates.";
    } else if (conversionDiff > 10) {
      correlation = "moderate";
      description = "Training completion shows moderate impact on performance. Consider enforcing training requirements.";
    } else if (conversionDiff > 5) {
      correlation = "weak";
      description = "Training completion has slight impact on performance. Review module content for relevance.";
    } else {
      correlation = "none";
      description = "No clear correlation between training and performance. Training content may need updating.";
    }

    return {
      correlation,
      description,
      trainedAvgConversion: trainedMetrics.avgConversion,
      untrainedAvgConversion: untrainedMetrics.avgConversion,
    };
  }

  private calculateGroupMetrics(employees: any[]): { avgConversion: number; avgCases: number } {
    if (employees.length === 0) {
      return { avgConversion: 0, avgCases: 0 };
    }

    let totalConversion = 0;
    let totalCases = 0;
    let employeesWithCases = 0;

    for (const emp of employees) {
      const cases = emp.assignedCases;
      if (cases.length >= 3) {
        const paid = cases.filter((c: any) => c.status === "PAID").length;
        totalConversion += (paid / cases.length) * 100;
        totalCases += cases.length;
        employeesWithCases++;
      }
    }

    return {
      avgConversion: employeesWithCases > 0 ? Math.round(totalConversion / employeesWithCases) : 0,
      avgCases: employeesWithCases > 0 ? Math.round(totalCases / employeesWithCases) : 0,
    };
  }

  // ============================================
  // PATTERN DETECTION
  // ============================================

  private detectPatterns(
    employees: any[],
    modules: any[],
    needsCoaching: ContractorTrainingNeeds[]
  ): TrainingPattern[] {
    const patterns: TrainingPattern[] = [];

    // High failure modules
    for (const module of modules) {
      const progress = employees.flatMap((e) =>
        e.trainingProgress.filter((t: any) => t.moduleId === module.id && t.bestScore !== null)
      );

      if (progress.length >= 5) {
        const failureCount = progress.filter(
          (p: any) => p.bestScore < (module.passingScore || 80)
        ).length;
        const failureRate = Math.round((failureCount / progress.length) * 100);

        if (failureRate > 30) {
          patterns.push({
            type: "HIGH_FAILURE_MODULE",
            description: `Module "${module.title}" has ${failureRate}% failure rate`,
            affectedCount: failureCount,
            severity: failureRate > 50 ? "high" : "medium",
            suggestedAction: "Review and simplify module content or adjust passing score",
          });
        }
      }
    }

    // Skill gap clusters
    const skillGapCounts: Record<string, number> = {};
    for (const needs of needsCoaching) {
      for (const gap of needs.skillGaps) {
        skillGapCounts[gap.skill] = (skillGapCounts[gap.skill] || 0) + 1;
      }
    }

    for (const [skill, count] of Object.entries(skillGapCounts)) {
      if (count >= 3) {
        patterns.push({
          type: "SKILL_GAP_CLUSTER",
          description: `${count} employees have gaps in ${skill.replace(/-/g, " ")} skills`,
          affectedCount: count,
          severity: count >= 5 ? "high" : "medium",
          suggestedAction: `Schedule group training session on ${skill.replace(/-/g, " ")}`,
        });
      }
    }

    // Tier bottleneck
    const tierCounts: Record<string, number> = {};
    for (const emp of employees) {
      const tier = emp.employeeTier || "TIER_1_ASSOCIATE";
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }

    const tier1Count = tierCounts["TIER_1_ASSOCIATE"] || 0;
    const totalCount = employees.length;

    if (tier1Count / totalCount > 0.7 && totalCount >= 5) {
      patterns.push({
        type: "TIER_BOTTLENECK",
        description: `${Math.round((tier1Count / totalCount) * 100)}% of employees are still at Tier 1`,
        affectedCount: tier1Count,
        severity: "medium",
        suggestedAction: "Review tier progression requirements and training support",
      });
    }

    return patterns;
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  private generateRecommendations(
    needsCoaching: ContractorTrainingNeeds[],
    eligibleForPromotion: TierProgressionEvaluation[],
    completionRate: number,
    patterns: TrainingPattern[]
  ): string[] {
    const recommendations: string[] = [];

    // Coaching recommendations
    const urgentCoaching = needsCoaching.filter((n) => n.overallPriority === "URGENT" || n.overallPriority === "MANDATORY");
    if (urgentCoaching.length > 0) {
      recommendations.push(
        `URGENT: ${urgentCoaching.length} employees need immediate training attention`
      );
    }

    if (needsCoaching.length > urgentCoaching.length) {
      recommendations.push(
        `${needsCoaching.length - urgentCoaching.length} additional employees would benefit from coaching`
      );
    }

    // Promotion recommendations
    if (eligibleForPromotion.length > 0) {
      recommendations.push(
        `${eligibleForPromotion.length} employees are eligible for tier advancement — review pending`
      );
    }

    // Completion rate
    if (completionRate < 60) {
      recommendations.push(
        `Training completion rate (${completionRate}%) is below target. Consider enforcement measures.`
      );
    }

    // Pattern-based recommendations
    for (const pattern of patterns) {
      if (pattern.severity === "high") {
        recommendations.push(pattern.suggestedAction);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Training program is performing well — continue monitoring");
    }

    return recommendations;
  }

  // ============================================
  // PLAIN ENGLISH GENERATION
  // ============================================

  private generatePlainEnglish(analysis: TrainingBotAnalysis, patterns: TrainingPattern[]): string {
    const parts: string[] = [];

    parts.push(`Training Intelligence Report — ${new Date().toLocaleDateString()}`);
    parts.push(`\nI analyzed ${analysis.totalEmployees} contractors across the training program.`);

    // Completion overview
    parts.push(`\nOverall training completion: ${analysis.overallCompletionRate}%`);
    if (analysis.avgQuizScore > 0) {
      parts.push(`Average quiz score: ${analysis.avgQuizScore}%`);
    }

    // Correlation insight
    parts.push(`\n${analysis.trainingCorrelation.description}`);
    if (analysis.trainingCorrelation.correlation !== "none") {
      parts.push(
        `Trained employees convert at ${analysis.trainingCorrelation.trainedAvgConversion}% vs ${analysis.trainingCorrelation.untrainedAvgConversion}% for untrained.`
      );
    }

    // Coaching needs
    if (analysis.needsCoaching.length > 0) {
      parts.push(`\n${analysis.needsCoaching.length} contractors need training attention:`);
      for (const needs of analysis.needsCoaching.slice(0, 5)) {
        const topModule = needs.recommendedModules[0];
        parts.push(
          `- ${needs.employeeName} (${needs.employeeTier}): ${topModule?.moduleTitle || "General coaching"} — ${needs.overallPriority} priority`
        );
      }
      if (analysis.needsCoaching.length > 5) {
        parts.push(`  ...and ${analysis.needsCoaching.length - 5} more`);
      }
    }

    // Tier progressions
    if (analysis.eligibleForPromotion.length > 0) {
      parts.push(`\n${analysis.eligibleForPromotion.length} contractors ready for tier advancement:`);
      for (const prog of analysis.eligibleForPromotion.slice(0, 5)) {
        parts.push(
          `- ${prog.employeeName}: ${prog.currentTier} → ${prog.targetTier} (${prog.overallProgress}% complete)`
        );
      }
    }

    // Dynamic modules
    if (analysis.newModulesGenerated.length > 0) {
      parts.push(`\n${analysis.newModulesGenerated.length} new training modules auto-generated:`);
      for (const mod of analysis.newModulesGenerated) {
        parts.push(`- ${mod.title}`);
      }
    }

    // Patterns
    if (patterns.length > 0) {
      parts.push(`\nPatterns detected:`);
      for (const pattern of patterns) {
        parts.push(`- ${pattern.description} (${pattern.severity})`);
      }
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      parts.push(`\nRecommendations:`);
      for (const rec of analysis.recommendations) {
        parts.push(`- ${rec}`);
      }
    }

    return parts.join("\n");
  }

  // ============================================
  // SAVE INSIGHT
  // ============================================

  private async saveInsight(analysis: TrainingBotAnalysis, patterns: TrainingPattern[]): Promise<void> {
    const urgentCount = analysis.needsCoaching.filter(
      (n) => n.overallPriority === "URGENT" || n.overallPriority === "MANDATORY"
    ).length;

    const priority =
      urgentCount >= 3 || analysis.overallCompletionRate < 40
        ? "URGENT"
        : urgentCount > 0 || analysis.needsCoaching.length >= 5
        ? "HIGH"
        : analysis.needsCoaching.length > 0
        ? "NORMAL"
        : "LOW";

    await prisma.opsInsight.create({
      data: {
        type: "TRAINING_ANALYSIS" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: "Training Intelligence Analysis",
        summary: `Analyzed ${analysis.totalEmployees} contractors. ${analysis.overallCompletionRate}% completion. ${analysis.needsCoaching.length} need coaching. ${analysis.eligibleForPromotion.length} ready for promotion.`,
        details: {
          needsCoaching: analysis.needsCoaching,
          eligibleForPromotion: analysis.eligibleForPromotion,
          newModulesGenerated: analysis.newModulesGenerated.map((m) => m.title),
          trainingCorrelation: analysis.trainingCorrelation,
          patterns,
        } as any,
        plainEnglish: analysis.plainEnglish,
        recommendations: analysis.recommendations,
        relatedCaseIds: [],
        relatedUserIds: analysis.needsCoaching.map((n) => n.employeeId),
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  // ============================================
  // LOG BOT RUN
  // ============================================

  private async logBotRun(startTime: number, analysis: TrainingBotAnalysis): Promise<void> {
    const durationMs = Date.now() - startTime;

    await prisma.botRunLog.create({
      data: {
        botName: BOT_NAME,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
        success: true,
        recordsProcessed: analysis.totalEmployees,
        insightsGenerated: 1,
        alertsCreated: analysis.newModulesGenerated.length,
        summary: `Analyzed ${analysis.totalEmployees} contractors. Found ${analysis.needsCoaching.length} needing coaching, ${analysis.eligibleForPromotion.length} ready for promotion. Generated ${analysis.newModulesGenerated.length} new modules.`,
        details: {
          overallCompletionRate: analysis.overallCompletionRate,
          avgQuizScore: analysis.avgQuizScore,
          trainingCorrelation: analysis.trainingCorrelation.correlation,
        },
      },
    });
  }

  // ============================================
  // ACTION MODE — Auto-assign training & create plans
  // ============================================

  /**
   * Create a personalized training plan based on identified gaps
   * - Auto-assign training modules
   * - Send study plan via email
   * - Track completion
   * - Generate progress reports
   */
  async createTrainingPlan(employeeId: string, gaps: { skill: string; severity: string }[]): Promise<{
    success: boolean;
    modulesAssigned: number;
    planSent: boolean;
    details: string;
  }> {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, employeeTier: true },
    });

    if (!employee) {
      return { success: false, modulesAssigned: 0, planSent: false, details: "Employee not found" };
    }

    let modulesAssigned = 0;
    const assignedModules: string[] = [];

    // Find matching training modules for each gap
    for (const gap of gaps) {
      const modules = await prisma.trainingModule.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: gap.skill.replace(/-/g, " "), mode: "insensitive" } },
            { description: { contains: gap.skill.replace(/-/g, " "), mode: "insensitive" } },
          ],
        },
        take: 2,
      });

      for (const module of modules) {
        // Check if already assigned
        const existing = await prisma.employeeTrainingProgress.findFirst({
          where: { employeeId: employeeId, moduleId: module.id },
        });

        if (!existing) {
          await prisma.employeeTrainingProgress.create({
            data: {
              employeeId: employeeId,
              moduleId: module.id,
            },
          });
          modulesAssigned++;
          assignedModules.push(module.title);
        }
      }
    }

    // Send personalized study plan via email
    let planSent = false;
    if (employee.email && assignedModules.length > 0) {
      try {
        const studyPlan = this.buildStudyPlanEmail(employee, assignedModules, gaps);
        await notificationService.sendEmployeeEmail({
          to: employee.email,
          subject: `Your Personalized Training Plan — ${assignedModules.length} Modules Assigned`,
          body: studyPlan,
          employeeId,
        });
        planSent = true;
      } catch (error: any) {
        logger.error(`Failed to send training plan email`, { error: error.message, employeeId });
      }
    }

    // Log to BotRunLog
    await prisma.botRunLog.create({
      data: {
        botName: "trainingBot:createPlan",
        success: modulesAssigned > 0,
        summary: `Training plan created for ${employee.name}: ${modulesAssigned} modules assigned`,
        details: { employeeId, gaps, assignedModules, planSent },
        recordsProcessed: gaps.length,
      },
    });

    return {
      success: modulesAssigned > 0 || planSent,
      modulesAssigned,
      planSent,
      details: modulesAssigned > 0
        ? `Assigned ${modulesAssigned} modules: ${assignedModules.join(", ")}`
        : "No matching modules found for identified gaps",
    };
  }

  /**
   * Analyze AND auto-assign training for all employees needing it
   */
  async analyzeAndAssign(): Promise<{
    analysis: TrainingBotAnalysis;
    plansCreated: number;
    totalModulesAssigned: number;
  }> {
    const analysis = await this.analyze();
    let plansCreated = 0;
    let totalModulesAssigned = 0;

    for (const needs of analysis.needsCoaching) {
      if (needs.overallPriority === "URGENT" || needs.overallPriority === "MANDATORY") {
        try {
          const gaps = needs.skillGaps.map(g => ({ skill: g.skill, severity: g.gap >= 3 ? "high" : g.gap >= 2 ? "medium" : "low" }));
          const result = await this.createTrainingPlan(needs.employeeId, gaps);
          if (result.success) {
            plansCreated++;
            totalModulesAssigned += result.modulesAssigned;
          }
        } catch (error: any) {
          logger.error(`Auto-assign training failed for ${needs.employeeName}`, { error: error.message });
        }
      }
    }

    return { analysis, plansCreated, totalModulesAssigned };
  }

  private buildStudyPlanEmail(
    employee: { name: string; employeeTier: string | null },
    modules: string[],
    gaps: { skill: string; severity: string }[]
  ): string {
    return `
Hi ${employee.name},

Based on your performance analysis, we've created a personalized training plan to help you grow.

YOUR TRAINING PLAN
==================

Current Tier: ${employee.employeeTier || "Tier 1"}

Areas for Improvement:
${gaps.map(g => `  - ${g.skill.replace(/-/g, " ")} (${g.severity} priority)`).join("\n")}

Assigned Modules:
${modules.map((m, i) => `  ${i + 1}. ${m}`).join("\n")}

NEXT STEPS:
1. Log into the training portal
2. Complete each module in order
3. Pass the quiz at the end of each module
4. Your progress is tracked automatically

Completing these modules will improve your performance metrics and may qualify you for tier advancement.

Best regards,
MGR Capital Training Bot
    `.trim();
  }

  // ============================================
  // QUICK METHODS FOR SINGLE EMPLOYEE
  // ============================================

  /**
   * Quick check for single employee training status
   */
  async checkEmployee(employeeId: string): Promise<{
    status: "on_track" | "needs_attention" | "urgent";
    message: string;
    recommendations: string[];
  }> {
    const needs = await trainingIntelligenceService.analyzeContractorNeeds(employeeId);

    if (!needs) {
      return {
        status: "on_track",
        message: "Employee not found or no training data",
        recommendations: [],
      };
    }

    if (needs.overallPriority === "URGENT" || needs.overallPriority === "MANDATORY") {
      return {
        status: "urgent",
        message: `${needs.employeeName} has urgent training needs`,
        recommendations: needs.recommendedModules.map((m) => m.moduleTitle),
      };
    }

    if (needs.recommendedModules.length > 0) {
      return {
        status: "needs_attention",
        message: `${needs.employeeName} has ${needs.recommendedModules.length} recommended modules`,
        recommendations: needs.recommendedModules.map((m) => m.moduleTitle),
      };
    }

    return {
      status: "on_track",
      message: `${needs.employeeName} is on track with training`,
      recommendations: [],
    };
  }

  /**
   * Check tier progression eligibility for single employee
   */
  async checkTierEligibility(employeeId: string): Promise<TierProgressionEvaluation | null> {
    return trainingIntelligenceService.evaluateTierProgression(employeeId);
  }

  /**
   * Get training dashboard data for HR Panel
   */
  async getDashboard() {
    return trainingIntelligenceService.getTrainingDashboardData();
  }
}

export const trainingBot = new TrainingBot();
