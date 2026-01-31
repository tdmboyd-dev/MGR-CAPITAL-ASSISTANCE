// ============================================
// TRAINING TYPES — MGR CAPITAL ASSISTANCE
// Type definitions for Training Intelligence Layer
// ============================================

import {
  EmployeeTier,
  UserRole,
  TrainingModuleSourceType,
  TrainingRecommendationPriority,
  TrainingRecommendationReason,
  TierProgressionStatus,
} from "@prisma/client";

// Re-export Prisma enums so consumers can import from here
export {
  TrainingModuleSourceType,
  TrainingRecommendationPriority,
  TrainingRecommendationReason,
  TierProgressionStatus,
};

// ============================================
// CONTRACTOR METRICS
// ============================================

export interface ContractorMetrics {
  employeeId: string;
  employeeName: string;
  employeeTier: EmployeeTier;

  // Training metrics
  trainingCompletion: number;
  modulesCompleted: number;
  modulesTotal: number;
  averageQuizScore: number;
  lastTrainingDate: Date | null;

  // Performance metrics
  totalCases: number;
  paidCases: number;
  rejectedCases: number;
  conversionRate: number;

  // Call quality
  averageCallScore: number;
  complianceViolations: number;

  // Revenue (shadow - actual values, not displayed)
  totalRevenueCents: number;
  avgCaseValueCents: number;

  // Time metrics
  avgDaysToClose: number;
  casesThisMonth: number;
  casesLastMonth: number;

  // Flags
  performanceFlags: string[];
  needsCoaching: boolean;
}

export interface ContractorTrainingNeeds {
  employeeId: string;
  employeeName: string;
  employeeTier: EmployeeTier;

  // Identified gaps
  skillGaps: SkillGap[];

  // Recommended modules
  recommendedModules: ModuleRecommendation[];

  // Coaching focus areas
  coachingAreas: string[];

  // Priority ranking
  overallPriority: TrainingRecommendationPriority;

  // Analysis timestamp
  analyzedAt: Date;
}

export interface SkillGap {
  skill: string;
  currentLevel: number;
  requiredLevel: number;
  gap: number;
  relatedModules: string[];
}

export interface ModuleRecommendation {
  moduleId: string;
  moduleTitle: string;
  reason: TrainingRecommendationReason;
  priority: TrainingRecommendationPriority;
  estimatedDuration: number; // minutes
  dueDate?: Date;
  mandatory: boolean;
}

// ============================================
// DYNAMIC MODULE GENERATION
// ============================================

export interface DynamicModuleSource {
  type: TrainingModuleSourceType;
  sourceId: string;
  sourceSummary: string;
  relevantData: Record<string, any>;
}

export interface DynamicModuleSpec {
  title: string;
  description: string;
  content: DynamicModuleContent;
  targetAudience: TargetAudience;
  source: DynamicModuleSource;
  quizQuestions: DynamicQuizQuestion[];
  estimatedDuration: number;
  expiresAt?: Date;
}

export interface DynamicModuleContent {
  overview: string;
  keyPoints: string[];
  detailedSections: ContentSection[];
  actionItems: string[];
  resources: ResourceLink[];
}

export interface ContentSection {
  title: string;
  content: string;
  examples?: string[];
  warnings?: string[];
}

export interface ResourceLink {
  title: string;
  url?: string;
  type: "DOCUMENT" | "VIDEO" | "EXTERNAL" | "INTERNAL";
}

export interface DynamicQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface TargetAudience {
  roles?: UserRole[];
  tiers?: EmployeeTier[];
  states?: string[];
  employeeIds?: string[];
  all?: boolean;
}

// ============================================
// TIER PROGRESSION
// ============================================

export interface TierProgressionRequirements {
  tier: EmployeeTier;
  displayName: string;

  // Cases
  minCases: number;
  minPaidCases: number;
  minConversionRate: number;

  // Training
  requiredModules: string[];
  minQuizScore: number;

  // Revenue (shadow accounting - internal only)
  minRevenueCents: number;

  // Time
  minTenureDays: number;

  // Quality
  minCallScore: number;
  maxComplianceViolations: number;
}

export interface TierProgressionEvaluation {
  employeeId: string;
  employeeName: string;
  currentTier: EmployeeTier;
  targetTier: EmployeeTier;

  // Status
  status: TierProgressionStatus;

  // Requirements breakdown
  requirementsMet: RequirementStatus[];

  // Overall progress
  overallProgress: number;

  // Shadow accounting (internal only)
  actualRevenueCents: number;
  displayedRevenueCents: number;

  // Evaluation
  evaluatedAt: Date;
  evaluatedBy: string;
  notes?: string;
}

export interface RequirementStatus {
  requirement: string;
  category: "CASES" | "TRAINING" | "REVENUE" | "QUALITY" | "TENURE";
  current: number;
  required: number;
  met: boolean;
  displayValue: string; // For shadow accounting
}

