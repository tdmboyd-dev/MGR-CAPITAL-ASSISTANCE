import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  databaseUrl: process.env.DATABASE_URL || "",
  nodeEnv: process.env.NODE_ENV || "development",

  // JWT Settings (hardened)
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-refresh-secret-change-in-production",
  jwtAccessExpiryMinutes: parseInt(process.env.JWT_ACCESS_EXPIRY_MINUTES || "15", 10),
  jwtRefreshExpiryDays: parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || "14", 10),

  // Legacy (kept for compatibility, maps to access token)
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",

  // Cookie settings
  cookieSecure: process.env.COOKIE_SECURE !== "false", // Default true
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 min
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  authRateLimitMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || "10", 10),
};
