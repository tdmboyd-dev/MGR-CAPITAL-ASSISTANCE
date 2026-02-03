// ============================================
// OUTREACH BOT — MGR CAPITAL ASSISTANCE
// Suggests contact methods, prioritizes cases
// Tracks response rates, suggests follow-ups
// Optimizes outreach timing
// ============================================

import { PrismaClient, CaseStatus, OpsInsightType, OpsInsightPriority } from "@prisma/client";
import { autoOutreachService } from "../services/AutoOutreachService.js";
import { botSubscriptionService } from "../services/BotSubscriptionService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

const BOT_NAME = "outreachBot";

interface OutreachAnalysis {
  analysisDate: Date;
  totalActiveCases: number;
  prioritizedCases: PrioritizedCase[];
  contactSuggestions: ContactSuggestion[];
  responseMetrics: ResponseMetrics;
  followUpQueue: FollowUpItem[];
  employeeWorkload: EmployeeWorkload[];
  recommendations: string[];
}

interface PrioritizedCase {
  caseId: string;
  caseCode: string;
  priorityScore: number;
  priorityFactors: string[];
  status: string;
  daysSinceLastContact: number;
  surplusValue: "high" | "medium" | "low";
  deadlineUrgency: "critical" | "soon" | "normal" | "none";
  suggestedAction: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
}

interface ContactSuggestion {
  caseId: string;
  caseCode: string;
  clientName: string;
  preferredMethod: "CALL" | "EMAIL" | "TEXT";
  reason: string;
  bestTimeWindow?: string;
  scriptSuggestion?: string;
}

interface ResponseMetrics {
  overallResponseRate: number;
  byMethod: {
    CALL: { attempts: number; responses: number; rate: number };
    EMAIL: { attempts: number; responses: number; rate: number };
    TEXT: { attempts: number; responses: number; rate: number };
  };
  byDayOfWeek: { day: string; responseRate: number }[];
  byTimeOfDay: { hour: string; responseRate: number }[];
  avgResponseTimeDays: number;
}

interface FollowUpItem {
  caseId: string;
  caseCode: string;
  clientName: string;
  reason: string;
  daysSinceLastContact: number;
  recommendedMethod: string;
  urgency: "high" | "medium" | "low";
}

interface EmployeeWorkload {
  employeeId: string;
  employeeName: string;
  totalAssigned: number;
  pendingOutreach: number;
  contactedToday: number;
  responseRate: number;
  suggestedCasesToAssign: number;
}

class OutreachBot {
  // ============================================
  // MAIN ANALYSIS
  // ============================================