// ============================================
// FOUNDER CONFIG — TRAINING SECTION
// ============================================

export interface TrainingConfigSettings {
  // Module generation
  autoGenerateModulesFromInsights: boolean;
  insightTypesForModules: string[];
  moduleExpirationDays: number;

  // Tier progression
  autoTierProgression: boolean;
  tierProgressionReviewRequired: boolean;
  minDaysBetweenPromotions: number;

  // Coaching thresholds
  lowConversionThreshold: number;
  coachingTriggerDays: number;
  mandatoryTrainingDeadlineDays: number;

  // Notifications
  sendTrainingReminders: boolean;
  reminderFrequencyDays: number;
  notifyHROnOverdue: boolean;
  notifyHROverdueDays: number;

  // Module weights
  quizPassingScore: number;
  maxQuizAttempts: number;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfigSettings = {
  autoGenerateModulesFromInsights: true,
  insightTypesForModules: ["COMPLIANCE_CHECK", "INGESTION_ANALYSIS"],
  moduleExpirationDays: 90,

  autoTierProgression: false,
  tierProgressionReviewRequired: true,
  minDaysBetweenPromotions: 90,

  lowConversionThreshold: 30,
  coachingTriggerDays: 14,
  mandatoryTrainingDeadlineDays: 7,

  sendTrainingReminders: true,
  reminderFrequencyDays: 3,
  notifyHROnOverdue: true,
  notifyHROverdueDays: 7,

  quizPassingScore: 80,
  maxQuizAttempts: 3,
};

// ============================================
// TRAINING INTELLIGENCE ANALYSIS
// ============================================

export interface TrainingIntelligenceAnalysis {
  analysisDate: Date;

  // Overview
  totalContractors: number;
  totalModules: number;
  overallCompletionRate: number;

  // Needs analysis
  contractorNeeds: ContractorTrainingNeeds[];

  // Dynamic modules
  generatedModules: DynamicModuleSpec[];

  // Tier progression
  eligibleForPromotion: TierProgressionEvaluation[];

  // Patterns
  patterns: TrainingPattern[];

  // Recommendations
  systemRecommendations: string[];

  // Priority actions
  urgentActions: UrgentTrainingAction[];
}

export interface TrainingPattern {
  type: "HIGH_FAILURE_MODULE" | "SKILL_GAP_CLUSTER" | "JURISDICTION_TRAINING_GAP" | "TIER_BOTTLENECK";
  description: string;
  affectedCount: number;
  severity: "low" | "medium" | "high";
  suggestedAction: string;
}

export interface UrgentTrainingAction {
  priority: TrainingRecommendationPriority;
  category: string;
  description: string;
  affectedEmployeeIds: string[];
  deadline?: Date;
}

// ============================================
// HR PANEL VIEWS
// ============================================

export interface TrainingDashboardData {
  // Summary stats
  totalEmployees: number;
  trainingCompletionRate: number;
  overdueCount: number;
  recentCompletions: number;

  // Module stats
  moduleStats: ModuleStat[];

  // Employee status
  employeeStatuses: EmployeeTrainingStatus[];

  // Alerts
  alerts: TrainingAlert[];

  // Recommendations queue
  recommendations: ModuleRecommendation[];
}

export interface ModuleStat {
  moduleId: string;
  moduleTitle: string;
  completionRate: number;
  avgScore: number;
  failureRate: number;
}

export interface EmployeeTrainingStatus {
  employeeId: string;
  employeeName: string;
  employeeTier: EmployeeTier;
  completionPercent: number;
  overdueModules: number;
  lastActivity: Date | null;
  status: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "COMPLETED";
}

export interface TrainingAlert {
  type: "OVERDUE" | "LOW_SCORE" | "COMPLIANCE_GAP" | "NEW_MODULE_REQUIRED";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  employeeId?: string;
  employeeName?: string;
  moduleId?: string;
  createdAt: Date;
}

// ============================================
// BOT OUTPUT TYPES
// ============================================

export interface TrainingBotAnalysis {
  analysisDate: Date;

  // Coverage
  totalEmployees: number;
  employeesAnalyzed: number;

  // Findings
  needsCoaching: ContractorTrainingNeeds[];
  eligibleForPromotion: TierProgressionEvaluation[];
  newModulesGenerated: DynamicModuleSpec[];

  // Metrics
  overallCompletionRate: number;
  avgQuizScore: number;
  trainingCorrelation: PerformanceCorrelation;

  // Recommendations
  recommendations: string[];

  // Plain English summary
  plainEnglish: string;
}

export interface PerformanceCorrelation {
  correlation: "strong" | "moderate" | "weak" | "none";
  description: string;
  trainedAvgConversion: number;
  untrainedAvgConversion: number;
}
