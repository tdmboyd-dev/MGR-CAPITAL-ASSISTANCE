// ============================================
// BOT ORCHESTRATOR SERVICE — MGR CAPITAL ASSISTANCE
// Chains bots together with smart pipelines
// Auto-triggers, feature toggles, batch operations
// Pipeline state tracking, ROI analytics
// ============================================

import logger from "../utils/logger.js";
import { botSubscriptionService } from "./BotSubscriptionService.js";
import { autoOutreachService } from "./AutoOutreachService.js";
import { outreachBot } from "../bots/outreachBot.js";
import { complianceBot } from "../bots/complianceBot.js";
import { docketBot } from "../bots/docketBot.js";
import { trainingBot } from "../bots/trainingBot.js";
import prisma from "../lib/prisma.js";

const SOURCE_BOT = "orchestrator";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
}

interface PipelineStep {
  index: number;
  name: string;
  botName: string;
  action: string;
  description: string;
  optional: boolean;
  estimatedDurationMs: number;
}

interface PipelineRunState {
  runId: string;
  pipelineId: string;
  pipelineName: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: Date;
  completedAt?: Date;
  currentStepIndex: number;
  totalSteps: number;
  caseId?: string;
  options: Record<string, any>;
  stepResults: StepResult[];
  error?: string;
}

interface StepResult {
  stepIndex: number;
  stepName: string;
  botName: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: any;
  error?: string;
}

interface BatchOperationResult {
  operationId: string;
  botName: string;
  totalCases: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalCostCents: number;
  durationMs: number;
  results: Array<{ caseId: string; success: boolean; details?: string }>;
}

interface BatchFilters {
  status?: string | string[];
  state?: string;
  county?: string;
  ageDays?: number;
  assignedEmployeeId?: string;
  minSurplusCents?: number;
}

interface BotROI {
  botName: string;
  period: { start: Date; end: Date };
  totalActions: number;
  totalCostCents: number;
  casesInfluenced: number;
  casesConverted: number;
  revenueGeneratedCents: number;
  roi: number;
  avgCostPerAction: number;
  avgRevenuePerConversion: number;
}

interface PerformanceEntry {
  botName: string;
  totalActions: number;
  totalCostCents: number;
  casesInfluenced: number;
  estimatedRevenueCents: number;
  roi: number;
  rank: number;
}

interface TriggerCondition {
  id: string;
  name: string;
  description: string;
  check: () => Promise<TriggerResult[]>;
  action: string;
  botName: string;
}

interface TriggerResult {
  triggerId: string;
  caseId: string;
  caseCode: string;
  reason: string;
  suggestedAction: string;
  botName: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

// ============================================
// PIPELINE DEFINITIONS
// ============================================

const PIPELINE_DEFINITIONS: PipelineDefinition[] = [
  {
    id: "FULL_CASE_PIPELINE",
    name: "Full Case Pipeline",
    description: "End-to-end case processing: NEW through filing and docket tracking",
    steps: [
      { index: 0, name: "Case Research", botName: "outreach", action: "research", description: "Research case details and validate surplus claim", optional: false, estimatedDurationMs: 5000 },
      { index: 1, name: "Skip Trace", botName: "outreach", action: "skipTrace", description: "Locate property owner contact information", optional: false, estimatedDurationMs: 8000 },
      { index: 2, name: "Initial Outreach", botName: "outreach", action: "outreach", description: "Send initial contact via SMS, email, and schedule call", optional: false, estimatedDurationMs: 10000 },
      { index: 3, name: "Compliance Check", botName: "compliance", action: "complianceCheck", description: "Verify all compliance requirements before proceeding", optional: false, estimatedDurationMs: 6000 },
      { index: 4, name: "Document Generation", botName: "compliance", action: "docGeneration", description: "Generate required legal documents (CSA, POA, affidavit)", optional: false, estimatedDurationMs: 12000 },
      { index: 5, name: "Docket Tracking", botName: "docket", action: "docketTracking", description: "Set up court docket monitoring and deadline tracking", optional: false, estimatedDurationMs: 5000 },
      { index: 6, name: "Filing Prep", botName: "docket", action: "filingPrep", description: "Prepare and validate filing package for court submission", optional: true, estimatedDurationMs: 15000 },
    ],
  },
  {
    id: "OUTREACH_BLITZ",
    name: "Outreach Blitz",
    description: "Batch outreach across all eligible NEW and CONTACTED cases",
    steps: [
      { index: 0, name: "Case Scoring", botName: "outreach", action: "scoring", description: "Score and prioritize all eligible cases", optional: false, estimatedDurationMs: 10000 },
      { index: 1, name: "Batch Outreach", botName: "outreach", action: "batchOutreach", description: "Execute outreach for top-priority cases", optional: false, estimatedDurationMs: 60000 },
      { index: 2, name: "Follow-Up Scheduling", botName: "outreach", action: "scheduleFollowUps", description: "Schedule follow-ups for all contacted cases", optional: false, estimatedDurationMs: 5000 },
    ],
  },
  {
    id: "COMPLIANCE_SWEEP",
    name: "Compliance Sweep",
    description: "Run full compliance audit across all active cases",
    steps: [
      { index: 0, name: "Full Compliance Scan", botName: "compliance", action: "fullScan", description: "Scan all active cases for compliance issues", optional: false, estimatedDurationMs: 30000 },
      { index: 1, name: "Issue Triage", botName: "compliance", action: "triage", description: "Prioritize and categorize discovered issues", optional: false, estimatedDurationMs: 5000 },
      { index: 2, name: "Auto-Remediation", botName: "compliance", action: "autoRemediate", description: "Attempt automatic fixes for common issues", optional: true, estimatedDurationMs: 20000 },
    ],
  },
  {
    id: "DEADLINE_GUARDIAN",
    name: "Deadline Guardian",
    description: "Monitor all deadlines, auto-notify stakeholders, auto-file where possible",
    steps: [
      { index: 0, name: "Deadline Scan", botName: "docket", action: "deadlineScan", description: "Scan all active case deadlines", optional: false, estimatedDurationMs: 8000 },
      { index: 1, name: "Urgency Assessment", botName: "docket", action: "urgencyAssess", description: "Assess urgency and risk for each deadline", optional: false, estimatedDurationMs: 5000 },
      { index: 2, name: "Auto-Notify", botName: "docket", action: "autoNotify", description: "Send notifications for approaching deadlines", optional: false, estimatedDurationMs: 10000 },
      { index: 3, name: "Auto-File", botName: "docket", action: "autoFile", description: "Automatically file documents where ready", optional: true, estimatedDurationMs: 15000 },
    ],
  },
  {
    id: "NEW_CASE_ONBOARDING",
    name: "New Case Onboarding",
    description: "Auto-research, skip trace, and initial outreach for new cases",
    steps: [
      { index: 0, name: "Property Research", botName: "outreach", action: "propertyResearch", description: "Research property details and surplus verification", optional: false, estimatedDurationMs: 10000 },
      { index: 1, name: "Owner Skip Trace", botName: "outreach", action: "skipTrace", description: "Locate and verify property owner contact details", optional: false, estimatedDurationMs: 8000 },
      { index: 2, name: "Initial Contact", botName: "outreach", action: "initialContact", description: "Send first outreach via best available channel", optional: false, estimatedDurationMs: 10000 },
      { index: 3, name: "Compliance Pre-Check", botName: "compliance", action: "preCheck", description: "Run preliminary compliance check on new case", optional: true, estimatedDurationMs: 5000 },
    ],
  },
  {
    id: "STALE_CASE_REVIVAL",
    name: "Stale Case Revival",
    description: "Re-contact cases with no activity in 30+ days",
    steps: [
      { index: 0, name: "Stale Case Identification", botName: "outreach", action: "identifyStale", description: "Find all cases with 30+ days of inactivity", optional: false, estimatedDurationMs: 5000 },
      { index: 1, name: "Re-Skip Trace", botName: "outreach", action: "reSkipTrace", description: "Re-run skip trace for updated contact info", optional: true, estimatedDurationMs: 15000 },
      { index: 2, name: "Revival Outreach", botName: "outreach", action: "revivalOutreach", description: "Send re-engagement messages via all channels", optional: false, estimatedDurationMs: 20000 },
      { index: 3, name: "Compliance Recheck", botName: "compliance", action: "recheck", description: "Verify case is still compliant after dormancy", optional: false, estimatedDurationMs: 8000 },
    ],
  },
];

// ============================================
// BOT ORCHESTRATOR SERVICE
// ============================================

class BotOrchestratorService {
  // In-memory pipeline run tracking (backed by OpsInsight for persistence)
  private activePipelines: Map<string, PipelineRunState> = new Map();
  private pipelineCounter = 0;

