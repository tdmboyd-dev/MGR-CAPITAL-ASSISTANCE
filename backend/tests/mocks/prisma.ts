/**
 * Prisma Mock for Testing
 *
 * Provides a mock PrismaClient with jest functions for all models.
 */

import { jest } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Reset mock between tests
beforeEach(() => {
  mockReset(prismaMock);
});

// Export type for use in tests
export type MockPrismaClient = DeepMockProxy<PrismaClient>;

// Helper to create mock user data
export const mockUser = (overrides = {}) => ({
  id: "user-123",
  email: "test@example.com",
  passwordHash: "$2b$12$test.hash.for.testing",
  role: "EMPLOYEE" as const,
  name: "Test User",
  phone: null,
  address: null,
  city: null,
  state: null,
  zipCode: null,
  isActive: true,
  emailVerified: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  employeeTier: "TIER_1_ASSOCIATE" as const,
  hireDate: new Date(),
  teamLeaderId: null,
  trainingCompleted: false,
  ssn4: null,
  dateOfBirth: null,
  ...overrides,
});

// Helper to create mock founder user
export const mockFounder = (overrides = {}) =>
  mockUser({
    id: "founder-123",
    email: "founder@example.com",
    role: "FOUNDER" as const,
    name: "Founder User",
    employeeTier: null,
    ...overrides,
  });

// Helper to create mock case data
export const mockCase = (overrides = {}) => ({
  id: "case-123",
  internalCode: "MGR-2026-001",
  publicAccessToken: "public-token-123",
  status: "NEW" as const,
  clientId: "client-123",
  assignedEmployeeId: "employee-123",
  state: "TN",
  county: "Davidson",
  propertyAddress: "123 Test St",
  parcelNumber: "12345",
  saleDate: new Date(),
  previousOwner: "Previous Owner",
  surplusAmountCents: 500000,
  feePercent: 30,
  estimatedFeeCents: 150000,
  actualFeeCents: null,
  clientPayoutCents: null,
  redemptionDeadline: null,
  filingDeadline: null,
  claimNumber: null,
  courtCaseNumber: null,
  contactedAt: null,
  docsRequestedAt: null,
  docsSignedAt: null,
  filedAt: null,
  fundsReceivedAt: null,
  fundsDisbursedAt: null,
  paidAt: null,
  closedAt: null,
  source: "test",
  priority: 0,
  notes: null,
  rejectionReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create mock refresh token
export const mockRefreshToken = (overrides = {}) => ({
  id: "token-123",
  userId: "user-123",
  hashedToken: "hashed-token-value",
  userAgent: "Mozilla/5.0",
  ipAddress: "127.0.0.1",
  expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  rotatedAt: null,
  replacedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create mock FounderConfig
export const mockFounderConfig = (key: string, value: unknown) => ({
  id: `config-${key}`,
  key,
  value,
  description: `${key} configuration`,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Helper to create mock OpsInsight
export const mockOpsInsight = (overrides = {}) => ({
  id: "insight-123",
  type: "INGESTION_ANALYSIS" as const,
  priority: "NORMAL" as const,
  title: "Test Insight",
  summary: "Test summary",
  details: null,
  plainEnglish: "Plain English explanation",
  recommendations: null,
  relatedCaseIds: [],
  relatedUserIds: [],
  relatedAlertIds: [],
  sourceBot: "testBot",
  generatedAt: new Date(),
  isStale: false,
  expiresAt: null,
  isRead: false,
  readAt: null,
  isActioned: false,
  actionedAt: null,
  actionNotes: null,
  createdAt: new Date(),
  ...overrides,
});

export default prismaMock;
