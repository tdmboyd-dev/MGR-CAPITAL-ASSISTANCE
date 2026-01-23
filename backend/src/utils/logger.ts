/**
 * logger.ts
 *
 * Structured logging utility for MGR Capital Assistance.
 * Simple console-based logger with JSON formatting for production.
 *
 * FOUNDER-ONLY OPS LAYER COMPONENT
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

class Logger {
  private isDev = process.env.NODE_ENV !== "production";

  private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
    };
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry(level, message, context);

    if (this.isDev) {
      // Pretty print in development
      const prefix = {
        debug: "\x1b[36m[DEBUG]\x1b[0m",
        info: "\x1b[32m[INFO]\x1b[0m",
        warn: "\x1b[33m[WARN]\x1b[0m",
        error: "\x1b[31m[ERROR]\x1b[0m",
      }[level];

      console.log(`${prefix} ${entry.timestamp} - ${message}`);
      if (context) {
        console.log("  Context:", JSON.stringify(context, null, 2));
      }
    } else {
      // JSON format in production
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDev) {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }
}

export const logger = new Logger();
export default logger;
