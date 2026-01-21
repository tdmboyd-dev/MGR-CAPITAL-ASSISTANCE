// ============================================
// TRAINING BOT — MGR CAPITAL ASSISTANCE
// Analyzes training completion vs performance
// Suggests who needs coaching
// Suggests new training modules
// ============================================

import { PrismaClient, OpsInsightType, OpsInsightPriority, EmployeeTier } from "@prisma/client";

const prisma = new PrismaClient();

const BOT_NAME = "trainingBot";

interface TrainingAnalysis {
  analysisDate: Date;
  totalEmployees: number;
  totalModules: number;
  completionRate: number;
  performanceCorrelation: PerformanceCorrelation;
  needsCoaching: CoachingRecommendation[];
  topPerformers: EmployeePerformance[];
  moduleEffectiveness: ModuleEffectiveness[];
  recommendations: string[];
}

interface PerformanceCorrelation {
  correlation: "strong" | "moderate" | "weak" | "none";
  description: string;
  data: {
    trainedAvgConversion: number;
    untrainedAvgConversion: number;
    trainedAvgCases: number;
    untrainedAvgCases: number;
  };
}

interface CoachingRecommendation {
  employeeId: string;
  employeeName: string;
  tier: string;
  reason: string;
  trainingCompletion: number;
  conversionRate: number;
  suggestedModules: string[];
}

interface EmployeePerformance {
  employeeId: string;
  employeeName: string;
  tier: string;
  trainingCompletion: number;
  conversionRate: number;
  casesHandled: number;
}

interface ModuleEffectiveness {
  moduleId: string;
  moduleName: string;
  completedBy: number;
  avgScorePreCompletion: number;
  avgScorePostCompletion: number;
  effectivenessScore: number;
}

class TrainingBot {
  // ============================================
  // MAIN ANALYSIS
  // ============================================

