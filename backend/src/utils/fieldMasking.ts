// ============================================
// FIELD MASKING UTILITY — MGR CAPITAL ASSISTANCE
// Ensures sensitive data is never exposed to unauthorized users
// ============================================

import { UserRole } from "@prisma/client";

// Fields that should NEVER be exposed to employees
const EMPLOYEE_RESTRICTED_FIELDS = [
  "surplusAmountCents",
  "feePercent",
  "actualFeeCents",
  "actualRatePercent",
  "founderShareCents",
  "estimatedFeeCents",
  "clientPayoutCents",
  "notes", // Internal founder notes
  "rejectionReason",
  "actualRate",
  "ssn4",
  "passwordHash",
];

// Fields that should NEVER be exposed to clients
const CLIENT_RESTRICTED_FIELDS = [
  ...EMPLOYEE_RESTRICTED_FIELDS,
  "assignedEmployeeId",
  "assignedEmployee",
  "internalCode",
  "priority",
  "source",
  "displayedRatePercent",
  "displayedAmountCents",
  "tierAtTime",
  "displayedRate",
  "amountCents",
  "overridePercent",
  "teamLeaderId",
  "teamLeader",
  "teamMembers",
  "employeeTier",
  "hireDate",
  "trainingCompleted",
];

// Commission-related fields that need special handling for shadow accounting
const SHADOW_ACCOUNTING_FIELDS = [
  "actualRatePercent",
  "displayedRatePercent",
  "actualRate",
  "displayedRate",
  "amountCents",
  "displayedAmountCents",
];

/**
 * Get list of restricted fields based on user role
 */
export function getRestrictedFields(role: UserRole): string[] {
  switch (role) {
    case "FOUNDER":
      return []; // Founder sees everything
    case "ADMIN":
      return ["passwordHash", "ssn4"]; // Admins see almost everything except highly sensitive
    case "EMPLOYEE":
      return EMPLOYEE_RESTRICTED_FIELDS;
    case "CLIENT":
      return CLIENT_RESTRICTED_FIELDS;
    default:
      return CLIENT_RESTRICTED_FIELDS; // Default to most restrictive
  }
}

/**
 * Remove restricted fields from an object based on user role
 */
export function maskSensitiveFields<T extends Record<string, any>>(
  data: T,
  role: UserRole
): Partial<T> {
  if (role === "FOUNDER") {
    return data; // Founder sees everything
  }

  const restrictedFields = getRestrictedFields(role);
  const masked = { ...data };

  for (const field of restrictedFields) {
    if (field in masked) {
      delete (masked as any)[field];
    }
  }

  // Handle nested objects
  for (const key of Object.keys(masked)) {
    const value = (masked as any)[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      (masked as any)[key] = maskSensitiveFields(value, role);
    } else if (Array.isArray(value)) {
      (masked as any)[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? maskSensitiveFields(item, role)
          : item
      );
    }
  }

  return masked;
}

/**
 * Mask an array of objects
 */
export function maskSensitiveFieldsArray<T extends Record<string, any>>(
  data: T[],
  role: UserRole
): Partial<T>[] {
  return data.map((item) => maskSensitiveFields(item, role));
}

/**
 * Apply shadow accounting transformation for employee views
 * Employees see "displayed" values, not actual values
 */
export function applyShadowAccounting<T extends Record<string, any>>(
  data: T,
  role: UserRole
): T {
  if (role === "FOUNDER" || role === "ADMIN") {
    return data; // Full visibility
  }

  const result = { ...data };

  // For employees: replace actual values with displayed values
  if (role === "EMPLOYEE") {
    // Commission rate: show displayed, hide actual
    if ("displayedRatePercent" in result && "actualRatePercent" in result) {
      (result as any).commissionRate = (result as any).displayedRatePercent;
      delete (result as any).actualRatePercent;
      delete (result as any).displayedRatePercent;
    }

    // Ledger amounts: show displayed, hide actual
    if ("displayedAmountCents" in result && "amountCents" in result) {
      (result as any).amountCents = (result as any).displayedAmountCents || (result as any).amountCents;
      delete (result as any).displayedAmountCents;
    }

    // Commission on individual entries
    if ("displayedRate" in result && "actualRate" in result) {
      (result as any).rate = (result as any).displayedRate;
      delete (result as any).actualRate;
      delete (result as any).displayedRate;
    }
  }

  return result;
}

/**
 * Format case data for client view
 * Clients should only see their case status and basic info
 */
