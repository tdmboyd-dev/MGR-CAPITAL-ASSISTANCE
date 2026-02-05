// ============================================
// PROPERTY RESEARCH SERVICE — MGR CAPITAL ASSISTANCE
// Full property intelligence gathering
// Skip trace + county records + tax data
// ============================================

import { skipTraceService } from "./SkipTraceService.js";
import { botSubscriptionService, ACTION_COSTS } from "./BotSubscriptionService.js";
import logger from "../utils/logger.js";
import prisma from "../lib/prisma.js";

export interface PropertyResearchResult {
  caseId: string;
  ownerInfo: OwnerInfo | null;
  propertyDetails: PropertyDetails | null;
  surplusAssessment: SurplusAssessment;
  researchBrief: string;
  totalCostCents: number;
}

interface OwnerInfo {
  name: string;
  phones: string[];
  emails: string[];
  addresses: string[];
  relatives: string[];
  skipTraceConfidence: number;
}

interface PropertyDetails {
  address: string;
  county: string;
  state: string;
  parcelNumber?: string;
  propertyType?: string;
  lastAssessedValue?: number;
  taxStatus?: string;
  saleDate?: string;
  salePrice?: number;
}

interface SurplusAssessment {
  estimatedSurplus: number;
  confidenceScore: number; // 0-100
  claimDeadline?: string;
  competitorRisk: "low" | "medium" | "high";
  recommendation: string;
}