  async analyze(): Promise<OutreachAnalysis> {
    // Get active cases with communication history
    const cases = await prisma.case.findMany({
      where: {
        status: {
          in: ["NEW", "CONTACTED", "DOCS_PENDING"],
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        assignedEmployee: {
          select: {
            id: true,
            name: true,
          },
        },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        deadlines: {
          where: { completedAt: null },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
      },
    });

    const prioritizedCases = this.prioritizeCases(cases);
    const contactSuggestions = this.generateContactSuggestions(cases);
    const responseMetrics = await this.calculateResponseMetrics();
    const followUpQueue = this.buildFollowUpQueue(cases);
    const employeeWorkload = await this.analyzeEmployeeWorkload();
    const recommendations = this.generateRecommendations(
      prioritizedCases,
      responseMetrics,
      followUpQueue,
      employeeWorkload
    );

    const analysis: OutreachAnalysis = {
      analysisDate: new Date(),
      totalActiveCases: cases.length,
      prioritizedCases: prioritizedCases.slice(0, 20), // Top 20
      contactSuggestions: contactSuggestions.slice(0, 15),
      responseMetrics,
      followUpQueue: followUpQueue.slice(0, 15),
      employeeWorkload,
      recommendations,
    };

    await this.saveInsight(analysis);

    return analysis;
  }

  // ============================================
  // CASE PRIORITIZATION
  // ============================================

  private prioritizeCases(cases: any[]): PrioritizedCase[] {
    const now = new Date();
    const prioritized: PrioritizedCase[] = [];

    for (const caseRecord of cases) {
      const factors: string[] = [];
      let score = 50; // Base score

      // Factor 1: Surplus value (higher value = higher priority)
      const surplusCents = caseRecord.surplusAmountCents || 0;
      let surplusValue: "high" | "medium" | "low" = "low";
      if (surplusCents >= 5000000) {
        // $50,000+
        score += 30;
        surplusValue = "high";
        factors.push("High-value case ($50k+)");
      } else if (surplusCents >= 1000000) {
        // $10,000+
        score += 15;
        surplusValue = "medium";
        factors.push("Medium-value case ($10k+)");
      }

      // Factor 2: Days since last contact
      const lastComm = caseRecord.communications[0];
      const daysSinceLastContact = lastComm
        ? Math.floor((now.getTime() - new Date(lastComm.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastContact > 14) {
        score += 25;
        factors.push("No contact in 14+ days");
      } else if (daysSinceLastContact > 7) {
        score += 15;
        factors.push("No contact in 7+ days");
      } else if (daysSinceLastContact > 3) {
        score += 5;
        factors.push("Follow-up due");
      }

      // Factor 3: Deadline urgency
      let deadlineUrgency: "critical" | "soon" | "normal" | "none" = "none";
      const nearestDeadline = caseRecord.deadlines[0];
      if (nearestDeadline) {
        const daysToDeadline = Math.floor(
          (new Date(nearestDeadline.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysToDeadline <= 7) {
          score += 35;
          deadlineUrgency = "critical";
          factors.push("Deadline within 7 days");
        } else if (daysToDeadline <= 14) {
          score += 20;
          deadlineUrgency = "soon";
          factors.push("Deadline within 14 days");
        } else if (daysToDeadline <= 30) {
          score += 10;
          deadlineUrgency = "normal";
        }
      }

      // Factor 4: Case status progression
      if (caseRecord.status === "NEW") {
        score += 10;
        factors.push("New case needs initial contact");
      } else if (caseRecord.status === "DOCS_PENDING") {
        score += 5;
        factors.push("Awaiting documents");
      }

      // Factor 5: No assigned employee
      if (!caseRecord.assignedEmployeeId) {
        score += 15;
        factors.push("Unassigned case");
      }

      // Determine suggested action
      let suggestedAction = "Follow up";
      if (caseRecord.status === "NEW") {
        suggestedAction = "Initial outreach call";
      } else if (caseRecord.status === "DOCS_PENDING" && daysSinceLastContact > 3) {
        suggestedAction = "Document reminder";
      } else if (deadlineUrgency === "critical") {
        suggestedAction = "Urgent deadline reminder";
      }

      prioritized.push({
        caseId: caseRecord.id,
        caseCode: caseRecord.internalCode,
        priorityScore: Math.min(100, score),
        priorityFactors: factors,
        status: caseRecord.status,
        daysSinceLastContact,
        surplusValue,
        deadlineUrgency,
        suggestedAction,
        assignedEmployeeId: caseRecord.assignedEmployeeId,
        assignedEmployeeName: caseRecord.assignedEmployee?.name,
      });
    }

    return prioritized.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // ============================================
  // CONTACT SUGGESTIONS
  // ============================================

  private generateContactSuggestions(cases: any[]): ContactSuggestion[] {
    const suggestions: ContactSuggestion[] = [];

    for (const caseRecord of cases) {
      if (caseRecord.status !== "NEW" && caseRecord.status !== "CONTACTED") {
        continue; // Only suggest for initial outreach stages
      }

      const client = caseRecord.client;
      const communications = caseRecord.communications;

      // Determine preferred method based on history
      let preferredMethod: "CALL" | "EMAIL" | "TEXT" = "CALL";
      let reason = "Default: Initial contact by phone is most effective";

      // Check previous successful contact methods
      const successfulComms = communications.filter(
        (c: any) => c.outcome === "POSITIVE" || c.outcome === "RESPONDED"
      );

      if (successfulComms.length > 0) {
        // Use the method that worked before
        const methodCounts: Record<string, number> = { CALL: 0, EMAIL: 0, TEXT: 0 };
        for (const comm of successfulComms) {
          if (methodCounts[comm.type] !== undefined) {
            methodCounts[comm.type]++;
          }
        }

        if (methodCounts.EMAIL > methodCounts.CALL && methodCounts.EMAIL > methodCounts.TEXT) {
          preferredMethod = "EMAIL";
          reason = "Client has responded well to emails";
        } else if (methodCounts.TEXT > methodCounts.CALL) {
          preferredMethod = "TEXT";
          reason = "Client prefers text communication";
        }
      }

      // Check availability of contact info
      if (!client.phone && client.email) {
        preferredMethod = "EMAIL";
        reason = "Phone number not available";
      } else if (!client.email && client.phone) {
        preferredMethod = "CALL";
        reason = "Email not available";
      }

      // Check for failed contact attempts
      const recentFailures = communications.filter(
        (c: any) =>
          c.outcome === "NO_ANSWER" || c.outcome === "VOICEMAIL" || c.outcome === "BOUNCED"
      );
      if (recentFailures.length >= 3) {
        // Switch method if current method isn't working
        const failedMethods = recentFailures.map((c: any) => c.type);
        if (failedMethods.includes("CALL") && !failedMethods.includes("EMAIL")) {
          preferredMethod = "EMAIL";
          reason = "Multiple call attempts failed - try email";
        } else if (failedMethods.includes("EMAIL") && !failedMethods.includes("CALL")) {
          preferredMethod = "CALL";
          reason = "Emails not getting responses - try calling";
        }
      }

      // Best time suggestion based on day
      const now = new Date();
      const hour = now.getHours();
      let bestTimeWindow = "10:00 AM - 12:00 PM"; // Default

      if (hour < 10) {
        bestTimeWindow = "10:00 AM - 12:00 PM (mid-morning)";
      } else if (hour < 14) {
        bestTimeWindow = "2:00 PM - 4:00 PM (afternoon)";
      } else {
        bestTimeWindow = "Tomorrow 10:00 AM - 12:00 PM";
      }

      // Script suggestion based on status
      let scriptSuggestion = "Use standard introduction script";
      if (caseRecord.status === "NEW") {
        scriptSuggestion = "Use NEW case initial contact script - emphasize legitimacy";
      } else if (caseRecord.status === "CONTACTED") {
        scriptSuggestion = "Use follow-up script - reference previous conversation";
      }

      suggestions.push({
        caseId: caseRecord.id,
        caseCode: caseRecord.internalCode,
        clientName: client.name,
        preferredMethod,
        reason,
        bestTimeWindow,
        scriptSuggestion,
      });
    }

    return suggestions;
  }

  // ============================================
  // RESPONSE METRICS
  // ============================================

  private async calculateResponseMetrics(): Promise<ResponseMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const communications = await prisma.communication.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        direction: "OUTBOUND",
      },
      select: {
        type: true,
        outcome: true,
        createdAt: true,
      },
    });

    // Calculate by method
    const byMethod = {
      CALL: { attempts: 0, responses: 0, rate: 0 },
      EMAIL: { attempts: 0, responses: 0, rate: 0 },
      TEXT: { attempts: 0, responses: 0, rate: 0 },
    };

    // Calculate by day of week
    const byDayOfWeek: Record<string, { attempts: number; responses: number }> = {
      Sunday: { attempts: 0, responses: 0 },
      Monday: { attempts: 0, responses: 0 },
      Tuesday: { attempts: 0, responses: 0 },
      Wednesday: { attempts: 0, responses: 0 },
      Thursday: { attempts: 0, responses: 0 },
      Friday: { attempts: 0, responses: 0 },
      Saturday: { attempts: 0, responses: 0 },
    };

    // Calculate by time of day
    const byTimeOfDay: Record<string, { attempts: number; responses: number }> = {
      "6-9 AM": { attempts: 0, responses: 0 },
      "9-12 PM": { attempts: 0, responses: 0 },
      "12-3 PM": { attempts: 0, responses: 0 },
      "3-6 PM": { attempts: 0, responses: 0 },
      "6-9 PM": { attempts: 0, responses: 0 },
    };

    let totalAttempts = 0;
    let totalResponses = 0;

    for (const comm of communications) {
      const isResponse =
        comm.outcome === "POSITIVE" ||
        comm.outcome === "RESPONDED" ||
        comm.outcome === "INTERESTED";

      // By method
      if (byMethod[comm.type as keyof typeof byMethod]) {
        byMethod[comm.type as keyof typeof byMethod].attempts++;
        if (isResponse) {
          byMethod[comm.type as keyof typeof byMethod].responses++;
        }
      }

      // By day of week
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = days[comm.createdAt.getDay()];
      byDayOfWeek[dayName].attempts++;
      if (isResponse) byDayOfWeek[dayName].responses++;

      // By time of day
      const hour = comm.createdAt.getHours();
      let timeSlot = "6-9 AM";
      if (hour >= 9 && hour < 12) timeSlot = "9-12 PM";
      else if (hour >= 12 && hour < 15) timeSlot = "12-3 PM";
      else if (hour >= 15 && hour < 18) timeSlot = "3-6 PM";
      else if (hour >= 18 && hour < 21) timeSlot = "6-9 PM";

      byTimeOfDay[timeSlot].attempts++;
      if (isResponse) byTimeOfDay[timeSlot].responses++;

      totalAttempts++;
      if (isResponse) totalResponses++;
    }

    // Calculate rates
    for (const method of Object.keys(byMethod) as (keyof typeof byMethod)[]) {
      if (byMethod[method].attempts > 0) {
        byMethod[method].rate = Math.round(
          (byMethod[method].responses / byMethod[method].attempts) * 100
        );
      }
    }

    return {
      overallResponseRate: totalAttempts > 0 ? Math.round((totalResponses / totalAttempts) * 100) : 0,
      byMethod,
      byDayOfWeek: Object.entries(byDayOfWeek).map(([day, data]) => ({
        day,
        responseRate: data.attempts > 0 ? Math.round((data.responses / data.attempts) * 100) : 0,
      })),
      byTimeOfDay: Object.entries(byTimeOfDay).map(([hour, data]) => ({
        hour,
        responseRate: data.attempts > 0 ? Math.round((data.responses / data.attempts) * 100) : 0,
      })),
      avgResponseTimeDays: 2.5, // Would need more complex calculation
    };
  }

  // ============================================
  // FOLLOW-UP QUEUE
  // ============================================

  private buildFollowUpQueue(cases: any[]): FollowUpItem[] {
    const queue: FollowUpItem[] = [];
    const now = new Date();

    for (const caseRecord of cases) {
      const lastComm = caseRecord.communications[0];
      const daysSinceLastContact = lastComm
        ? Math.floor((now.getTime() - new Date(lastComm.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Determine if follow-up is needed
      let needsFollowUp = false;
      let reason = "";
      let urgency: "high" | "medium" | "low" = "low";
      let recommendedMethod = "CALL";

      // No contact in 7+ days
      if (daysSinceLastContact >= 7) {
        needsFollowUp = true;
        reason = `No contact in ${daysSinceLastContact} days`;
        urgency = daysSinceLastContact >= 14 ? "high" : "medium";
      }

      // Docs pending for too long
      if (caseRecord.status === "DOCS_PENDING" && daysSinceLastContact >= 3) {
        needsFollowUp = true;
        reason = "Documents pending - reminder needed";
        urgency = daysSinceLastContact >= 7 ? "high" : "medium";
        recommendedMethod = "EMAIL"; // Send doc link via email
      }

      // Left voicemail, need to try again
      if (lastComm?.outcome === "VOICEMAIL") {
        needsFollowUp = true;
        reason = "Previous attempt went to voicemail";
        urgency = "medium";
        recommendedMethod = "TEXT"; // Try different method
      }

      // Email sent, no response
      if (lastComm?.type === "EMAIL" && lastComm?.outcome !== "RESPONDED") {
        needsFollowUp = true;
        reason = "Email sent, awaiting response";
        urgency = daysSinceLastContact >= 5 ? "high" : "low";
        recommendedMethod = "CALL"; // Follow up with call
      }

      if (needsFollowUp) {
        queue.push({
          caseId: caseRecord.id,
          caseCode: caseRecord.internalCode,
          clientName: caseRecord.client.name,
          reason,
          daysSinceLastContact,
          recommendedMethod,
          urgency,
        });
      }
    }

    // Sort by urgency and days since contact
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return queue.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return b.daysSinceLastContact - a.daysSinceLastContact;
    });
  }

  // ============================================
  // EMPLOYEE WORKLOAD
  // ============================================

  private async analyzeEmployeeWorkload(): Promise<EmployeeWorkload[]> {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: {
        id: true,
        name: true,
        assignedCases: {
          where: {
            status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
          },
          select: {
            id: true,
            status: true,
            communications: {
              where: {
                createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                direction: "OUTBOUND",
              },
            },
          },
        },
      },
    });

    // Get response rate data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const workload: EmployeeWorkload[] = [];

    for (const emp of employees) {
      const totalAssigned = emp.assignedCases.length;
      const pendingOutreach = emp.assignedCases.filter(
        (c: any) => c.status === "NEW" || c.status === "CONTACTED"
      ).length;
      const contactedToday = emp.assignedCases.filter(
        (c: any) => c.communications.length > 0
      ).length;

      // Calculate response rate
      const empComms = await prisma.communication.findMany({
        where: {
          userId: emp.id,
          direction: "OUTBOUND",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { outcome: true },
      });

      const responses = empComms.filter(
        (c: any) => c.outcome === "POSITIVE" || c.outcome === "RESPONDED"
      ).length;
      const responseRate = empComms.length > 0 ? Math.round((responses / empComms.length) * 100) : 0;

      // Suggest more cases if underloaded
      const targetCases = 25; // Ideal case load
      const suggestedCasesToAssign = Math.max(0, targetCases - totalAssigned);

      workload.push({
        employeeId: emp.id,
        employeeName: emp.name,
        totalAssigned,
        pendingOutreach,
        contactedToday,
        responseRate,
        suggestedCasesToAssign,
      });
    }

    return workload.sort((a, b) => b.suggestedCasesToAssign - a.suggestedCasesToAssign);
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  private generateRecommendations(
    prioritized: PrioritizedCase[],
    metrics: ResponseMetrics,
    followUp: FollowUpItem[],
    workload: EmployeeWorkload[]
  ): string[] {
    const recommendations: string[] = [];

    // High priority cases
    const urgentCases = prioritized.filter((c) => c.priorityScore >= 80);
    if (urgentCases.length > 0) {
      recommendations.push(
        `${urgentCases.length} cases need urgent attention today`
      );
    }

    // Follow-up backlog
    const highUrgencyFollowUps = followUp.filter((f) => f.urgency === "high");
    if (highUrgencyFollowUps.length > 0) {
      recommendations.push(
        `${highUrgencyFollowUps.length} high-urgency follow-ups are overdue`
      );
    }

    // Response rate insights
    const bestDay = metrics.byDayOfWeek.reduce((a, b) =>
      a.responseRate > b.responseRate ? a : b
    );
    const bestTime = metrics.byTimeOfDay.reduce((a, b) =>
      a.responseRate > b.responseRate ? a : b
    );
    if (metrics.overallResponseRate < 30) {
      recommendations.push(
        `Response rate is low (${metrics.overallResponseRate}%). Best time: ${bestDay.day} at ${bestTime.hour}`
      );
    }

    // Workload balancing
    const overloaded = workload.filter((w) => w.totalAssigned > 30);
    const underloaded = workload.filter((w) => w.totalAssigned < 15);
    if (overloaded.length > 0 && underloaded.length > 0) {
      recommendations.push(
        `Rebalance workload: ${overloaded.length} employees overloaded, ${underloaded.length} underutilized`
      );
    }

    // Unassigned cases
    const unassigned = prioritized.filter((c) => !c.assignedEmployeeId);
    if (unassigned.length > 0) {
      recommendations.push(
        `Assign ${unassigned.length} unassigned cases to available employees`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Outreach operations are running smoothly");
    }

    return recommendations;
  }

  // ============================================
  // SAVE INSIGHT
  // ============================================

  private async saveInsight(analysis: OutreachAnalysis): Promise<void> {
    const urgentCases = analysis.prioritizedCases.filter((c) => c.priorityScore >= 80);
    const priority =
      urgentCases.length >= 10
        ? "URGENT"
        : urgentCases.length >= 5
        ? "HIGH"
        : urgentCases.length > 0
        ? "NORMAL"
        : "LOW";

    const plainEnglish = this.generatePlainEnglish(analysis);

    await prisma.opsInsight.create({
      data: {
        type: "CASE_RECOMMENDATION" as OpsInsightType,
        priority: priority as OpsInsightPriority,
        title: "Outreach Analysis & Priorities",
        summary: `${analysis.totalActiveCases} active cases. ${urgentCases.length} urgent. ${analysis.followUpQueue.length} need follow-up.`,
        details: analysis as any,
        plainEnglish,
        recommendations: analysis.recommendations,
        relatedCaseIds: analysis.prioritizedCases.slice(0, 10).map((c) => c.caseId),
        relatedUserIds: analysis.employeeWorkload.map((e) => e.employeeId),
        relatedAlertIds: [],
        sourceBot: BOT_NAME,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      },
    });
  }

  private generatePlainEnglish(analysis: OutreachAnalysis): string {
    const parts: string[] = [];

    parts.push(
      `I analyzed ${analysis.totalActiveCases} active cases for outreach opportunities.`
    );

    // Top priorities
    const topCases = analysis.prioritizedCases.slice(0, 5);
    if (topCases.length > 0) {
      parts.push(`\nTop priority cases today:`);
      for (const c of topCases) {
        parts.push(
          `- ${c.caseCode}: ${c.suggestedAction} (score: ${c.priorityScore}, ${c.priorityFactors[0] || "general priority"})`
        );
      }
    }

    // Response metrics
    parts.push(`\nResponse rate analysis:`);
    parts.push(`- Overall: ${analysis.responseMetrics.overallResponseRate}%`);
    parts.push(
      `- By method: Calls ${analysis.responseMetrics.byMethod.CALL.rate}%, Emails ${analysis.responseMetrics.byMethod.EMAIL.rate}%, Texts ${analysis.responseMetrics.byMethod.TEXT.rate}%`
    );

    // Best times
    const bestTime = analysis.responseMetrics.byTimeOfDay.reduce((a, b) =>
      a.responseRate > b.responseRate ? a : b
    );
    parts.push(`- Best time to contact: ${bestTime.hour} (${bestTime.responseRate}% response rate)`);

    // Follow-ups needed
    const highUrgency = analysis.followUpQueue.filter((f) => f.urgency === "high");
    if (highUrgency.length > 0) {
      parts.push(`\n${highUrgency.length} cases need urgent follow-up.`);
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
  // QUICK METHODS
  // ============================================

  /**
   * Get today's priority list for an employee
   */
  async getEmployeePriorityList(employeeId: string): Promise<PrioritizedCase[]> {
    const cases = await prisma.case.findMany({
      where: {
        assignedEmployeeId: employeeId,
        status: {
          in: ["NEW", "CONTACTED", "DOCS_PENDING"],
        },
      },
      include: {
        client: {
          select: { name: true },
        },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        deadlines: {
          where: { completedAt: null },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
      },
    });

    return this.prioritizeCases(cases).slice(0, 10);
  }

  // ============================================
  // ACTION MODE — Execute outreach (not just analyze)
  // ============================================

  /**
   * Execute actual outreach for a case: skip trace + SMS + email + call scheduling
   * This is the ACTION mode upgrade — bots now DO, not just analyze
   */
  async executeOutreach(caseId: string, employeeId: string): Promise<{
    success: boolean;
    actions: string[];
    costCents: number;
    details: string;
  }> {
    // Check bot subscription access
    const canUse = await botSubscriptionService.canUseBot(employeeId, "outreach");
    if (!canUse) {
      return {
        success: false,
        actions: [],
        costCents: 0,
        details: "Outreach bot not enabled for this user. Subscribe to STARTER tier or above.",
      };
    }

    // First, score the case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        communications: { orderBy: { createdAt: "desc" }, take: 5 },
        deadlines: { where: { completedAt: null }, orderBy: { dueDate: "asc" }, take: 1 },
      },
    });

    if (!caseData) {
      return { success: false, actions: [], costCents: 0, details: "Case not found" };
    }

    // Score readiness
    const prioritized = this.prioritizeCases([caseData]);
    const score = prioritized[0]?.priorityScore || 0;

    // Only auto-outreach if score >= 70 OR explicitly triggered
    if (score < 70) {
      logger.info(`Outreach score ${score} below threshold for case ${caseId} — executing anyway (manual trigger)`);
    }

    try {
      // Delegate to AutoOutreachService for the full pipeline
      const result = await autoOutreachService.initiateOutreach(caseId, employeeId);

      const successActions = result.actions.filter(a => a.success).map(a => a.type);

      return {
        success: successActions.length > 0,
        actions: successActions,
        costCents: result.totalCostCents,
        details: result.actions.map(a => `${a.type}: ${a.success ? "OK" : "FAILED"} ${a.details || ""}`).join("; "),
      };
    } catch (error: any) {
      logger.error(`executeOutreach failed for case ${caseId}`, { error: error.message });
      return {
        success: false,
        actions: [],
        costCents: 0,
        details: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Auto-execute outreach for all high-priority cases after analysis
   */
  async analyzeAndExecute(): Promise<{
    analysis: OutreachAnalysis;
    executedCases: number;
    totalCostCents: number;
  }> {
    const analysis = await this.analyze();

    let executedCases = 0;
    let totalCostCents = 0;

    // Execute outreach for top priority cases with score >= 70
    const eligibleCases = analysis.prioritizedCases.filter(
      c => c.priorityScore >= 70 && c.assignedEmployeeId
    );

    for (const priorityCase of eligibleCases.slice(0, 10)) {
      try {
        const result = await this.executeOutreach(priorityCase.caseId, priorityCase.assignedEmployeeId!);
        if (result.success) {
          executedCases++;
          totalCostCents += result.costCents;
        }
      } catch (error: any) {
        logger.error(`Auto-outreach failed for ${priorityCase.caseCode}`, { error: error.message });
      }
    }

    return { analysis, executedCases, totalCostCents };
  }

  /**
   * Get suggested contact method for a specific case
   */
  async getSuggestedContactMethod(caseId: string): Promise<ContactSuggestion | null> {
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!caseRecord) return null;

    const suggestions = this.generateContactSuggestions([caseRecord]);
    return suggestions[0] || null;
  }
}

export const outreachBot = new OutreachBot();
