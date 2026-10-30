import { isAxiosError } from 'axios';
import { z } from 'zod';
const responseSchema=z.object({error:z.string().max(2000).optional(),message:z.string().max(2000).optional()});
export interface ApiFailure { message:string; response?:{status?:number;data?:{error?:string;message?:string}} }
/** Normalize untrusted transport errors before UI code reads their properties. */
export function apiFailure(value:unknown):ApiFailure {
 const fallback=value instanceof Error?value.message:'The operation failed.';
 if(!isAxiosError(value))return {message:fallback};
 const parsed=responseSchema.safeParse(value.response?.data);
 return {message:parsed.success?(parsed.data.error||parsed.data.message||fallback):fallback,response:value.response?{status:value.response.status,data:parsed.success?parsed.data:undefined}:undefined};
}
