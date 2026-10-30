import { ChatRoomType, UserRole, Prisma, type ChatRoom } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { currentActor, type Actor } from "./CaseDocumentAccess.js";
import { AppError } from "../middleware/errorHandler.js";

export function safeRoom(room:ChatRoom){const {password,...publicRoom}=room;void password;return publicRoom;}
const denied=()=>new AppError('Not authorized',403,'Not authorized to access this communication.');
const scope=(actor:Actor):Prisma.ChatRoomWhereInput=>actor.role==='FOUNDER'&&actor.tenantId===null?{}:{tenantId:actor.tenantId};
async function staff(id:string){const actor=await currentActor(prisma,id);if(actor.role==='CLIENT')throw denied();return actor;}
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
  private lastReadCache:Map<string,Date>=new Map();
  private async visibleRoom(roomId:string,userId:string){
    const actor=await staff(userId);
    const room=await prisma.chatRoom.findFirst({where:{AND:[{id:roomId,isActive:true},scope(actor)]}});
    if(!room)throw denied();return {actor,room};
  }
  async getRooms(userId:string,_userRole:UserRole){
    const actor=await staff(userId);
    const self=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{teamLeaderId:true}});
    const managers=['FOUNDER','ADMIN'].includes(actor.role);
    const visibility:Prisma.ChatRoomWhereInput=managers?{}:{OR:[{type:'COMPANY'},{type:'TEAM',teamLeaderId:{in:[userId,...(self.teamLeaderId?[self.teamLeaderId]:[])]}},{type:'PRIVATE',teamLeaderId:userId}]};
    const rows=await prisma.chatRoom.findMany({where:{AND:[{isActive:true},scope(actor),visibility]},orderBy:{createdAt:'asc'}});
    return rows.map(safeRoom);
  }
  async getRoom(roomId:string){const room=await prisma.chatRoom.findUnique({where:{id:roomId}});return room?safeRoom(room):null;}
  async createRoom(input:CreateRoomInput,creatorId:string){
    const actor=await staff(creatorId);if(!['FOUNDER','ADMIN'].includes(actor.role))throw denied();
    if(input.teamLeaderId&&input.teamLeaderId!==creatorId)throw new AppError('Invalid owner',400,'Room owner must be the creating account.');
    if(input.locked&&(!input.password||input.password.length<8))throw new AppError('Password required',400,'Protected rooms require at least eight password characters.');
    const room=await prisma.$transaction(async tx=>{
      const room=await tx.chatRoom.create({data:{name:input.name,type:input.type,description:input.description,tenantId:actor.tenantId,locked:Boolean(input.locked),password:input.locked?await bcrypt.hash(input.password!,10):null,teamLeaderId:creatorId}});
      await tx.auditLog.create({data:{userId:creatorId,tenantId:actor.tenantId,action:'CHAT_ROOM_CREATED',entityType:'CHAT_ROOM',entityId:room.id}});return room;
    });return safeRoom(room);
  }
  async updateRoom(roomId:string,updates:Partial<CreateRoomInput>,userId:string,_userRole:UserRole){
    const {actor,room}=await this.visibleRoom(roomId,userId);
    if(actor.role!=='FOUNDER'&&room.teamLeaderId!==userId)throw denied();
    const locked=updates.locked??room.locked;
    if(locked&&!updates.password&&!room.password)throw new AppError('Password required',400,'Protected rooms require a password.');
    if(updates.password&&updates.password.length<8)throw new AppError('Invalid password',400,'Use at least eight password characters.');
    const saved=await prisma.$transaction(async tx=>{
      const saved=await tx.chatRoom.update({where:{id:roomId},data:{name:updates.name,type:updates.type,description:updates.description,locked,password:!locked?null:updates.password?await bcrypt.hash(updates.password,10):undefined}});
      await tx.auditLog.create({data:{userId,tenantId:room.tenantId,action:'CHAT_ROOM_UPDATED',entityType:'CHAT_ROOM',entityId:roomId}});return saved;
    });return safeRoom(saved);
  }
  async deleteRoom(roomId:string,userId:string,_userRole:UserRole){
    const {actor,room}=await this.visibleRoom(roomId,userId);if(actor.role!=='FOUNDER'&&room.teamLeaderId!==userId)throw denied();
    const saved=await prisma.$transaction(async tx=>{
      const saved=await tx.chatRoom.update({where:{id:roomId},data:{isActive:false}});
      await tx.auditLog.create({data:{userId,tenantId:room.tenantId,action:'CHAT_ROOM_DEACTIVATED',entityType:'CHAT_ROOM',entityId:roomId}});return saved;
    });return safeRoom(saved);
  }
  async canAccessRoom(roomId:string,userId:string,_userRole:UserRole,password?:string):Promise<boolean>{
    let resolved:Awaited<ReturnType<CommsService['visibleRoom']>>;
    try{resolved=await this.visibleRoom(roomId,userId);}catch(error){if(error instanceof AppError&&error.statusCode===403)return false;throw error;}
    const {actor,room}=resolved;
    if(actor.role==='FOUNDER'||room.teamLeaderId===userId)return true;
    if(room.type==='TEAM'){
      const self=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{teamLeaderId:true}});
      if(!room.teamLeaderId||self.teamLeaderId!==room.teamLeaderId)return false;
    }
    if(room.locked)return Boolean(room.password&&password&&await bcrypt.compare(password,room.password));
    return room.type!=='PRIVATE';
  }
  async getMessages(roomId:string,userId:string,userRole:UserRole,limit=50,before?:Date){
    if(!Number.isInteger(limit)||limit<1||limit>100||before&&Number.isNaN(before.getTime()))throw new AppError('Invalid pagination',400,'Use a limit from 1 to 100 and a valid timestamp.');
    if(!await this.canAccessRoom(roomId,userId,userRole))throw denied();
    const rows=await prisma.chatMessage.findMany({where:{roomId,isDeleted:false,...(before?{createdAt:{lt:before}}:{})},include:{user:{select:{id:true,name:true,email:true,role:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:limit});
    return rows.reverse();
  }
  async sendMessage(input:SendMessageInput){
    const actor=await staff(input.userId);if(!await this.canAccessRoom(input.roomId,input.userId,actor.role))throw denied();
    if(input.isEncrypted)throw new AppError('Encryption unavailable',400,'End-to-end encrypted messaging is not implemented.');
    if(!input.content.trim()||input.content.length>5000)throw new AppError('Invalid message',400,'Message must contain 1 to 5000 characters.');
    return prisma.chatMessage.create({data:{roomId:input.roomId,userId:input.userId,content:input.content,isEncrypted:false},include:{user:{select:{id:true,name:true,email:true,role:true}}}});
  }
  async editMessage(messageId:string,userId:string,_userRole:UserRole,newContent:string){
    const actor=await staff(userId);const message=await prisma.chatMessage.findUnique({where:{id:messageId}});
    if(!message||message.isDeleted||!await this.canAccessRoom(message.roomId,userId,actor.role)||message.userId!==userId&&actor.role!=='FOUNDER')throw denied();
    if(!newContent.trim()||newContent.length>5000)throw new AppError('Invalid message',400,'Message must contain 1 to 5000 characters.');
    return prisma.chatMessage.update({where:{id:messageId},data:{content:newContent,isEdited:true,editedAt:new Date()}});
  }
  async deleteMessage(messageId:string,userId:string,_userRole:UserRole){
    const actor=await staff(userId);const message=await prisma.chatMessage.findUnique({where:{id:messageId}});
    if(!message||!await this.canAccessRoom(message.roomId,userId,actor.role)||message.userId!==userId&&actor.role!=='FOUNDER')throw denied();
    return prisma.chatMessage.update({where:{id:messageId},data:{isDeleted:true,deletedAt:new Date()}});
  }
  // Read cursors remain process-local; durable per-user read receipts are unfinished.
  async getUnreadCount(userId:string,roomId?:string):Promise<number>{
    const actor=await staff(userId);const rooms=roomId?[{id:roomId}]:await this.getRooms(userId,actor.role);let total=0;
    for(const room of rooms){if(!await this.canAccessRoom(room.id,userId,actor.role)){if(roomId)throw denied();continue;}
      total+=await prisma.chatMessage.count({where:{roomId:room.id,userId:{not:userId},isDeleted:false,createdAt:{gt:this.lastReadCache.get(`${userId}:${room.id}`)||new Date(0)}}});
    }return total;
  }
  async markAsRead(userId:string,roomId:string):Promise<void>{const actor=await staff(userId);if(!await this.canAccessRoom(roomId,userId,actor.role))throw denied();this.lastReadCache.set(`${userId}:${roomId}`,new Date());}
  async seedDefaultRooms(creatorId:string){
    const actor=await staff(creatorId);if(actor.role!=='FOUNDER')throw denied();
    if(await prisma.chatRoom.count({where:{tenantId:actor.tenantId}}))return;
    for(const [name,type,description] of [['General','COMPANY','Company announcements and discussions'],['Team Chat','TEAM','Team collaboration'],['Random','COMPANY','Off-topic conversations']] as const)await this.createRoom({name,type,description},creatorId);
  }
}
export const commsService=new CommsService();