class PropertyResearchService {
  /**
   * Full property intelligence gathering for a case
   */
  async researchProperty(caseId: string, employeeId?: string): Promise<PropertyResearchResult> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        stateRule: true,
        assignedEmployee: { select: { id: true } },
      },
    });

    if (!caseData) throw new Error(`Case ${caseId} not found`);

    const actingUserId = employeeId || caseData.assignedEmployeeId;
    if (actingUserId) {
      const canUse = await botSubscriptionService.canUseBot(actingUserId, "research");
      if (!canUse) {
        // Fall back to checking skipTrace access
        const canSkipTrace = await botSubscriptionService.canUseBot(actingUserId, "skipTrace");
        if (!canSkipTrace) {
          throw new Error("User does not have research/skipTrace bot access.");
        }
      }
    }

    let totalCostCents = 0;
    let ownerInfo: OwnerInfo | null = null;

    // 1. Skip trace owner
    const ownerName = caseData.previousOwner || caseData.client?.name || "";
    if (ownerName) {
      try {
        const [firstName, ...lastParts] = ownerName.split(" ");
        const lastName = lastParts.join(" ") || firstName;

        const traceResult = await skipTraceService.tracePerson({
          firstName,
          lastName,
          address: caseData.propertyAddress || undefined,
          state: caseData.state || undefined,
        }, false);

        const cost = ACTION_COSTS.skip_trace;
        totalCostCents += cost;

        ownerInfo = {
          name: ownerName,
          phones: (traceResult.phones || []).map((p: any) => p.number || p).slice(0, 5),
          emails: (traceResult.emails || []).map((e: any) => e.address || e).slice(0, 5),
          addresses: (traceResult.addresses || []).map((a: any) => typeof a === "string" ? a : `${a.street}, ${a.city}, ${a.state} ${a.zip}`).slice(0, 3),
          relatives: (traceResult.relatives || []).map((r: any) => r.name || r).slice(0, 5),
          skipTraceConfidence: skipTraceService.scoreResult(traceResult),
        };

        if (actingUserId) {
          await botSubscriptionService.logUsage(actingUserId, "research", "skip_trace", cost, caseId);
        }
      } catch (error: any) {
        logger.error(`Skip trace failed for case ${caseId}`, { error: error.message });
      }
    }

    // 2. Gather property details from case data
    const propertyDetails: PropertyDetails = {
      address: caseData.propertyAddress || "",
      county: caseData.county || "",
      state: caseData.state || "",
      parcelNumber: caseData.parcelNumber || undefined,
      saleDate: caseData.saleDate?.toISOString().split("T")[0],
    };

    // 3. Assess surplus potential
    const surplusAssessment = this.assessSurplus(caseData);

    // 4. Log research cost
    const researchCost = ACTION_COSTS.property_research;
    totalCostCents += researchCost;
    if (actingUserId) {
      await botSubscriptionService.logUsage(actingUserId, "research", "property_research", researchCost, caseId);
    }

    // 5. Generate research brief
    const researchBrief = this.generateBrief(caseData, ownerInfo, propertyDetails, surplusAssessment);

    // 6. Save to case notes / OpsInsight
    await prisma.opsInsight.create({
      data: {
        type: "CASE_RECOMMENDATION",
        priority: surplusAssessment.confidenceScore >= 70 ? "HIGH" : "NORMAL",
        title: `Property Research: ${caseData.internalCode}`,
        summary: `Research complete. Surplus confidence: ${surplusAssessment.confidenceScore}%. Owner: ${ownerInfo ? `${ownerInfo.phones.length} phones, ${ownerInfo.emails.length} emails found` : "Not traced"}.`,
        details: { caseId, ownerInfo, propertyDetails, surplusAssessment } as any,
        plainEnglish: researchBrief,
        recommendations: [surplusAssessment.recommendation],
        relatedCaseIds: [caseId],
        relatedUserIds: actingUserId ? [actingUserId] : [],
        relatedAlertIds: [],
        sourceBot: "propertyResearch",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      caseId,
      ownerInfo,
      propertyDetails,
      surplusAssessment,
      researchBrief,
      totalCostCents,
    };
  }

  // ============================================
  // ASSESSMENT METHODS
  // ============================================

  private assessSurplus(caseData: any): SurplusAssessment {
    const surplusCents = caseData.surplusAmountCents || 0;
    let confidenceScore = 50; // Base confidence

    // Factors that increase confidence
    if (surplusCents > 0) confidenceScore += 20;
    if (caseData.courtCaseNumber) confidenceScore += 10;
    if (caseData.saleDate) confidenceScore += 5;
    if (caseData.stateRule) confidenceScore += 5;
    if (caseData.propertyAddress) confidenceScore += 5;

    // Factors that decrease confidence
    if (!caseData.previousOwner && !caseData.client) confidenceScore -= 15;
    if (surplusCents < 100000) confidenceScore -= 10; // Less than $1000

    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    // Competitor risk assessment
    let competitorRisk: "low" | "medium" | "high" = "low";
    if (surplusCents >= 5000000) competitorRisk = "high"; // $50k+ attracts competition
    else if (surplusCents >= 1000000) competitorRisk = "medium";

    // Filing deadline check
    let claimDeadline: string | undefined;
    if (caseData.filingDeadline) {
      claimDeadline = new Date(caseData.filingDeadline).toISOString().split("T")[0];
    } else if (caseData.stateRule?.claimPeriodDays && caseData.saleDate) {
      const deadline = new Date(caseData.saleDate);
      deadline.setDate(deadline.getDate() + caseData.stateRule.claimPeriodDays);
      claimDeadline = deadline.toISOString().split("T")[0];
    }

    // Recommendation
    let recommendation = "Standard processing recommended.";
    if (confidenceScore >= 80 && surplusCents >= 1000000) {
      recommendation = "HIGH VALUE — Priority filing recommended. Strong surplus case.";
    } else if (confidenceScore >= 60) {
      recommendation = "Moderate confidence — proceed with outreach and document collection.";
    } else if (confidenceScore < 40) {
      recommendation = "Low confidence — verify surplus amount and owner information before proceeding.";
    }

    return {
      estimatedSurplus: surplusCents / 100,
      confidenceScore,
      claimDeadline,
      competitorRisk,
      recommendation,
    };
  }

  private generateBrief(
    caseData: any,
    ownerInfo: OwnerInfo | null,
    propertyDetails: PropertyDetails,
    assessment: SurplusAssessment
  ): string {
    const parts: string[] = [];

    parts.push(`PROPERTY RESEARCH BRIEF — ${caseData.internalCode}`);
    parts.push(`Generated: ${new Date().toLocaleDateString()}`);
    parts.push("");

    // Property
    parts.push(`PROPERTY: ${propertyDetails.address || "Address unknown"}`);
    parts.push(`Location: ${propertyDetails.county}, ${propertyDetails.state}`);
    if (propertyDetails.saleDate) parts.push(`Sale Date: ${propertyDetails.saleDate}`);
    if (propertyDetails.salePrice) parts.push(`Sale Price: $${propertyDetails.salePrice.toLocaleString()}`);
    parts.push("");

    // Owner
    if (ownerInfo) {
      parts.push(`OWNER: ${ownerInfo.name}`);
      parts.push(`Phones: ${ownerInfo.phones.length > 0 ? ownerInfo.phones.join(", ") : "None found"}`);
      parts.push(`Emails: ${ownerInfo.emails.length > 0 ? ownerInfo.emails.join(", ") : "None found"}`);
      parts.push(`Skip Trace Confidence: ${ownerInfo.skipTraceConfidence}%`);
    } else {
      parts.push("OWNER: Not yet traced");
    }
    parts.push("");

    // Surplus Assessment
    parts.push(`SURPLUS ASSESSMENT:`);
    parts.push(`Estimated Surplus: $${assessment.estimatedSurplus.toLocaleString()}`);
    parts.push(`Confidence Score: ${assessment.confidenceScore}%`);
    parts.push(`Competitor Risk: ${assessment.competitorRisk}`);
    if (assessment.claimDeadline) parts.push(`Claim Deadline: ${assessment.claimDeadline}`);
    parts.push("");

    parts.push(`RECOMMENDATION: ${assessment.recommendation}`);

    return parts.join("\n");
  }
}

export const propertyResearchService = new PropertyResearchService();
export default propertyResearchService;
