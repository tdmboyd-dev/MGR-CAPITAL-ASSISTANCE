// ============================================
// MGR CAPITAL ASSISTANCE — API SERVER
// Production-ready Express server
// ============================================

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/env.js";

// Middleware imports
import { globalErrorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { auditLogMiddleware } from "./middleware/auditLogger.js";

// Route imports
import authRoutes from "./routes/auth.js";
import casesRoutes from "./routes/cases.js";
import employeesRoutes from "./routes/employees.js";
import clientsRoutes from "./routes/clients.js";
import payoutsRoutes from "./routes/payouts.js";
import legalRoutes from "./routes/legal.js";
import ingestionRoutes from "./routes/ingestion.js";
import trainingRoutes from "./routes/training.js";
import settingsRoutes from "./routes/settings.js";
import documentsRoutes from "./routes/documents.js";

// OPS Layer routes (FOUNDER ONLY)
import opsMetricsRoutes from "./routes/opsMetrics.js";
import opsWatchRoutes from "./routes/opsWatch.js";

// Role-specific management panels
import hrRoutes from "./routes/hrRoutes.js";
import hrTrainingRoutes from "./routes/hrTrainingRoutes.js";
import complianceRoutes from "./routes/complianceRoutes.js";

// Internal Communication (Comms Chamber)
import commsRoutes from "./routes/comms.js";

// Client Portal Messages
import messagesRoutes from "./routes/messagesRoutes.js";

// Analytics (Forecasting)
import analyticsRoutes from "./routes/analytics.js";

// AI Search & Recommendations (Phase 14)
import aiRoutes from "./routes/aiRoutes.js";

// Notification Center (Phase 16)
import notificationRoutes from "./routes/notificationRoutes.js";

// Feedback System (Phase 18)
import feedbackRoutes from "./routes/feedbackRoutes.js";

// Email Dashboard & Hosting
import emailDashboardRoutes from "./routes/emailRoutes.js";
import emailHostingRoutes from "./routes/emailHostingRoutes.js";
import emailInboxRoutes from "./routes/emailInboxRoutes.js";

// Child Company System
import childCompanyRoutes from "./routes/childCompanyRoutes.js";

// THE OFFICE TABLE — Contracts, Violations, Bans
import officeTableRoutes from "./routes/officeTableRoutes.js";

// Global Search (Phase 20)
import searchRoutes from "./routes/searchRoutes.js";

// Blockchain Payouts (Phase 21)
import blockchainRoutes from "./routes/blockchainRoutes.js";

// Voice AI (Phase 24)
import voiceRoutes from "./routes/voiceRoutes.js";

// AI Legal Bots (Phase 25)
import aiBotsRoutes from "./routes/aiBotsRoutes.js";

// Document Generation (Voice-to-Document)
import documentGenerationRoutes from "./routes/documentGeneration.js";

// Payment Collection (Nickel ACH)
import paymentsRoutes from "./routes/payments.js";

// Skip Tracing (Tracerfy)
import skipTraceRoutes from "./routes/skipTrace.js";

// State Deadlines
import deadlinesRoutes from "./routes/deadlines.js";

// AI Phone Bot (Twilio + ElevenLabs + OpenAI)
import phoneRoutes from "./routes/phoneRoutes.js";

// NFT Minting (Surplus Claims)
import nftRoutes from "./routes/nftRoutes.js";

// AI Heir Genealogy Trees (Phase 26)
import genealogyRoutes from "./routes/genealogyRoutes.js";

// Blockchain Surplus Auctions (Phase 27)
import auctionRoutes from "./routes/auctionRoutes.js";

// AI Fraud Detection (Phase 28)
import fraudRoutes from "./routes/fraudRoutes.js";

// Legal Auditor (Phase 29)
import legalAuditorRoutes from "./routes/legalRoutes.js";

// P2P Marketplace (Phase 29)
import marketplaceRoutes from "./routes/marketplaceRoutes.js";

// Oracle Service (Phase 29)
import oracleRoutes from "./routes/oracleRoutes.js";

// Autonomous AI Oracle (Next-gen AI capabilities)
import autonomousAiRoutes from "./routes/autonomousAiRoutes.js";

// Rate limiting
import { loginRateLimit, passwordResetRateLimit } from "./middleware/rateLimit.js";

// Services that need initialization
import { notificationService } from "./services/notificationService.js";

// Webhook routes (external partner leads)
import webhookRoutes from "./routes/webhookRoutes.js";

// Bot Subscriptions (Action Bots)
import botSubscriptionRoutes from "./routes/botSubscriptionRoutes.js";

// Founder Notary (Self-hosted RON)
import founderNotaryRoutes from "./routes/founderNotaryRoutes.js";

// Employee Notary (In-house notary work)
import employeeNotaryRoutes from "./routes/employeeNotaryRoutes.js";

// Trust Automation (Asset Protection)
import trustRoutes from "./routes/trustRoutes.js";

// County Surplus Requirements
import surplusRequirementsRoutes from "./routes/surplusRequirementsRoutes.js";

// Client Tipping (Shadow Cut)
import tippingRoutes from "./routes/tippingRoutes.js";

// Activity Tracking & Violations
import activityRoutes from "./routes/activityRoutes.js";

// SMS Templates Library (Outreach)
import smsTemplateRoutes from "./routes/smsTemplateRoutes.js";

// Mobile API (Optimized for mobile apps)
import mobileRoutes from "./routes/mobileRoutes.js";

// Master Settings (Global Feature Toggles)
import masterSettingsRoutes from "./routes/masterSettingsRoutes.js";

// Scheduler (autopilot crons)
import scheduler from "./cron/scheduler.js";

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3011", "http://127.0.0.1:3011"],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging (production-ready)
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Audit logging middleware (after auth routes)
app.use(auditLogMiddleware);

// ============================================
// ROUTES
// ============================================

// Authentication (with rate limiting)
app.post("/api/auth/login", loginRateLimit);
app.post("/api/auth/request-password-reset", passwordResetRateLimit);
app.use("/api/auth", authRoutes);

// Core business routes
app.use("/api/cases", casesRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/payouts", payoutsRoutes);

// Document Vault routes (secure file upload/download)
app.use("/api/documents", documentsRoutes);

// Founder-only routes
app.use("/api/legal", legalRoutes);
app.use("/api/ingestion", ingestionRoutes);
app.use("/api/training", trainingRoutes);
app.use("/api/settings", settingsRoutes);

// Master Settings (Global Feature Toggles - FOUNDER/ADMIN ONLY)
app.use("/api/settings/master", masterSettingsRoutes);

// OPS Layer routes (FOUNDER ONLY — Never expose to employees/clients)
app.use("/api/ops/metrics", opsMetricsRoutes);
app.use("/api/ops/watch", opsWatchRoutes);

// Role-specific management panels
app.use("/api/hr", hrRoutes);
app.use("/api/hr/training", hrTrainingRoutes);
app.use("/api/compliance", complianceRoutes);

// Internal Communication (Comms Chamber)
app.use("/api/comms", commsRoutes);

// Client Portal Messages
app.use("/api/messages", messagesRoutes);

// Analytics (Forecasting)
app.use("/api/analytics", analyticsRoutes);

// AI Search & Recommendations (Phase 14)
app.use("/api/ai", aiRoutes);

// Notification Center (Phase 16)
app.use("/api/notifications", notificationRoutes);

// Feedback System (Phase 18)
app.use("/api/feedback", feedbackRoutes);

// Global Search (Phase 20)
app.use("/api/search", searchRoutes);

// Blockchain Payouts (Phase 21)
app.use("/api/blockchain", blockchainRoutes);

// Voice AI (Phase 24)
app.use("/api/voice", voiceRoutes);

// AI Legal Bots (Phase 25)
app.use("/api/ai-bots", aiBotsRoutes);

// Document Generation (Voice-to-Document)
app.use("/api/documents", documentGenerationRoutes);

// Payment Collection (Nickel ACH - FREE)
app.use("/api/payments", paymentsRoutes);

// Skip Tracing (Tracerfy API)
app.use("/api/skip-trace", skipTraceRoutes);

// State Deadlines & Compliance
app.use("/api/deadlines", deadlinesRoutes);

// AI Phone Bot (Twilio + ElevenLabs + OpenAI)
app.use("/api/phone", phoneRoutes);

// NFT Minting (Surplus Claim Tokenization)
app.use("/api/nft", nftRoutes);

// AI Heir Genealogy Trees
app.use("/api/genealogy", genealogyRoutes);

// Blockchain Surplus Auctions
app.use("/api/auctions", auctionRoutes);

// AI Fraud Detection
app.use("/api/fraud", fraudRoutes);

// Legal Document Auditor
app.use("/api/legal-audit", legalAuditorRoutes);

// P2P Marketplace
app.use("/api/marketplace", marketplaceRoutes);

// State Law Oracle
app.use("/api/oracle", oracleRoutes);

// Autonomous AI Oracle (Next-gen AI capabilities)
app.use("/api/ai-oracle", autonomousAiRoutes);

// Email Dashboard (Founder)
app.use("/api/emails", emailDashboardRoutes);

// Email Hosting (Phase 3)
app.use("/api/email-hosting", emailHostingRoutes);

// Email Inbox (Mailbox access)
app.use("/api/email", emailInboxRoutes);

// Inbox alias for frontend compatibility (/api/inbox -> simplified email routes)
app.use("/api/inbox", emailInboxRoutes);

// Child Company System (Phase 2)
app.use("/api/child-companies", childCompanyRoutes);

// THE OFFICE TABLE — Contracts, Violations, Bans
app.use("/api/office-table", officeTableRoutes);

// Bot Subscriptions (Action Bots)
app.use("/api/bot-subscriptions", botSubscriptionRoutes);

// Webhook Lead Receiver (Autopilot)
app.use("/api/webhooks", webhookRoutes);

// Founder Notary (Self-hosted RON)
app.use("/api/founder-notary", founderNotaryRoutes);

// Employee Notary (In-house notary work for surplus recovery)
app.use("/api/employee-notary", employeeNotaryRoutes);

// Trust Automation (Asset Protection)
app.use("/api/trusts", trustRoutes);

// County Recovery Requirements (notarization, forms, deadlines)
// NOTE: Using "recovery" not "surplus" in URL for shadow compliance
app.use("/api/recovery-requirements", surplusRequirementsRoutes);

// Client Tipping (Shadow Cut - employees see full tip, get 50%)
app.use("/api/tips", tippingRoutes);

// Activity Tracking & Violations (3 days/week, 2-day case inactivity)
app.use("/api/activity", activityRoutes);

// Mobile API (Optimized endpoints for mobile apps)
app.use("/api/mobile", mobileRoutes);

// SMS Templates Library (Outreach automation)
app.use("/api/sms-templates", smsTemplateRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: config.nodeEnv
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler - masks internal errors, logs privately
// FOUNDER sees full details, employees/clients see safe messages
app.use(globalErrorHandler);

// ============================================
// SERVER START
// ============================================

const PORT = config.port || 3001;

// ============================================
// WEBSOCKET SERVER (Real-time collaboration)
// ============================================

import { WebSocketServer, WebSocket } from "ws";

const WS_PORT = Number(process.env.WS_PORT) || 4001;

const wss = new WebSocketServer({ port: WS_PORT });

// Room management for collaborative editing
const rooms: Map<string, Set<WebSocket>> = new Map();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const caseId = url.searchParams.get("caseId") || url.pathname.split("-")[1];

  if (!caseId) {
    ws.close(1008, "Missing caseId parameter");
    return;
  }

  const roomKey = `case-${caseId}`;

  // Join room
  if (!rooms.has(roomKey)) {
    rooms.set(roomKey, new Set());
  }
  rooms.get(roomKey)!.add(ws);

  console.log(`[WS] Client joined room: ${roomKey} (${rooms.get(roomKey)!.size} users)`);

  // Broadcast messages to all clients in the same room
  ws.on("message", (message) => {
    const room = rooms.get(roomKey);
    if (!room) return;

    room.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  // Handle disconnection
  ws.on("close", () => {
    const room = rooms.get(roomKey);
    if (room) {
      room.delete(ws);
      console.log(`[WS] Client left room: ${roomKey} (${room.size} users remaining)`);
      if (room.size === 0) {
        rooms.delete(roomKey);
      }
    }
  });

  ws.on("error", (error) => {
    console.error(`[WS] Error in room ${roomKey}:`, error.message);
  });
});

console.log(`[WS] WebSocket server running on port ${WS_PORT}`);

// ============================================
// HTTP SERVER START
// ============================================

app.listen(PORT, async () => {
  // Initialize services
  const smtpReady = await notificationService.initialize();
  console.log(`[Email] SMTP ${smtpReady ? 'initialized' : 'not configured (emails will be logged)'}`);

  // Start scheduler if enabled
  const enableScheduler = process.env.ENABLE_SCHEDULER === "true";
  if (enableScheduler) {
    try {
      await scheduler.start();
      console.log(`[Scheduler] Autopilot scheduler STARTED`);
    } catch (err) {
      console.error(`[Scheduler] Failed to start:`, err);
    }
  } else {
    console.log(`[Scheduler] Disabled (set ENABLE_SCHEDULER=true to enable)`);
  }

  console.log(`
╔════════════════════════════════════════════════╗
║     MGR CAPITAL ASSISTANCE — API SERVER        ║
╠════════════════════════════════════════════════╣
║  Status:      RUNNING                          ║
║  Port:        ${PORT}                              ║
║  Environment: ${config.nodeEnv?.padEnd(32)}║
║  Email:       ${smtpReady ? 'ENABLED' : 'DISABLED'}                          ║
║  Time:        ${new Date().toISOString()}   ║
╚════════════════════════════════════════════════╝

Available endpoints:
  - /api/health         Health check
  - /api/auth           Authentication (rate limited)
  - /api/cases          Case management
  - /api/employees      Employee management
  - /api/clients        Client portal
  - /api/payouts        Payout/ledger
  - /api/documents      Document Vault
  - /api/legal          Legal (Founder only)
  - /api/ingestion      Ingestion (Founder only)
  - /api/training       Training management

OPS Layer (FOUNDER ONLY):
  - /api/ops/metrics    Ops metrics dashboard
  - /api/ops/watch      Scraper & watch alerts

Role-Based Panels:
  - /api/hr             HR management
  - /api/hr/training    Training Intelligence (HR)
  - /api/compliance     Compliance monitoring

Internal Communication:
  - /api/comms          Comms Chamber (chat rooms/messages)

Analytics:
  - /api/analytics      Forecasting & predictions (Founder/Admin only)
  `);
});

export default app;
