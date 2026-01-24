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

// Analytics (Forecasting)
import analyticsRoutes from "./routes/analytics.js";

// AI Search & Recommendations (Phase 14)
import aiRoutes from "./routes/aiRoutes.js";

// Notification Center (Phase 16)
import notificationRoutes from "./routes/notificationRoutes.js";

// Feedback System (Phase 18)
import feedbackRoutes from "./routes/feedbackRoutes.js";

// Global Search (Phase 20)
import searchRoutes from "./routes/searchRoutes.js";

// Rate limiting
import { loginRateLimit, passwordResetRateLimit } from "./middleware/rateLimit.js";

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
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

// OPS Layer routes (FOUNDER ONLY — Never expose to employees/clients)
app.use("/api/ops/metrics", opsMetricsRoutes);
app.use("/api/ops/watch", opsWatchRoutes);

// Role-specific management panels
app.use("/api/hr", hrRoutes);
app.use("/api/hr/training", hrTrainingRoutes);
app.use("/api/compliance", complianceRoutes);

// Internal Communication (Comms Chamber)
app.use("/api/comms", commsRoutes);

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

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     MGR CAPITAL ASSISTANCE — API SERVER        ║
╠════════════════════════════════════════════════╣
║  Status:      RUNNING                          ║
║  Port:        ${PORT}                              ║
║  Environment: ${config.nodeEnv?.padEnd(32)}║
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
