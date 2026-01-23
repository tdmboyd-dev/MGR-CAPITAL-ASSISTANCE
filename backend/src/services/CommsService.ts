import { PrismaClient, ChatRoomType, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export interface CreateRoomInput {
  name: string;
  type: ChatRoomType;
  description?: string;
  locked?: boolean;
  password?: string;
  teamLeaderId?: string;
}

export interface SendMessageInput {
  roomId: string;
  userId: string;
  content: string;
  isEncrypted?: boolean;
}

export class CommsService {
  /**
   * Get all rooms accessible to a user
   */
  async getRooms(userId: string, userRole: UserRole) {
    // Founder can see all rooms
    if (userRole === "FOUNDER") {
      return prisma.chatRoom.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }

    // Employees can see company + team rooms (not private unless they created it)
    return prisma.chatRoom.findMany({
      where: {
        isActive: true,
        OR: [
          { type: "COMPANY" },
          { type: "TEAM" },
          { type: "PRIVATE", teamLeaderId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get a specific room
   */
  async getRoom(roomId: string) {
    return prisma.chatRoom.findUnique({
      where: { id: roomId },
    });
  }

  /**
   * Create a new chat room
   */
  async createRoom(input: CreateRoomInput, creatorId: string) {
    let hashedPassword: string | undefined;

    if (input.locked && input.password) {
      hashedPassword = await bcrypt.hash(input.password, 10);
    }

    return prisma.chatRoom.create({
      data: {
        name: input.name,
        type: input.type,
        description: input.description,
        locked: input.locked || false,
        password: hashedPassword,
        teamLeaderId: input.teamLeaderId || creatorId,
      },
    });
  }

  /**
   * Update a room
   */
  async updateRoom(
    roomId: string,
    updates: Partial<CreateRoomInput>,
    userId: string,
    userRole: UserRole
  ) {
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    // Only founder or room owner can update
    if (userRole !== "FOUNDER" && room.teamLeaderId !== userId) {
      throw new Error("Not authorized to update this room");
    }

    let hashedPassword: string | undefined;
    if (updates.locked && updates.password) {
      hashedPassword = await bcrypt.hash(updates.password, 10);
    }

    return prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        name: updates.name,
        type: updates.type,
        description: updates.description,
        locked: updates.locked,
        password: hashedPassword,
      },
    });
  }

  /**
   * Delete (deactivate) a room
   */
  async deleteRoom(roomId: string, userId: string, userRole: UserRole) {
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    // Only founder or room owner can delete
    if (userRole !== "FOUNDER" && room.teamLeaderId !== userId) {
      throw new Error("Not authorized to delete this room");
    }

    return prisma.chatRoom.update({
      where: { id: roomId },
      data: { isActive: false },
    });
  }

  /**
   * Check if user can access a room
   */
  async canAccessRoom(
    roomId: string,
    userId: string,
    userRole: UserRole,
    password?: string
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room || !room.isActive) {
      return false;
    }

    // Founder can access any room
    if (userRole === "FOUNDER") {
      return true;
    }

    // Company rooms are open to all
    if (room.type === "COMPANY") {
      return true;
    }

    // Team rooms are open to all employees
    if (room.type === "TEAM") {
      return true;
    }

    // Private rooms require ownership or password
    if (room.type === "PRIVATE") {
      if (room.teamLeaderId === userId) {
        return true;
      }

      if (room.locked && room.password && password) {
        return bcrypt.compare(password, room.password);
      }

      return false;
    }

    return false;
  }

  /**
   * Get messages for a room
   */
  async getMessages(
    roomId: string,
    userId: string,
    userRole: UserRole,
    limit = 50,
    before?: Date
  ) {
    // Check access
    const canAccess = await this.canAccessRoom(roomId, userId, userRole);
    if (!canAccess) {
      throw new Error("Not authorized to view this room");
    }

    const where: any = {
      roomId,
      isDeleted: false,
    };

    if (before) {
      where.createdAt = { lt: before };
    }

    return prisma.chatMessage.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  /**
   * Send a message
   */
  async sendMessage(input: SendMessageInput) {
    return prisma.chatMessage.create({
      data: {
        roomId: input.roomId,
        userId: input.userId,
        content: input.content,
        isEncrypted: input.isEncrypted || false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: string,
    userId: string,
    userRole: UserRole,
    newContent: string
  ) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    // Only message author or founder can edit
    if (message.userId !== userId && userRole !== "FOUNDER") {
      throw new Error("Not authorized to edit this message");
    }

    return prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content: newContent,
        isEdited: true,
        editedAt: new Date(),
      },
    });
  }

  /**
   * Delete (soft) a message
   */
  async deleteMessage(messageId: string, userId: string, userRole: UserRole) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    // Only message author or founder can delete
    if (message.userId !== userId && userRole !== "FOUNDER") {
      throw new Error("Not authorized to delete this message");
    }

    return prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get unread message count for a user (placeholder for future notification system)
   */
  async getUnreadCount(userId: string, roomId?: string) {
    // This is a placeholder - in a full implementation you'd track
    // last-read timestamps per user per room
    return 0;
  }

  /**
   * Seed default rooms
   */
  async seedDefaultRooms() {
    const existingRooms = await prisma.chatRoom.count();
    if (existingRooms > 0) {
      return;
    }

    await prisma.chatRoom.createMany({
      data: [
        {
          name: "General",
          type: "COMPANY",
          description: "Company-wide announcements and discussions",
        },
        {
          name: "Team Chat",
          type: "TEAM",
          description: "Team collaboration and updates",
        },
        {
          name: "Random",
          type: "COMPANY",
          description: "Off-topic conversations",
        },
      ],
    });

    console.log("Default chat rooms seeded");
  }
}

export const commsService = new CommsService();
