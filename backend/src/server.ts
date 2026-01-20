// ============================================
// MGR CAPITAL ASSISTANCE — API SERVER
// Production-ready Express server
// ============================================

import express from "express";
import cors from "cors";
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

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: "*",
  credentials: true
}));
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

// Authentication
app.use("/api/auth", authRoutes);

// Core business routes
app.use("/api/cases", casesRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/payouts", payoutsRoutes);

// Founder-only routes
app.use("/api/legal", legalRoutes);
app.use("/api/ingestion", ingestionRoutes);
app.use("/api/training", trainingRoutes);
app.use("/api/settings", settingsRoutes);

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
  - /api/auth           Authentication
  - /api/cases          Case management
  - /api/employees      Employee management
  - /api/clients        Client portal
  - /api/payouts        Payout/ledger
  - /api/legal          Legal (Founder only)
  - /api/ingestion      Ingestion (Founder only)
  - /api/training       Training management
  `);
});

export default app;
