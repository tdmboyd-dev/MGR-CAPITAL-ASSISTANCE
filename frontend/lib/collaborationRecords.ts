import { z } from 'zod';

export const collaboratorSchema = z.object({ id: z.string().min(1), name: z.string().max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
export const cursorPresenceSchema = z.object({
  user: z.object({ name: z.string().max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  cursor: z.object({ position: z.number().int().nonnegative(), selectionStart: z.number().int().nonnegative(), selectionEnd: z.number().int().nonnegative() }),
});
