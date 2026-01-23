// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "FOUNDER" | "ADMIN" | "EMPLOYEE" | "CLIENT";
  tier?: string | null;
  phone?: string | null;
  isActive: boolean;
  trainingCompleted?: boolean;
}

// Case types
export interface Case {
  id: string;
  caseCode: string;
  status: CaseStatus;
  state: string;
  county: string;
  propertyAddress?: string;
  parcelNumber?: string;
  saleDate?: string;
  saleType?: string;
  originalOwnerName?: string;
  surplusAmountCents?: number;
  estimatedRecoveryCents?: number;
  actualRecoveryCents?: number;
  assignedEmployeeId?: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CaseStatus =
  | "NEW"
  | "RESEARCHING"
  | "CONTACTING"
  | "SIGNED"
  | "FILED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PAYOUT_SCHEDULED"
  | "CLOSED_WON"
  | "CLOSED_LOST"
  | "ON_HOLD";

// OpsInsight types
export interface OpsInsight {
  id: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  isActioned: boolean;
  createdAt: string;
}

// Training types
export interface TrainingModule {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  duration?: number;
  tier: string;
  isRequired: boolean;
  passScore: number;
}

export interface TrainingProgress {
  id: string;
  moduleId: string;
  employeeId: string;
  completed: boolean;
  score?: number;
  attempts: number;
  completedAt?: string;
}

// Document types
export interface Document {
  id: string;
  caseId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedById: string;
  createdAt: string;
}

// Payout types
export interface LedgerEntry {
  id: string;
  caseId?: string;
  userId?: string;
  type: string;
  status: string;
  amountCents: number;
  description?: string;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
