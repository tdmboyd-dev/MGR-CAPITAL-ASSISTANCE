import { z } from 'zod';

export const chatRoomSchema = z.object({
 id:z.string().min(1),name:z.string(),type:z.enum(['COMPANY','TEAM','PRIVATE']),locked:z.boolean(),
 updatedAt:z.string().optional(), participantCount:z.number().int().nonnegative().optional(),
 _count:z.object({members:z.number().int().nonnegative()}).optional(),
 lastMessage:z.object({content:z.string(),createdAt:z.string()}).nullable().optional(),
});
export const chatRoomsSchema=z.object({success:z.literal(true),data:z.array(chatRoomSchema)});
export const chatMessageSchema=z.object({id:z.string(),userId:z.string(),content:z.string(),createdAt:z.string(),user:z.object({name:z.string().nullable(),email:z.string()}).nullable().optional()});
export const chatMessagesSchema=z.object({success:z.literal(true),data:z.array(chatMessageSchema)});