  // ============================================
  // PIPELINE EXECUTION ENGINE
  // ============================================

  /**
   * Execute a full pipeline with configurable options.
   * Returns the pipeline run state with all step results.
   */
  async executePipeline(
    pipelineId: string,
    options: {
      caseId?: string;
      employeeId?: string;
      skipSteps?: number[];
      dryRun?: boolean;
      maxCases?: number;
    } = {}
  ): Promise<PipelineRunState> {
    const startTime = Date.now();

    try {
      // Check master toggle
      const orchestratorEnabled = await this.isToggleEnabled("orchestrator_enabled");
      if (!orchestratorEnabled) {
        throw new Error("Bot Orchestrator is disabled. Enable via FounderConfig: orchestrator_enabled");
      }

      // Check pipeline-specific toggle
      const pipelineToggle = await this.isToggleEnabled(`pipeline_${pipelineId}`);
      if (!pipelineToggle) {
        throw new Error(`Pipeline ${pipelineId} is disabled. Enable via FounderConfig: pipeline_${pipelineId}`);
      }

      // Find pipeline definition
      const pipeline = PIPELINE_DEFINITIONS.find((p) => p.id === pipelineId);
      if (!pipeline) {
        throw new Error(`Unknown pipeline: ${pipelineId}. Available: ${PIPELINE_DEFINITIONS.map((p) => p.id).join(", ")}`);
      }

      // Generate run ID
      this.pipelineCounter++;
      const runId = `pipe_${pipelineId}_${Date.now()}_${this.pipelineCounter}`;

      // Initialize run state
      const runState: PipelineRunState = {
        runId,
        pipelineId,
        pipelineName: pipeline.name,
        status: "RUNNING",
        startedAt: new Date(),
        currentStepIndex: 0,
        totalSteps: pipeline.steps.length,
        caseId: options.caseId,
        options,
        stepResults: pipeline.steps.map((step) => ({
          stepIndex: step.index,
          stepName: step.name,
          botName: step.botName,
          status: "PENDING" as const,
        })),
      };

      this.activePipelines.set(runId, runState);

      logger.info(`Pipeline started: ${pipeline.name}`, {
        runId,
        pipelineId,
        caseId: options.caseId,
        totalSteps: pipeline.steps.length,
      });

      // Log pipeline start to BotRunLog
      const botRunLog = await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType: `pipeline_${pipelineId}`,
          status: "RUNNING",
          details: JSON.parse(JSON.stringify({ runId, pipelineId, options })),
        },
      });

      // Execute each step sequentially
      for (const step of pipeline.steps) {
        // Check if pipeline was cancelled
        const currentState = this.activePipelines.get(runId);
        if (currentState?.status === "CANCELLED") {
          logger.info(`Pipeline cancelled at step ${step.index}: ${step.name}`, { runId });
          break;
        }

        // Check if step should be skipped
        if (options.skipSteps?.includes(step.index)) {
          runState.stepResults[step.index].status = "SKIPPED";
          logger.info(`Skipping step ${step.index}: ${step.name}`, { runId });
          continue;
        }

        runState.currentStepIndex = step.index;
        runState.stepResults[step.index].status = "RUNNING";
        runState.stepResults[step.index].startedAt = new Date();

        try {
          if (options.dryRun) {
            // Dry run: simulate step execution
            runState.stepResults[step.index].result = {
              dryRun: true,
              message: `Would execute: ${step.description}`,
            };
            runState.stepResults[step.index].status = "COMPLETED";
          } else {
            // Execute the actual step
            const stepResult = await this.executePipelineStep(pipelineId, step.index, options.caseId, options);
            runState.stepResults[step.index].result = stepResult;
            runState.stepResults[step.index].status = "COMPLETED";
          }

          runState.stepResults[step.index].completedAt = new Date();
          runState.stepResults[step.index].durationMs =
            Date.now() - (runState.stepResults[step.index].startedAt?.getTime() || Date.now());

          // Log step completion
          await prisma.botUsageLog.create({
            data: {
              userId: options.employeeId || "system",
              botName: step.botName,
              action: `pipeline_step_${step.action}`,
              costCents: 0,
              caseId: options.caseId,
              details: {
                runId,
                pipelineId,
                stepIndex: step.index,
                stepName: step.name,
                durationMs: runState.stepResults[step.index].durationMs,
              },
            },
          });
        } catch (stepError: any) {
          runState.stepResults[step.index].status = "FAILED";
          runState.stepResults[step.index].error = stepError.message;
          runState.stepResults[step.index].completedAt = new Date();

          logger.error(`Pipeline step failed: ${step.name}`, {
            runId,
            stepIndex: step.index,
            error: stepError.message,
          });

          // If step is not optional, fail the pipeline
          if (!step.optional) {
            runState.status = "FAILED";
            runState.error = `Step ${step.index} (${step.name}) failed: ${stepError.message}`;
            break;
          }
        }
      }