export function formatCaseForClient(caseData: any): any {
  // Status mapping to client-friendly messages
  const statusMessages: Record<string, { status: string; message: string }> = {
    NEW: {
      status: "Getting Started",
      message: "We've received your information and are beginning the review process.",
    },
    CONTACTED: {
      status: "In Progress",
      message: "Our team has reached out to discuss your case.",
    },
    DOCS_PENDING: {
      status: "Documents Needed",
      message: "Please upload your ID and sign the required documents.",
    },
    DOCS_SIGNED: {
      status: "Processing",
      message: "We have your documents and are preparing your filing.",
    },
    FILED: {
      status: "Filed",
      message: "Your claim has been filed with the county. We're now waiting for processing.",
    },
    AWAITING_FUNDS: {
      status: "Almost There",
      message: "Your claim has been approved! We're waiting for the funds to be released.",
    },
    PAID: {
      status: "Complete",
      message: "Your funds have been disbursed. Thank you for working with us!",
    },
    CLOSED: {
      status: "Closed",
      message: "This case has been closed.",
    },
    REJECTED: {
      status: "Under Review",
      message: "Your case requires additional review. Our team will contact you.",
    },
  };

  const statusInfo = statusMessages[caseData.status] || {
    status: "Processing",
    message: "Your case is being processed.",
  };

  return {
    propertyAddress: caseData.propertyAddress,
    county: caseData.county,
    state: caseData.state,
    status: statusInfo.status,
    statusMessage: statusInfo.message,
    documents: caseData.documents?.map((doc: any) => ({
      id: doc.id,
      type: doc.type,
      needsSignature: doc.signatureRequired && !doc.signedAt,
      signed: !!doc.signedAt,
    })),
  };
}

/**
 * Format employee data for employee self-view
 * Apply shadow accounting to their own profile
 */
export function formatEmployeeForSelf(employeeData: any, commissionPlan: any): any {
  return {
    id: employeeData.id,
    name: employeeData.name,
    email: employeeData.email,
    phone: employeeData.phone,
    employeeTier: employeeData.employeeTier,
    displayedRatePercent: commissionPlan?.displayedRatePercent || 20,
    // Note: actualRatePercent is intentionally NOT included
    hireDate: employeeData.hireDate,
    trainingCompleted: employeeData.trainingCompleted,
    isActive: employeeData.isActive,
  };
}

/**
 * Format ledger entry for employee view
 * Apply shadow accounting to commission amounts
 */
export function formatLedgerForEmployee(entry: any): any {
  return {
    id: entry.id,
    type: entry.type,
    // Use displayed amount if available, otherwise actual
    amountCents: entry.displayedAmountCents || entry.amountCents,
    description: entry.description,
    status: entry.status,
    createdAt: entry.createdAt,
    // Intentionally exclude: actualRate, founderShareCents, etc.
  };
}

/**
 * Format payout calculation for display
 * Founder sees full breakdown, employees see only their displayed portion
 */
export function formatPayoutCalculation(
  calculation: any,
  role: UserRole
): any {
  if (role === "FOUNDER" || role === "ADMIN") {
    // Full breakdown
    return {
      surplusAmountCents: calculation.surplusAmountCents,
      feeAmountCents: calculation.feeAmountCents,
      clientPayoutCents: calculation.clientPayoutCents,
      employeeCommissionCents: calculation.employeeCommissionCents,
      employeeDisplayedCommissionCents: calculation.employeeDisplayedCommissionCents,
      founderShareCents: calculation.founderShareCents,
      companyFeeCents: calculation.companyFeeCents,
    };
  }

  if (role === "EMPLOYEE") {
    // Employee only sees their displayed commission
    return {
      commissionCents: calculation.employeeDisplayedCommissionCents,
    };
  }

  // Clients see nothing about finances
  return {};
}

/**
 * Validate that sensitive fields are not being exposed
 * Use this as a safety check before sending responses
 */
export function validateNoSensitiveFields(
  data: any,
  role: UserRole
): { valid: boolean; exposedFields: string[] } {
  const restrictedFields = getRestrictedFields(role);
  const exposedFields: string[] = [];

  function checkObject(obj: any, path: string = ""): void {
    if (!obj || typeof obj !== "object") return;

    for (const key of Object.keys(obj)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (restrictedFields.includes(key)) {
        exposedFields.push(fullPath);
      }

      if (typeof obj[key] === "object" && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          obj[key].forEach((item: any, index: number) => {
            checkObject(item, `${fullPath}[${index}]`);
          });
        } else {
          checkObject(obj[key], fullPath);
        }
      }
    }
  }

  checkObject(data);

  return {
    valid: exposedFields.length === 0,
    exposedFields,
  };
}