  /**
   * Run full training analysis
   */
  async analyze(): Promise<TrainingAnalysis> {
    // Get all employees with their training and case data
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
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
      include: {
        progress: {
          where: { completedAt: { not: null } },
        },
      },
    });

    // Calculate overall completion rate
    const totalAssignments = employees.reduce(
      (sum, e) => sum + e.trainingProgress.length,
      0
    );
    const completedAssignments = employees.reduce(
      (sum, e) => sum + e.trainingProgress.filter((t) => t.completedAt !== null).length,
      0
    );
    const completionRate =
      totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

    // Analyze performance correlation
    const performanceCorrelation = this.analyzeCorrelation(employees);

    // Identify who needs coaching
    const needsCoaching = this.identifyCoachingNeeds(employees, modules);

    // Identify top performers
    const topPerformers = this.identifyTopPerformers(employees);

    // Analyze module effectiveness
    const moduleEffectiveness = this.analyzeModuleEffectiveness(employees, modules);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      performanceCorrelation,
      needsCoaching,
      completionRate,
      moduleEffectiveness
    );

    const analysis: TrainingAnalysis = {
      analysisDate: new Date(),
      totalEmployees: employees.length,
      totalModules: modules.length,
      completionRate: Math.round(completionRate),
      performanceCorrelation,
      needsCoaching,
      topPerformers,
      moduleEffectiveness,
      recommendations,
    };

    await this.saveInsight(analysis);

    return analysis;
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

    // Calculate metrics for each group
    const trainedMetrics = this.calculateGroupMetrics(trained);
    const untrainedMetrics = this.calculateGroupMetrics(untrained);

    // Determine correlation strength
    const conversionDiff =
      trainedMetrics.avgConversion - untrainedMetrics.avgConversion;

    let correlation: PerformanceCorrelation["correlation"];
    let description: string;

    if (conversionDiff > 20) {
      correlation = "strong";
      description = "Training completion strongly correlates with better performance";
    } else if (conversionDiff > 10) {
      correlation = "moderate";
      description = "Training completion shows moderate impact on performance";
    } else if (conversionDiff > 5) {
      correlation = "weak";
      description = "Training completion has slight impact on performance";
    } else {
      correlation = "none";
      description = "No clear correlation between training and performance";
    }

    return {
      correlation,
      description,
      data: {
        trainedAvgConversion: trainedMetrics.avgConversion,
        untrainedAvgConversion: untrainedMetrics.avgConversion,
        trainedAvgCases: trainedMetrics.avgCases,
        untrainedAvgCases: untrainedMetrics.avgCases,
      },
    };
  }

  private calculateGroupMetrics(employees: any[]): {
    avgConversion: number;
    avgCases: number;
  } {
    if (employees.length === 0) {
      return { avgConversion: 0, avgCases: 0 };
    }

    let totalConversion = 0;
    let totalCases = 0;
    let employeesWithCases = 0;

    for (const emp of employees) {
      const cases = emp.assignedCases;
      if (cases.length >= 3) {
        // Only count employees with meaningful case history
        const paid = cases.filter((c: any) => c.status === "PAID").length;
        totalConversion += (paid / cases.length) * 100;
        totalCases += cases.length;
        employeesWithCases++;
      }
    }

    return {
      avgConversion:
        employeesWithCases > 0
          ? Math.round(totalConversion / employeesWithCases)
          : 0,
      avgCases:
        employeesWithCases > 0 ? Math.round(totalCases / employeesWithCases) : 0,
    };
  }

  // ============================================
  // COACHING IDENTIFICATION
  // ============================================

  private identifyCoachingNeeds(
    employees: any[],
    modules: any[]
  ): CoachingRecommendation[] {
    const coaching: CoachingRecommendation[] = [];

    for (const emp of employees) {
      const trainingCompletion =
        emp.trainingProgress.length > 0
          ? Math.round(
              (emp.trainingProgress.filter((t: any) => t.completedAt !== null)
                .length /
                emp.trainingProgress.length) *
                100
            )
          : 0;

      const cases = emp.assignedCases;
      const paid = cases.filter((c: any) => c.status === "PAID").length;
      const conversionRate =
        cases.length > 0 ? Math.round((paid / cases.length) * 100) : 0;

      // Identify coaching needs
      const reasons: string[] = [];
      const suggestedModules: string[] = [];

      // Low training completion
      if (trainingCompletion < 50 && emp.trainingProgress.length >= 2) {
        reasons.push("Low training completion");

        // Suggest incomplete modules
        for (const progress of emp.trainingProgress) {
          if (!progress.completedAt) {
            suggestedModules.push(progress.module?.title || "Unknown module");
          }
        }
      }

      // Low conversion despite training
      if (trainingCompletion > 70 && conversionRate < 30 && cases.length >= 5) {
        reasons.push("Low conversion despite completing training");
        suggestedModules.push("Advanced Sales Techniques");
        suggestedModules.push("Objection Handling");
      }

      // New employee (< 5 cases) with low training
      if (cases.length < 5 && trainingCompletion < 50) {
        reasons.push("New employee needs onboarding completion");
      }

      if (reasons.length > 0) {
        coaching.push({
          employeeId: emp.id,
          employeeName: emp.name,
          tier: emp.employeeTier || "UNKNOWN",
          reason: reasons.join("; "),
          trainingCompletion,
          conversionRate,
          suggestedModules: [...new Set(suggestedModules)].slice(0, 3),
        });
      }
    }

    return coaching.sort(
      (a, b) => a.trainingCompletion - b.trainingCompletion
    );
  }

  // ============================================
  // TOP PERFORMERS
  // ============================================

  private identifyTopPerformers(employees: any[]): EmployeePerformance[] {
    return employees
      .filter((emp) => emp.assignedCases.length >= 5)
      .map((emp) => {
        const trainingCompletion =
          emp.trainingProgress.length > 0
            ? Math.round(
                (emp.trainingProgress.filter((t: any) => t.completedAt !== null)
                  .length /
                  emp.trainingProgress.length) *
                  100
              )
            : 0;

        const cases = emp.assignedCases;
        const paid = cases.filter((c: any) => c.status === "PAID").length;
        const conversionRate =
          cases.length > 0 ? Math.round((paid / cases.length) * 100) : 0;

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          tier: emp.employeeTier || "UNKNOWN",
          trainingCompletion,
          conversionRate,
          casesHandled: cases.length,
        };
      })
      .filter((emp) => emp.trainingCompletion >= 80 && emp.conversionRate >= 50)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5);
  }

  // ============================================
  // MODULE EFFECTIVENESS
  // ============================================

  private analyzeModuleEffectiveness(
    employees: any[],
    modules: any[]
  ): ModuleEffectiveness[] {
    return modules.map((module) => {
      // Find employees who completed this module
      const completers = employees.filter((emp) =>
        emp.trainingProgress.some(
          (t: any) => t.moduleId === module.id && t.completedAt !== null
        )
      );

      // Calculate average score for completers
      let totalScore = 0;
      let scoredCount = 0;

      for (const completer of completers) {
        const progress = completer.trainingProgress.find(
          (t: any) => t.moduleId === module.id
        );
        if (progress?.bestScore) {
          totalScore += progress.bestScore;
          scoredCount++;
        }
      }

      // Effectiveness score based on completion rate and performance
      const completionRate =
        module.progress.length > 0
          ? module.progress.filter((p: any) => p.completedAt !== null).length /
            module.progress.length
          : 0;

      const effectivenessScore = Math.round(
        completionRate * 50 + (scoredCount > 0 ? (totalScore / scoredCount) * 0.5 : 25)
      );

      return {
        moduleId: module.id,
        moduleName: module.title,
        completedBy: completers.length,
        avgScorePreCompletion: 0, // Would need historical data
        avgScorePostCompletion: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
        effectivenessScore,
      };
    });
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  private generateRecommendations(
    correlation: PerformanceCorrelation,
    coaching: CoachingRecommendation[],
    completionRate: number,
    moduleEffectiveness: ModuleEffectiveness[]
  ): string[] {
    const recommendations: string[] = [];

    // Coaching recommendations
    if (coaching.length > 0) {
      recommendations.push(
        `${coaching.length} employees need coaching or additional training`
      );
    }

    // Low completion rate
    if (completionRate < 60) {
      recommendations.push(
        `Training completion rate (${completionRate}%) is below target. Consider enforcement measures.`
      );
    }

    // Based on correlation
    if (correlation.correlation === "strong" || correlation.correlation === "moderate") {
      recommendations.push(
        `Training shows positive impact on performance. Prioritize training completion for underperformers.`
      );
    } else if (correlation.correlation === "none") {
      recommendations.push(
        `Review training content relevance - no correlation with performance detected`
      );
    }

    // Module effectiveness
    const lowEffectiveness = moduleEffectiveness.filter(
      (m) => m.effectivenessScore < 40
    );
    if (lowEffectiveness.length > 0) {
      recommendations.push(
        `${lowEffectiveness.length} training modules have low effectiveness - consider updating content`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Training program is performing well - continue monitoring");
    }

    return recommendations;
  }

  // ============================================
  // SAVE INSIGHT
  // ============================================

  private async saveInsight(analysis: TrainingAnalysis): Promise<void> {
    const priority =
      analysis.needsCoaching.length >= 5 || analysis.completionRate < 40
        ? "HIGH"
        : analysis.needsCoaching.length > 0
        ? "NORMAL"
        : "LOW";

    const plainEnglish = this.generatePlainEnglish(analysis);

    await prisma.opsInsight.create({
      data: {
        type: "TRAINING_ANALYSIS" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: "Training Program Analysis",
        summary: `${analysis.totalEmployees} employees analyzed. ${analysis.completionRate}% overall completion. ${analysis.needsCoaching.length} need coaching.`,
        details: analysis as any,
        plainEnglish,
        recommendations: analysis.recommendations,
        relatedCaseIds: [],
        relatedUserIds: analysis.needsCoaching.map((c) => c.employeeId),
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  private generatePlainEnglish(analysis: TrainingAnalysis): string {
    const parts: string[] = [];

    parts.push(
      `I analyzed the training program for ${analysis.totalEmployees} employees across ${analysis.totalModules} modules.`
    );

    parts.push(
      `Overall training completion is ${analysis.completionRate}%.`
    );

    // Correlation
    parts.push(`\n${analysis.performanceCorrelation.description}`);

    // Coaching needs
    if (analysis.needsCoaching.length > 0) {
      parts.push(`\n${analysis.needsCoaching.length} employees need coaching:`);
      for (const emp of analysis.needsCoaching.slice(0, 5)) {
        parts.push(
          `- ${emp.employeeName}: ${emp.reason} (${emp.trainingCompletion}% training, ${emp.conversionRate}% conversion)`
        );
      }
    }

    // Top performers
    if (analysis.topPerformers.length > 0) {
      parts.push(`\nTop performers (trained + high conversion):`);
      for (const emp of analysis.topPerformers.slice(0, 3)) {
        parts.push(
          `- ${emp.employeeName}: ${emp.conversionRate}% conversion, ${emp.casesHandled} cases`
        );
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
}

export const trainingBot = new TrainingBot();
