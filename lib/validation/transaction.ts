import { z } from "zod";

export const depositSchema = z.object({
  accountId: z.string().uuid("Invalid account ID format"),
  amount: z.string().regex(/^\d+\.\d{2}$/, "Amount must have exactly 2 decimal places"),
  channelId: z.string().uuid("Invalid channel ID format"),
  narration: z.string().optional(),
});

export const withdrawalSchema = z.object({
  accountId: z.string().uuid("Invalid account ID format"),
  amount: z.string().regex(/^\d+\.\d{2}$/, "Amount must have exactly 2 decimal places"),
  channelId: z.string().uuid("Invalid channel ID format"),
  onBehalfOfCustomerId: z.string().uuid("Invalid customer ID format").optional(),
  narration: z.string().optional(),
});

export const reversalSchema = z.object({
  reason: z.string().min(1, "A reversal reason is required."),
});
