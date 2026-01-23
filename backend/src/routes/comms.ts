import { Router, Request, Response } from "express";
import { z } from "zod";
import { commsService } from "../services/CommsService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { ChatRoomType } from "@prisma/client";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["COMPANY", "TEAM", "PRIVATE"]).default("TEAM"),
  description: z.string().max(500).optional(),
  locked: z.boolean().optional(),
  password: z.string().min(4).optional(),
});

const sendMessageSchema = z.object({
  roomId: z.string(),
  content: z.string().min(1).max(5000),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

/**
 * GET /comms/rooms
 * Get all rooms accessible to the user
 */
router.get("/rooms", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const rooms = await commsService.getRooms(user.id, user.role);

    res.json({
      success: true,
      data: rooms,
    });
  } catch (error: any) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch rooms",
    });
  }
});

/**
 * GET /comms/rooms/:id
 * Get a specific room
 */
router.get("/rooms/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const canAccess = await commsService.canAccessRoom(id, user.id, user.role);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this room",
      });
    }

    const room = await commsService.getRoom(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error: any) {
    console.error("Error fetching room:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch room",
    });
  }
});

/**
 * POST /comms/rooms
 * Create a new room (Founder/Admin only)
 */
router.post("/rooms", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Only founder and admin can create rooms
    if (!["FOUNDER", "ADMIN"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: "Only founders and admins can create rooms",
      });
    }

    const validation = createRoomSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: validation.error.errors,
      });
    }

    const room = await commsService.createRoom(
      {
        ...validation.data,
        type: validation.data.type as ChatRoomType,
      },
      user.id
    );

    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error: any) {
    console.error("Error creating room:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create room",
    });
  }
});

/**
 * PATCH /comms/rooms/:id
 * Update a room
 */
router.patch("/rooms/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const validation = createRoomSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: validation.error.errors,
      });
    }

    const room = await commsService.updateRoom(
      id,
      {
        ...validation.data,
        type: validation.data.type as ChatRoomType | undefined,
      },
      user.id,
      user.role
    );

    res.json({
      success: true,
      data: room,
    });
  } catch (error: any) {
    console.error("Error updating room:", error);
    res.status(error.message.includes("Not authorized") ? 403 : 500).json({
      success: false,
      error: error.message || "Failed to update room",
    });
  }
});

/**
 * DELETE /comms/rooms/:id
 * Delete (deactivate) a room
 */
router.delete("/rooms/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    await commsService.deleteRoom(id, user.id, user.role);

    res.json({
      success: true,
      message: "Room deleted",
    });
  } catch (error: any) {
    console.error("Error deleting room:", error);
    res.status(error.message.includes("Not authorized") ? 403 : 500).json({
      success: false,
      error: error.message || "Failed to delete room",
    });
  }
});

/**
 * GET /comms/messages
 * Get messages for a room
 */
router.get("/messages", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { roomId, limit, before } = req.query;

    if (!roomId || typeof roomId !== "string") {
      return res.status(400).json({
        success: false,
        error: "roomId is required",
      });
    }

    const messages = await commsService.getMessages(
      roomId,
      user.id,
      user.role,
      limit ? parseInt(limit as string, 10) : 50,
      before ? new Date(before as string) : undefined
    );

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    res.status(error.message.includes("Not authorized") ? 403 : 500).json({
      success: false,
      error: error.message || "Failed to fetch messages",
    });
  }
});

/**
 * POST /comms/messages
 * Send a message
 */
router.post("/messages", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const validation = sendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: validation.error.errors,
      });
    }

    // Check room access
    const canAccess = await commsService.canAccessRoom(
      validation.data.roomId,
      user.id,
      user.role
    );
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to send messages in this room",
      });
    }

    const message = await commsService.sendMessage({
      roomId: validation.data.roomId,
      userId: user.id,
      content: validation.data.content,
    });

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send message",
    });
  }
});

/**
 * PATCH /comms/messages/:id
 * Edit a message
 */
router.patch("/messages/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const validation = editMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: validation.error.errors,
      });
    }

    const message = await commsService.editMessage(
      id,
      user.id,
      user.role,
      validation.data.content
    );

    res.json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    console.error("Error editing message:", error);
    res.status(error.message.includes("Not authorized") ? 403 : 500).json({
      success: false,
      error: error.message || "Failed to edit message",
    });
  }
});

/**
 * DELETE /comms/messages/:id
 * Delete a message
 */
router.delete("/messages/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    await commsService.deleteMessage(id, user.id, user.role);

    res.json({
      success: true,
      message: "Message deleted",
    });
  } catch (error: any) {
    console.error("Error deleting message:", error);
    res.status(error.message.includes("Not authorized") ? 403 : 500).json({
      success: false,
      error: error.message || "Failed to delete message",
    });
  }
});

/**
 * POST /comms/seed
 * Seed default rooms (Founder only)
 */
router.post("/seed", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (user.role !== "FOUNDER") {
      return res.status(403).json({
        success: false,
        error: "Only founders can seed rooms",
      });
    }

    await commsService.seedDefaultRooms();

    res.json({
      success: true,
      message: "Default rooms seeded",
    });
  } catch (error: any) {
    console.error("Error seeding rooms:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to seed rooms",
    });
  }
});

export default router;
