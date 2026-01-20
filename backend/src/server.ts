// ============================================
// MGR CAPITAL ASSISTANCE — API SERVER
// Production-ready Express server
// ============================================

import express from "express";
import cors from "cors";
import { config } from "./config/env.js";

// Route imports
import authRoutes from "./routes/auth.js";
import casesRoutes from "./routes/cases.js";
import employeesRoutes from "./routes/employees.js";
import clientsRoutes from "./routes/clients.js";
import payoutsRoutes from "./routes/payouts.js";
import legalRoutes from "./routes/legal.js";
import ingestionRoutes from "./routes/ingestion.js";
import trainingRoutes from "./routes/training.js";

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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: config.nodeEnv === "production" ? "Internal server error" : err.message
  });
});

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