      // Finalize pipeline
      if (runState.status === "RUNNING") {
        runState.status = "COMPLETED";
      }
      runState.completedAt = new Date();

      const totalDurationMs = Date.now() - startTime;
      const completedSteps = runState.stepResults.filter((s) => s.status === "COMPLETED").length;
      const failedSteps = runState.stepResults.filter((s) => s.status === "FAILED").length;

      // Update BotRunLog
      await prisma.botRunLog.update({
        where: { id: botRunLog.id },
        data: {
          completedAt: new Date(),
          durationMs: totalDurationMs,
          status: runState.status,
          success: runState.status === "COMPLETED",
          recordsProcessed: completedSteps,
          errorsEncountered: failedSteps,
          summary: `Pipeline ${pipeline.name}: ${completedSteps}/${runState.totalSteps} steps completed in ${totalDurationMs}ms`,
          details: JSON.parse(JSON.stringify({ runId, stepResults: runState.stepResults })),
        },
      });

      // Save to OpsInsight for persistence
      await prisma.opsInsight.create({
        data: {
          type: "BOT_PERFORMANCE",
          priority: runState.status === "FAILED" ? "HIGH" : "LOW",
          title: `Pipeline ${runState.status.toLowerCase()}: ${pipeline.name}`,
          summary: `${completedSteps}/${runState.totalSteps} steps completed. ${failedSteps} failures. Duration: ${(totalDurationMs / 1000).toFixed(1)}s`,
          details: JSON.parse(JSON.stringify({
            runId,
            pipelineId,
            status: runState.status,
            caseId: options.caseId,
            stepResults: runState.stepResults,
            totalDurationMs,
          })),
          plainEnglish: `The ${pipeline.name} pipeline ${runState.status === "COMPLETED" ? "completed successfully" : "encountered issues"}. ${completedSteps} of ${runState.totalSteps} steps executed. ${failedSteps > 0 ? `${failedSteps} step(s) failed.` : "No errors."}`,
          recommendations: runState.status === "FAILED"
            ? ["Review failed step logs", "Check bot configurations", "Retry pipeline after fixing issues"]
            : [],
          relatedCaseIds: options.caseId ? [options.caseId] : [],
          relatedUserIds: options.employeeId ? [options.employeeId] : [],
          relatedAlertIds: [],
          sourceBot: SOURCE_BOT,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Pipeline completed: ${pipeline.name}`, {
        runId,
        status: runState.status,
        completedSteps,
        failedSteps,
        durationMs: totalDurationMs,
      });

      // Clean up from active tracking after completion
      this.activePipelines.delete(runId);

      return runState;
    } catch (error: any) {
      logger.error(`Pipeline execution failed: ${pipelineId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a single pipeline step.
   * Routes to the appropriate bot method based on pipeline and step config.
   */
  async executePipelineStep(
    pipelineId: string,
    stepIndex: number,
    caseId?: string,
    options: Record<string, any> = {}
  ): Promise<any> {
    const pipeline = PIPELINE_DEFINITIONS.find((p) => p.id === pipelineId);
    if (!pipeline) {
      throw new Error(`Unknown pipeline: ${pipelineId}`);
    }

    const step = pipeline.steps.find((s) => s.index === stepIndex);
    if (!step) {
      throw new Error(`Step ${stepIndex} not found in pipeline ${pipelineId}`);
    }

    logger.info(`Executing pipeline step: ${step.name}`, {
      pipelineId,
      stepIndex,
      botName: step.botName,
      action: step.action,
      caseId,
    });

    switch (step.botName) {
      case "outreach":
        return this.executeOutreachStep(step.action, caseId, options);
      case "compliance":
        return this.executeComplianceStep(step.action, caseId, options);
      case "docket":
        return this.executeDocketStep(step.action, caseId, options);
      case "training":
        return this.executeTrainingStep(step.action, options);
      default:
        throw new Error(`Unknown bot: ${step.botName}`);
    }
  }

  /**
   * Route outreach-related step actions to the outreach bot / auto-outreach service.
   */
  private async executeOutreachStep(action: string, caseId?: string, options: Record<string, any> = {}): Promise<any> {
    switch (action) {
      case "research":
      case "propertyResearch": {
        // Run outreach analysis for the case (research & scoring)
        if (caseId && options.employeeId) {
          return outreachBot.getSuggestedContactMethod(caseId);
        }
        return outreachBot.analyze();
      }
      case "skipTrace":
      case "reSkipTrace": {
        if (caseId && options.employeeId) {
          return autoOutreachService.initiateOutreach(caseId, options.employeeId);
        }
        return { message: "Skip trace requires caseId and employeeId" };
      }
      case "outreach":
      case "initialContact":
      case "revivalOutreach": {
        if (caseId && options.employeeId) {
          return outreachBot.executeOutreach(caseId, options.employeeId);
        }
        return { message: "Outreach requires caseId and employeeId" };
      }
      case "scoring": {
        return outreachBot.analyze();
      }
      case "batchOutreach": {
        return autoOutreachService.processPendingOutreach();
      }
      case "scheduleFollowUps": {
        // Process pending follow-ups
        return autoOutreachService.processPendingOutreach();
      }
      case "identifyStale": {
        // Find stale cases (30+ days no activity)
        const staleCutoff = new Date();
        staleCutoff.setDate(staleCutoff.getDate() - 30);

        const staleCases = await prisma.case.findMany({
          where: {
            status: { in: ["NEW", "CONTACTED", "DOCS_PENDING"] },
            updatedAt: { lt: staleCutoff },
          },
          select: {
            id: true,
            internalCode: true,
            status: true,
            updatedAt: true,
            county: true,
            state: true,
            surplusAmountCents: true,
          },
          take: options.maxCases || 50,
          orderBy: { surplusAmountCents: "desc" },
        });

        return {
          staleCaseCount: staleCases.length,
          cases: staleCases,
          oldestInactivity: staleCases.length > 0
            ? Math.floor((Date.now() - new Date(staleCases[staleCases.length - 1].updatedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        };
      }
      default:
        throw new Error(`Unknown outreach action: ${action}`);
    }
  }

  /**
   * Route compliance-related step actions to the compliance bot.
   */
  private async executeComplianceStep(action: string, caseId?: string, options: Record<string, any> = {}): Promise<any> {
    switch (action) {
      case "complianceCheck":
      case "preCheck":
      case "recheck": {
        if (caseId) {
          return complianceBot.aiEnhancedCheck(caseId);
        }
        return complianceBot.scan();
      }
      case "fullScan": {
        return complianceBot.scan();
      }
      case "triage": {
        // Run scan and return prioritized issues
        const scanResult = await complianceBot.scan();
        return {
          totalIssues: (scanResult as any).deadlineRisks?.length || 0,
          criticalIssues: (scanResult as any).deadlineRisks?.filter((r: any) => r.severity === "critical")?.length || 0,
          recommendations: (scanResult as any).recommendations || [],
        };
      }
      case "docGeneration": {
        if (caseId) {
          // Compliance check before doc generation
          return complianceBot.aiEnhancedCheck(caseId);
        }
        return { message: "Document generation requires caseId" };
      }
      case "autoRemediate": {
        if (caseId) {
          // Attempt to auto-remediate known issues
          const check = await complianceBot.aiEnhancedCheck(caseId);
          if ((check as any).issues?.length > 0) {
            return complianceBot.autoRemediate(caseId, (check as any).issues);
          }
          return { message: "No issues found to remediate", caseId };
        }
        return { message: "Auto-remediation requires caseId" };
      }
      default:
        throw new Error(`Unknown compliance action: ${action}`);
    }
  }

  /**
   * Route docket-related step actions to the docket bot.
   */
  private async executeDocketStep(action: string, caseId?: string, _options: Record<string, any> = {}): Promise<any> {
    switch (action) {
      case "docketTracking":
      case "deadlineScan": {
        if (caseId) {
          return docketBot.getCaseDeadlines(caseId);
        }
        return docketBot.analyze();
      }
      case "urgencyAssess": {
        const analysis = await docketBot.analyze();
        return {
          totalDeadlines: (analysis as any).upcomingDeadlines?.length || 0,
          overdue: (analysis as any).upcomingDeadlines?.filter((d: any) => d.severity === "overdue")?.length || 0,
          critical: (analysis as any).upcomingDeadlines?.filter((d: any) => d.severity === "critical")?.length || 0,
          riskAssessment: (analysis as any).riskAssessment,
        };
      }
      case "autoNotify": {
        // Docket analysis triggers internal notifications
        return docketBot.analyze();
      }
      case "filingPrep":
      case "autoFile": {
        if (caseId) {
          return docketBot.getCaseDeadlines(caseId);
        }
        return { message: "Filing prep requires caseId" };
      }
      default:
        throw new Error(`Unknown docket action: ${action}`);
    }
  }

  /**
   * Route training-related step actions to the training bot.
   */
  private async executeTrainingStep(action: string, _options: Record<string, any> = {}): Promise<any> {
    switch (action) {
      case "analyze":
        return trainingBot.analyze();
      default:
        throw new Error(`Unknown training action: ${action}`);
    }
  }

  // ============================================
  // SMART TRIGGERS
  // ============================================

  /**
   * Evaluate all trigger conditions and return actions that should fire.
   * Checks for status changes, approaching deadlines, inactivity, etc.
   */
  async evaluateTriggers(): Promise<{
    triggersChecked: number;
    triggersActivated: number;
    results: TriggerResult[];
  }> {
    try {
      const autoTriggersEnabled = await this.isToggleEnabled("auto_triggers_enabled");
      if (!autoTriggersEnabled) {
        return { triggersChecked: 0, triggersActivated: 0, results: [] };
      }

      const allResults: TriggerResult[] = [];
      const triggers = this.getTriggerDefinitions();

      for (const trigger of triggers) {
        try {
          const results = await trigger.check();
          allResults.push(...results);
        } catch (error: any) {
          logger.error(`Trigger check failed: ${trigger.id}`, { error: error.message });
        }
      }

      // Log trigger evaluation results
      if (allResults.length > 0) {
        await prisma.opsInsight.create({
          data: {
            type: "SYSTEM_HEALTH",
            priority: allResults.some((r) => r.priority === "URGENT") ? "URGENT" : "NORMAL",
            title: `Smart Triggers: ${allResults.length} actions recommended`,
            summary: `Evaluated ${triggers.length} triggers. ${allResults.length} actions recommended across ${new Set(allResults.map((r) => r.caseId)).size} cases.`,
            details: JSON.parse(JSON.stringify({
              triggersChecked: triggers.length,
              triggersActivated: allResults.length,
              results: allResults,
            })),
            plainEnglish: `The orchestrator checked ${triggers.length} automated trigger conditions and found ${allResults.length} cases that need attention. ${allResults.filter((r) => r.priority === "URGENT").length} are urgent.`,
            recommendations: allResults.slice(0, 10).map((r) => `${r.caseCode}: ${r.suggestedAction}`),
            relatedCaseIds: Array.from(new Set(allResults.map((r) => r.caseId))).slice(0, 20),
            relatedUserIds: [],
            relatedAlertIds: [],
            sourceBot: SOURCE_BOT,
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          },
        });

        await prisma.botRunLog.create({
          data: {
            botName: SOURCE_BOT,
            runType: "trigger_evaluation",
            success: true,
            status: "SUCCESS",
            recordsProcessed: triggers.length,
            insightsGenerated: allResults.length,
            summary: `${allResults.length} triggers activated from ${triggers.length} checks`,
            details: JSON.parse(JSON.stringify({ results: allResults })),
            completedAt: new Date(),
          },
        });
      }

      return {
        triggersChecked: triggers.length,
        triggersActivated: allResults.length,
        results: allResults,
      };
    } catch (error: any) {
      logger.error("Trigger evaluation failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Define all automated trigger conditions.
   */
  private getTriggerDefinitions(): TriggerCondition[] {
    return [
      {
        id: "deadline_approaching",
        name: "Deadline Approaching",
        description: "Cases with deadlines within 7 days",
        botName: "docket",
        action: "deadline_alert",
        check: async (): Promise<TriggerResult[]> => {
          const sevenDaysFromNow = new Date();
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

          const urgentDeadlines = await prisma.deadline.findMany({
            where: {
              completedAt: null,
              dueDate: { lte: sevenDaysFromNow, gte: new Date() },
            },
            include: {
              case: { select: { id: true, internalCode: true, status: true } },
            },
            take: 50,
          });

          return urgentDeadlines.map((d) => ({
            triggerId: "deadline_approaching",
            caseId: d.case.id,
            caseCode: d.case.internalCode,
            reason: `Deadline "${d.title}" due in ${Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`,
            suggestedAction: "Run docket analysis and notify assigned employee",
            botName: "docket",
            priority: Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3 ? "URGENT" : "HIGH",
          }));
        },
      },
      {
        id: "no_activity_7_days",
        name: "No Activity 7 Days",
        description: "Cases with no updates in 7+ days",
        botName: "outreach",
        action: "follow_up",
        check: async (): Promise<TriggerResult[]> => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const inactiveCases = await prisma.case.findMany({
            where: {
              status: { in: ["CONTACTED", "DOCS_PENDING"] },
              updatedAt: { lt: sevenDaysAgo },
            },
            select: { id: true, internalCode: true, status: true, updatedAt: true },
            take: 50,
          });

          return inactiveCases.map((c) => {
            const daysSince = Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
            return {
              triggerId: "no_activity_7_days",
              caseId: c.id,
              caseCode: c.internalCode,
              reason: `No activity for ${daysSince} days (status: ${c.status})`,
              suggestedAction: "Send follow-up outreach",
              botName: "outreach",
              priority: daysSince >= 14 ? "HIGH" : "NORMAL",
            };
          });
        },
      },
      {
        id: "case_status_changed",
        name: "Case Status Changed",
        description: "Cases whose status changed in the last 24 hours",
        botName: "compliance",
        action: "compliance_check",
        check: async (): Promise<TriggerResult[]> => {
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);

          // Find recently updated cases by checking activity logs via OpsInsight
          const recentUpdates = await prisma.case.findMany({
            where: {
              updatedAt: { gte: oneDayAgo },
              status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
            },
            select: { id: true, internalCode: true, status: true, updatedAt: true },
            take: 30,
          });

          return recentUpdates.map((c) => ({
            triggerId: "case_status_changed",
            caseId: c.id,
            caseCode: c.internalCode,
            reason: `Case updated recently (status: ${c.status})`,
            suggestedAction: "Run compliance check on updated case",
            botName: "compliance",
            priority: "NORMAL" as const,
          }));
        },
      },
      {
        id: "outreach_response_received",
        name: "Outreach Response Received",
        description: "Cases where a client responded in the last 24 hours",
        botName: "outreach",
        action: "process_response",
        check: async (): Promise<TriggerResult[]> => {
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);

          const recentResponses = await prisma.communication.findMany({
            where: {
              direction: "INBOUND",
              createdAt: { gte: oneDayAgo },
            },
            include: {
              case: { select: { id: true, internalCode: true, status: true } },
            },
            take: 30,
          });

          return recentResponses
            .filter((c) => c.case)
            .map((c) => ({
              triggerId: "outreach_response_received",
              caseId: c.case!.id,
              caseCode: c.case!.internalCode,
              reason: `Client responded via ${c.type} — requires follow-up action`,
              suggestedAction: "Review response and advance case to next stage",
              botName: "outreach",
              priority: "HIGH" as const,
            }));
        },
      },
      {
        id: "document_uploaded",
        name: "Document Uploaded",
        description: "Cases where documents were recently uploaded",
        botName: "compliance",
        action: "verify_documents",
        check: async (): Promise<TriggerResult[]> => {
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);

          const recentDocs = await prisma.document.findMany({
            where: {
              createdAt: { gte: oneDayAgo },
            },
            include: {
              case: { select: { id: true, internalCode: true, status: true } },
            },
            take: 30,
          });

          return recentDocs
            .filter((d) => d.case)
            .map((d) => ({
              triggerId: "document_uploaded",
              caseId: d.case!.id,
              caseCode: d.case!.internalCode,
              reason: `New document uploaded: ${d.type || "unknown type"}`,
              suggestedAction: "Run compliance verification on new document",
              botName: "compliance",
              priority: "NORMAL" as const,
            }));
        },
      },
      {
        id: "payment_received",
        name: "Payment Received",
        description: "Cases where a payment was recently logged",
        botName: "compliance",
        action: "payment_reconciliation",
        check: async (): Promise<TriggerResult[]> => {
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);

          const recentPayments = await prisma.case.findMany({
            where: {
              status: "AWAITING_FUNDS",
              updatedAt: { gte: oneDayAgo },
            },
            select: { id: true, internalCode: true, status: true },
            take: 20,
          });

          return recentPayments.map((c) => ({
            triggerId: "payment_received",
            caseId: c.id,
            caseCode: c.internalCode,
            reason: "Case in AWAITING_FUNDS updated recently — possible payment received",
            suggestedAction: "Verify payment and advance case to PAID status",
            botName: "compliance",
            priority: "HIGH" as const,
          }));
        },
      },
    ];
  }

  // ============================================
  // FEATURE TOGGLES
  // ============================================

  /**
   * Get all orchestrator feature toggle states.
   */
  async getToggles(): Promise<Record<string, boolean>> {
    const toggleKeys = [
      "orchestrator_enabled",
      "auto_triggers_enabled",
      ...PIPELINE_DEFINITIONS.map((p) => `pipeline_${p.id}`),
    ];

    const toggles: Record<string, boolean> = {};

    for (const key of toggleKeys) {
      toggles[key] = await this.isToggleEnabled(key);
    }

    return toggles;
  }

  /**
   * Set a feature toggle value.
   */
  async setToggle(key: string, value: boolean): Promise<{ key: string; value: boolean; updated: boolean }> {
    try {
      const validKeys = [
        "orchestrator_enabled",
        "auto_triggers_enabled",
        ...PIPELINE_DEFINITIONS.map((p) => `pipeline_${p.id}`),
      ];

      if (!validKeys.includes(key)) {
        throw new Error(`Invalid toggle key: ${key}. Valid keys: ${validKeys.join(", ")}`);
      }

      await prisma.founderConfig.upsert({
        where: { key },
        update: { value: value as any },
        create: {
          key,
          value: value as any,
          description: `Bot Orchestrator toggle: ${key}`,
        },
      });

      logger.info(`Toggle updated: ${key} = ${value}`, { key, value });

      return { key, value, updated: true };
    } catch (error: any) {
      logger.error(`Failed to set toggle: ${key}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Check if a specific toggle is enabled (defaults to false).
   */
  private async isToggleEnabled(key: string): Promise<boolean> {
    try {
      const config = await prisma.founderConfig.findUnique({
        where: { key },
      });

      if (!config) return false;

      // Handle various stored shapes
      const val = config.value;
      if (typeof val === "boolean") return val;
      if (String(val) === "true") return true;
      return false;
    } catch (error: any) {
      logger.error(`Failed to read toggle: ${key}`, { error: error.message });
      return false;
    }
  }

  // ============================================
  // PIPELINE STATUS TRACKING
  // ============================================

  /**
   * Get the current status of a pipeline run by its run ID.
   * Checks in-memory state first, then falls back to OpsInsight persistence.
   */
  async getPipelineStatus(pipelineRunId: string): Promise<PipelineRunState | null> {
    // Check active in-memory pipelines first
    const active = this.activePipelines.get(pipelineRunId);
    if (active) return active;

    // Fall back to OpsInsight persistence
    try {
      const insight = await prisma.opsInsight.findFirst({
        where: {
          sourceBot: SOURCE_BOT,
          details: { path: ["runId"], equals: pipelineRunId },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!insight || !insight.details) return null;

      const details = insight.details as any;
      return {
        runId: details.runId,
        pipelineId: details.pipelineId,
        pipelineName: PIPELINE_DEFINITIONS.find((p) => p.id === details.pipelineId)?.name || details.pipelineId,
        status: details.status || "COMPLETED",
        startedAt: new Date(insight.createdAt),
        completedAt: insight.resolvedAt ? new Date(insight.resolvedAt) : undefined,
        currentStepIndex: details.stepResults?.length || 0,
        totalSteps: details.stepResults?.length || 0,
        caseId: details.caseId,
        options: {},
        stepResults: details.stepResults || [],
      };
    } catch (error: any) {
      logger.error(`Failed to get pipeline status: ${pipelineRunId}`, { error: error.message });
      return null;
    }
  }

  /**
   * Get all currently running pipelines.
   */
  async getActivePipelines(): Promise<PipelineRunState[]> {
    return Array.from(this.activePipelines.values()).filter(
      (p) => p.status === "RUNNING" || p.status === "QUEUED"
    );
  }

  /**
   * Get recent pipeline execution history.
   */
  async getPipelineHistory(limit: number = 20): Promise<Array<{
    runId: string;
    pipelineId: string;
    pipelineName: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    durationMs?: number;
    stepsCompleted: number;
    totalSteps: number;
    caseId?: string;
  }>> {
    try {
      const insights = await prisma.opsInsight.findMany({
        where: {
          sourceBot: SOURCE_BOT,
          type: "BOT_PERFORMANCE",
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return insights.map((insight) => {
        const details = (insight.details as any) || {};
        const stepResults = details.stepResults || [];
        return {
          runId: details.runId || insight.id,
          pipelineId: details.pipelineId || "unknown",
          pipelineName: PIPELINE_DEFINITIONS.find((p) => p.id === details.pipelineId)?.name || details.pipelineId || "Unknown",
          status: details.status || "COMPLETED",
          startedAt: new Date(insight.createdAt),
          completedAt: insight.resolvedAt ? new Date(insight.resolvedAt) : undefined,
          durationMs: details.totalDurationMs,
          stepsCompleted: stepResults.filter((s: any) => s.status === "COMPLETED").length,
          totalSteps: stepResults.length,
          caseId: details.caseId,
        };
      });
    } catch (error: any) {
      logger.error("Failed to get pipeline history", { error: error.message });
      return [];
    }
  }

  /**
   * Cancel a running pipeline.
   */
  async cancelPipeline(pipelineRunId: string): Promise<{ success: boolean; message: string }> {
    try {
      const pipeline = this.activePipelines.get(pipelineRunId);
      if (!pipeline) {
        return { success: false, message: `Pipeline ${pipelineRunId} not found or already completed` };
      }

      if (pipeline.status !== "RUNNING" && pipeline.status !== "QUEUED") {
        return { success: false, message: `Pipeline ${pipelineRunId} is in ${pipeline.status} state and cannot be cancelled` };
      }

      pipeline.status = "CANCELLED";
      pipeline.completedAt = new Date();

      // Mark remaining pending steps as skipped
      for (const step of pipeline.stepResults) {
        if (step.status === "PENDING") {
          step.status = "SKIPPED";
        }
      }

      logger.info(`Pipeline cancelled: ${pipelineRunId}`, {
        pipelineId: pipeline.pipelineId,
        currentStep: pipeline.currentStepIndex,
      });

      return { success: true, message: `Pipeline ${pipelineRunId} cancelled at step ${pipeline.currentStepIndex}` };
    } catch (error: any) {
      logger.error(`Failed to cancel pipeline: ${pipelineRunId}`, { error: error.message });
      return { success: false, message: error.message };
    }
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  /**
   * Run a bot operation on multiple cases matching the given filters.
   * Respects subscription tiers and rate limits.
   */
  async runBatchOperation(
    botName: string,
    filters: BatchFilters,
    options: { employeeId?: string; maxCases?: number; dryRun?: boolean } = {}
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const operationId = `batch_${botName}_${Date.now()}`;

    try {
      // Build Prisma where clause from filters
      const where: any = {
        status: { notIn: ["PAID", "CLOSED", "REJECTED"] },
      };

      if (filters.status) {
        where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
      }
      if (filters.state) {
        where.state = filters.state;
      }
      if (filters.county) {
        where.county = { contains: filters.county, mode: "insensitive" };
      }
      if (filters.ageDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filters.ageDays);
        where.createdAt = { lte: cutoff };
      }
      if (filters.assignedEmployeeId) {
        where.assignedEmployeeId = filters.assignedEmployeeId;
      }
      if (filters.minSurplusCents) {
        where.surplusAmountCents = { gte: filters.minSurplusCents };
      }

      // Fetch matching cases
      const maxCases = options.maxCases || 50;
      const cases = await prisma.case.findMany({
        where,
        select: {
          id: true,
          internalCode: true,
          status: true,
          assignedEmployeeId: true,
        },
        take: maxCases,
        orderBy: { surplusAmountCents: "desc" },
      });

      const result: BatchOperationResult = {
        operationId,
        botName,
        totalCases: cases.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        totalCostCents: 0,
        durationMs: 0,
        results: [],
      };

      if (cases.length === 0) {
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Process each case
      for (const caseItem of cases) {
        const employeeId = options.employeeId || caseItem.assignedEmployeeId;

        // Check subscription access if we have an employee
        if (employeeId) {
          const canUse = await botSubscriptionService.canUseBot(employeeId, botName);
          if (!canUse) {
            result.skipped++;
            result.results.push({
              caseId: caseItem.id,
              success: false,
              details: `User ${employeeId} lacks ${botName} bot access`,
            });
            continue;
          }
        }

        if (options.dryRun) {
          result.processed++;
          result.succeeded++;
          result.results.push({
            caseId: caseItem.id,
            success: true,
            details: `[DRY RUN] Would run ${botName} on ${caseItem.internalCode}`,
          });
          continue;
        }

        try {
          let stepResult: any;

          switch (botName) {
            case "outreach":
              if (employeeId) {
                stepResult = await outreachBot.executeOutreach(caseItem.id, employeeId);
              } else {
                stepResult = { details: "Skipped — no assigned employee" };
              }
              break;
            case "compliance":
              stepResult = await complianceBot.aiEnhancedCheck(caseItem.id);
              break;
            case "docket":
              stepResult = await docketBot.getCaseDeadlines(caseItem.id);
              break;
            default:
              stepResult = { details: `Unknown bot: ${botName}` };
          }

          result.processed++;
          result.succeeded++;
          result.totalCostCents += stepResult?.costCents || 0;
          result.results.push({
            caseId: caseItem.id,
            success: true,
            details: stepResult?.details || "Completed",
          });
        } catch (error: any) {
          result.processed++;
          result.failed++;
          result.results.push({
            caseId: caseItem.id,
            success: false,
            details: error.message,
          });
          logger.error(`Batch operation failed for case ${caseItem.id}`, {
            operationId,
            botName,
            error: error.message,
          });
        }
      }

      result.durationMs = Date.now() - startTime;

      // Log batch operation to BotRunLog
      await prisma.botRunLog.create({
        data: {
          botName: SOURCE_BOT,
          runType: `batch_${botName}`,
          success: result.failed === 0,
          status: result.failed === 0 ? "SUCCESS" : "PARTIAL",
          recordsProcessed: result.processed,
          errorsEncountered: result.failed,
          completedAt: new Date(),
          durationMs: result.durationMs,
          summary: `Batch ${botName}: ${result.succeeded}/${result.totalCases} succeeded, ${result.failed} failed, ${result.skipped} skipped`,
          details: JSON.parse(JSON.stringify({
            operationId,
            filters,
            totalCostCents: result.totalCostCents,
          })),
        },
      });

      // Save summary to OpsInsight
      await prisma.opsInsight.create({
        data: {
          type: "BOT_PERFORMANCE",
          priority: result.failed > result.succeeded ? "HIGH" : "LOW",
          title: `Batch ${botName}: ${result.succeeded}/${result.totalCases} cases processed`,
          summary: `Processed ${result.processed} cases. ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped. Cost: $${(result.totalCostCents / 100).toFixed(2)}. Duration: ${(result.durationMs / 1000).toFixed(1)}s`,
          details: JSON.parse(JSON.stringify({
            operationId,
            botName,
            filters,
            result: {
              totalCases: result.totalCases,
              succeeded: result.succeeded,
              failed: result.failed,
              skipped: result.skipped,
              totalCostCents: result.totalCostCents,
            },
          })),
          plainEnglish: `Ran ${botName} bot on ${result.totalCases} cases matching your filters. ${result.succeeded} completed successfully. ${result.failed > 0 ? `${result.failed} failed and may need manual review.` : "No failures."}`,
          recommendations: result.failed > 0
            ? [`Review ${result.failed} failed cases`, "Check bot subscription tiers for skipped cases"]
            : [],
          relatedCaseIds: result.results.slice(0, 20).map((r) => r.caseId),
          relatedUserIds: options.employeeId ? [options.employeeId] : [],
          relatedAlertIds: [],
          sourceBot: SOURCE_BOT,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Batch operation completed: ${botName}`, {
        operationId,
        totalCases: result.totalCases,
        succeeded: result.succeeded,
        failed: result.failed,
        durationMs: result.durationMs,
      });

      return result;
    } catch (error: any) {
      logger.error(`Batch operation failed: ${botName}`, { operationId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // BOT ROI TRACKING
  // ============================================

  /**
   * Calculate ROI for a specific bot over a date range.
   * Compares operational cost vs revenue influence.
   */
  async calculateBotROI(
    botName: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<BotROI> {
    try {
      const start = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = dateRange?.end || new Date();

      // Get all usage logs for this bot in the date range
      const usageLogs = await prisma.botUsageLog.findMany({
        where: {
          botName,
          createdAt: { gte: start, lte: end },
        },
        select: {
          costCents: true,
          caseId: true,
          action: true,
        },
      });

      const totalActions = usageLogs.length;
      const totalCostCents = usageLogs.reduce((sum, l) => sum + l.costCents, 0);

      // Unique cases influenced by this bot
      const influencedCaseIds = Array.from(new Set(usageLogs.filter((l) => l.caseId).map((l) => l.caseId!)));
      const casesInfluenced = influencedCaseIds.length;

      // Check how many of those cases converted (moved to PAID or AWAITING_FUNDS)
      let casesConverted = 0;
      let revenueGeneratedCents = 0;

      if (influencedCaseIds.length > 0) {
        const convertedCases = await prisma.case.findMany({
          where: {
            id: { in: influencedCaseIds },
            status: { in: ["PAID", "AWAITING_FUNDS"] },
          },
          select: {
            id: true,
            surplusAmountCents: true,
          },
        });

        casesConverted = convertedCases.length;

        // Estimate revenue as commission on surplus (default 33% commission rate)
        const DEFAULT_COMMISSION_RATE = 0.33;
        revenueGeneratedCents = convertedCases.reduce((sum, c) => {
          const surplus = c.surplusAmountCents || 0;
          return sum + Math.round(surplus * DEFAULT_COMMISSION_RATE);
        }, 0);
      }

      // ROI = (Revenue - Cost) / Cost * 100
      const roi = totalCostCents > 0
        ? Math.round(((revenueGeneratedCents - totalCostCents) / totalCostCents) * 100)
        : revenueGeneratedCents > 0
          ? 999999 // Infinite ROI if no cost but revenue
          : 0;

      const avgCostPerAction = totalActions > 0 ? Math.round(totalCostCents / totalActions) : 0;
      const avgRevenuePerConversion = casesConverted > 0
        ? Math.round(revenueGeneratedCents / casesConverted)
        : 0;

      return {
        botName,
        period: { start, end },
        totalActions,
        totalCostCents,
        casesInfluenced,
        casesConverted,
        revenueGeneratedCents,
        roi,
        avgCostPerAction,
        avgRevenuePerConversion,
      };
    } catch (error: any) {
      logger.error(`Failed to calculate ROI for bot: ${botName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get a performance leaderboard ranking all bots by estimated value.
   */
  async getPerformanceLeaderboard(): Promise<PerformanceEntry[]> {
    try {
      const botNames = ["outreach", "compliance", "docket", "docs", "skipTrace", "phone", "aiLegal"];
      const entries: PerformanceEntry[] = [];

      for (const botName of botNames) {
        try {
          const roi = await this.calculateBotROI(botName);
          entries.push({
            botName,
            totalActions: roi.totalActions,
            totalCostCents: roi.totalCostCents,
            casesInfluenced: roi.casesInfluenced,
            estimatedRevenueCents: roi.revenueGeneratedCents,
            roi: roi.roi,
            rank: 0,
          });
        } catch {
          // Skip bots with no data
          entries.push({
            botName,
            totalActions: 0,
            totalCostCents: 0,
            casesInfluenced: 0,
            estimatedRevenueCents: 0,
            roi: 0,
            rank: 0,
          });
        }
      }

      // Sort by estimated revenue descending, then by ROI
      entries.sort((a, b) => {
        if (b.estimatedRevenueCents !== a.estimatedRevenueCents) {
          return b.estimatedRevenueCents - a.estimatedRevenueCents;
        }
        return b.roi - a.roi;
      });

      // Assign ranks
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      // Log leaderboard to OpsInsight
      await prisma.opsInsight.create({
        data: {
          type: "BOT_PERFORMANCE",
          priority: "LOW",
          title: "Bot Performance Leaderboard",
          summary: `Top bot: ${entries[0]?.botName || "none"} with $${((entries[0]?.estimatedRevenueCents || 0) / 100).toFixed(2)} estimated revenue. ${entries.filter((e) => e.totalActions > 0).length}/${entries.length} bots active.`,
          details: JSON.parse(JSON.stringify({ leaderboard: entries, generatedAt: new Date().toISOString() })),
          plainEnglish: this.generateLeaderboardSummary(entries),
          recommendations: this.generateLeaderboardRecommendations(entries),
          relatedCaseIds: [],
          relatedUserIds: [],
          relatedAlertIds: [],
          sourceBot: SOURCE_BOT,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return entries;
    } catch (error: any) {
      logger.error("Failed to generate performance leaderboard", { error: error.message });
      throw error;
    }
  }

  /**
   * Generate a plain-English summary of the bot leaderboard.
   */
  private generateLeaderboardSummary(entries: PerformanceEntry[]): string {
    const parts: string[] = ["Bot Performance Leaderboard (Last 30 Days):\n"];

    const activeBots = entries.filter((e) => e.totalActions > 0);
    if (activeBots.length === 0) {
      parts.push("No bot activity recorded in the last 30 days.");
      return parts.join("\n");
    }

    for (const entry of activeBots) {
      parts.push(
        `#${entry.rank} ${entry.botName}: ${entry.totalActions} actions, ` +
        `${entry.casesInfluenced} cases influenced, ` +
        `$${(entry.estimatedRevenueCents / 100).toFixed(2)} est. revenue, ` +
        `${entry.roi}% ROI`
      );
    }

    const totalRevenue = entries.reduce((sum, e) => sum + e.estimatedRevenueCents, 0);
    const totalCost = entries.reduce((sum, e) => sum + e.totalCostCents, 0);
    parts.push(
      `\nTotal: $${(totalRevenue / 100).toFixed(2)} estimated revenue from $${(totalCost / 100).toFixed(2)} bot costs.`
    );

    return parts.join("\n");
  }

  /**
   * Generate recommendations based on the performance leaderboard.
   */
  private generateLeaderboardRecommendations(entries: PerformanceEntry[]): string[] {
    const recommendations: string[] = [];

    const inactiveBots = entries.filter((e) => e.totalActions === 0);
    if (inactiveBots.length > 0) {
      recommendations.push(
        `${inactiveBots.length} bots have no activity: ${inactiveBots.map((e) => e.botName).join(", ")}. Consider activating them.`
      );
    }

    const negativeROI = entries.filter((e) => e.roi < 0 && e.totalActions > 0);
    if (negativeROI.length > 0) {
      recommendations.push(
        `${negativeROI.length} bots have negative ROI: ${negativeROI.map((e) => e.botName).join(", ")}. Review their effectiveness.`
      );
    }

    const topPerformer = entries.find((e) => e.rank === 1 && e.totalActions > 0);
    if (topPerformer && topPerformer.roi > 100) {
      recommendations.push(
        `${topPerformer.botName} is your best performer with ${topPerformer.roi}% ROI. Consider increasing its usage.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Bot performance is balanced. Continue monitoring.");
    }

    return recommendations;
  }

  // ============================================
  // UTILITY / INFO METHODS
  // ============================================

  /**
   * Get all available pipeline definitions.
   */
  getPipelineDefinitions(): PipelineDefinition[] {
    return PIPELINE_DEFINITIONS;
  }

  /**
   * Get a specific pipeline definition by ID.
   */
  getPipelineDefinition(pipelineId: string): PipelineDefinition | undefined {
    return PIPELINE_DEFINITIONS.find((p) => p.id === pipelineId);
  }

  /**
   * Get a full orchestrator status overview.
   */
  async getOrchestratorStatus(): Promise<{
    enabled: boolean;
    autoTriggersEnabled: boolean;
    activePipelines: number;
    toggles: Record<string, boolean>;
    availablePipelines: Array<{ id: string; name: string; description: string; enabled: boolean }>;
  }> {
    try {
      const toggles = await this.getToggles();
      const active = await this.getActivePipelines();

      return {
        enabled: toggles["orchestrator_enabled"] || false,
        autoTriggersEnabled: toggles["auto_triggers_enabled"] || false,
        activePipelines: active.length,
        toggles,
        availablePipelines: PIPELINE_DEFINITIONS.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          enabled: toggles[`pipeline_${p.id}`] || false,
        })),
      };
    } catch (error: any) {
      logger.error("Failed to get orchestrator status", { error: error.message });
      throw error;
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const botOrchestratorService = new BotOrchestratorService();
export default botOrchestratorService;
