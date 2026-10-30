"use client";
import { api } from '@/lib/api';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth,useAuthStore } from './useAuth';
const notification=z.object({id:z.string(),category:z.string(),title:z.string(),message:z.string(),priority:z.enum(['low','normal','high','urgent']),isRead:z.boolean(),createdAt:z.string(),link:z.string().optional()});
export type NotificationRecord = z.infer<typeof notification>;
const response=z.object({notifications:z.array(notification),unreadCount:z.number().int().nonnegative()});
/** Query ownership and cancellation follow the current account; no effect copies remote data into local state. */
export function useNotifications(){
 const {user,accessToken}=useAuth();const userId=user?.id;const cache=useQueryClient();const key=['notification-center-badge',userId];
 const query=useQuery({queryKey:key,enabled:Boolean(userId&&accessToken),refetchInterval:15000,retry:1,queryFn:async({signal})=>{const{data}=await api.get('/notifications',{params:{limit:20},signal});return response.parse(data);}});
 const mutation=useMutation({mutationFn:async(id:string|null)=>{if(!userId||useAuthStore.getState().user?.id!==userId)throw Error('Account changed');if(id===null)await api.patch('/notifications/mark-read',{});else await api.patch(`/notifications/${encodeURIComponent(id)}/read`);await cache.invalidateQueries({queryKey:key});}});
 const change=async(id:string|null)=>{try{await mutation.mutateAsync(id);return true;}catch{return false;}};
 return {isLoading:query.isLoading,isPending:mutation.isPending,unreadCount:userId?query.data?.unreadCount||0:0,notifications:userId?query.data?.notifications||[]:[],isConnected:query.isSuccess&&!query.isError,error:mutation.isError?'Could not save notification read state':query.isError?'Notifications unavailable':null,markAsRead:(id:string)=>change(id),markAllAsRead:()=>change(null)};
}
export default useNotifications;
