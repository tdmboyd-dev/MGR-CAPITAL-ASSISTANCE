// ============================================
// AUTH ROUTES — MGR CAPITAL ASSISTANCE
// Production-ready authentication endpoints
// ============================================

import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { config } from "../config/env.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================
// LOGIN
// ============================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password required"
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        name: true,
        isActive: true,
        emailVerified: true,
        employeeTier: true
      }
    });

    // User not found
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }

    // Account disabled
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: "Account is disabled. Contact administrator."
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Create session token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tier: user.employeeTier
      },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    // Create session record
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entityType: "USER",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      }
    });

    // Return user data (without sensitive fields)
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tier: user.employeeTier
      }
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed"
    });
  }
});

// ============================================
// VERIFY TOKEN / GET CURRENT USER
// ============================================

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "No token provided"
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token"
      });
    }

    // Check session exists and is valid
    const session = await prisma.userSession.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() }
      }
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        error: "Session expired or invalid"
      });
    }

    // Get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        isActive: true,
        employeeTier: true,
        trainingCompleted: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: "User not found or inactive"
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        tier: user.employeeTier,
        trainingCompleted: user.trainingCompleted
      }
    });
  } catch (error: any) {
    console.error("Auth check error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication check failed"
    });
  }
});

// ============================================
// LOGOUT
// ============================================

router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      // Delete session
      await prisma.userSession.deleteMany({
        where: { token }
      });
    }

    res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      error: "Logout failed"
    });
  }
});

// ============================================
// CHANGE PASSWORD
// ============================================

router.post("/change-password", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });
    }

    const token = authHeader.substring(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid token"
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password and new password required"
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 8 characters"
      });
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, passwordHash: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Verify current password
    const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentValid) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect"
      });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    // Invalidate all sessions except current
    await prisma.userSession.deleteMany({
      where: {
        userId: user.id,
        token: { not: token }
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_CHANGE",
        entityType: "USER",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      }
    });

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error: any) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      error: "Password change failed"
    });
  }
});

export default router;
