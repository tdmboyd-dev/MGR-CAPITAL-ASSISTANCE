// ============================================
// MESSAGES API ROUTES — MGR CAPITAL ASSISTANCE
// Client portal messaging endpoints
// ============================================

import { Router, Response } from "express";
import { PrismaClient, CommunicationType, CommunicationDirection } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware.js";
import { roleGuard } from "../middleware/roleGuard.js";
import { asyncHandler, Errors } from "../middleware/errorHandler.js";

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authMiddleware);

// ============================================
// CLIENT PORTAL MESSAGING
// ============================================

/**
 * GET /api/messages/my-messages
 * Get all messages for the authenticated client
 * Used by client portal
 */
router.get("/my-messages", roleGuard(["CLIENT"]), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get all messages from cases where the user is the client
    const messages = await prisma.communication.findMany({
      where: {
        case: {
          clientId: userId
        },
        type: { in: ["EMAIL", "PORTAL_MESSAGE"] }
      },
      select: {
        id: true,
        subject: true,
        content: true,
        type: true,
        direction: true,
        toAddress: true,
        fromAddress: true,
        createdAt: true,
        caseId: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        case: {
          select: {
            id: true,
            caseCode: true,
            propertyAddress: true,
            county: true,
            state: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    // Transform to client-friendly format
    const clientMessages = messages.map(msg => ({
      id: msg.id,
      subject: msg.subject || "Message",
      body: msg.content,
      category: msg.type === "PORTAL_MESSAGE" ? "general" : "case_update",
      isRead: true, // We don't track read status on Communications, but we should
      createdAt: msg.createdAt,
      fromName: msg.direction === "INBOUND" ? "You" : "MGR Capital Assistance",
      fromType: msg.direction === "INBOUND" ? "client" : "company",
      caseId: msg.caseId,
      case: msg.case ? {
        propertyAddress: msg.case.propertyAddress,
        county: msg.case.county,
        state: msg.case.state
      } : null
    }));

    res.json({
      success: true,
      count: messages.length,
      data: clientMessages
    });
  } catch (error: any) {
    console.error("Client messages error:", error);
    res.status(500).json({ success: false, error: "Failed to load your messages" });
  }
});

/**
 * POST /api/messages
 * Send a new message (from client)
 * Used by client portal compose feature
 */
router.post("/", roleGuard(["CLIENT"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { subject, body, caseId } = req.body;

  if (!subject || !body) {
    throw Errors.badRequest("Subject and message body are required");
  }

  // Verify the case belongs to this client if caseId is provided
  let validCaseId = caseId;
  if (caseId) {
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        clientId: userId
      }
    });

    if (!caseData) {
      throw Errors.forbidden("You don't have access to this case");
    }
  } else {
    // If no case specified, use the first case
    const firstCase = await prisma.case.findFirst({
      where: { clientId: userId },
      select: { id: true }
    });
    if (firstCase) {
      validCaseId = firstCase.id;
    }
  }

  if (!validCaseId) {
    throw Errors.badRequest("No cases found for your account");
  }

  // Create the message
  const message = await prisma.communication.create({
    data: {
      caseId: validCaseId,
      userId: userId,
      type: "PORTAL_MESSAGE",
      direction: "INBOUND",
      subject: subject,
      content: body
    },
    select: {
      id: true,
      subject: true,
      content: true,
      createdAt: true,
      caseId: true
    }
  });

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: {
      id: message.id,
      subject: message.subject,
      body: message.content,
      createdAt: message.createdAt
    }
  });
}));

/**
 * POST /api/messages/:id/read
 * Mark a message as read
 */
router.post("/:id/read", roleGuard(["CLIENT"]), asyncHandler(async (req: AuthRequest, res: Response) => {
  // We don't have a read tracking field on Communication, so this is a no-op for now
  // In a real implementation, you'd add a 'readAt' or 'isRead' field to the Communication model
  res.json({
    success: true,
    message: "Message marked as read"
  });
}));

/**
 * GET /api/messages
 * Get all messages (for employees/admins)
 */
router.get("/", roleGuard(["ADMIN", "EMPLOYEE"]), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { caseId, type, direction } = req.query;

    const where: any = {};

    // Employees only see messages from their assigned cases
    if (user.role === "EMPLOYEE") {
      where.case = { assignedEmployeeId: user.id };
    }

    if (caseId) {
      where.caseId = caseId;
    }

    if (type) {
      where.type = type;
    }

    if (direction) {
      where.direction = direction;
    }

    const messages = await prisma.communication.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        case: {
          select: { id: true, caseCode: true, clientId: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error: any) {
    console.error("Messages error:", error);
    res.status(500).json({ success: false, error: "Failed to load messages" });
  }
});

export default router;
