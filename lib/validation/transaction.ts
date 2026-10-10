import { z } from "zod";

const amount = z.string().regex(/^\d{1,13}\.\d{2}$/, "Enter an amount with exactly two decimal places.")
  .refine(value => /[1-9]/.test(value), "Amount must be positive.");

export const depositSchema = z.object({
  accountId: z.string().uuid("Invalid account ID format"),
  amount,
  channelId: z.string().uuid("Invalid channel ID format"),
  narration: z.string().max(255).optional(),
}).strict();

export const withdrawalSchema = z.object({
  accountId: z.string().uuid("Invalid account ID format"),
  amount,
  channelId: z.string().uuid("Invalid channel ID format"),
  onBehalfOfCustomerId: z.string().uuid("Invalid customer ID format").optional(),
  signerCustomerIds: z.array(z.string().uuid()).min(1).max(4).optional(),
  narration: z.string().max(255).optional(),
}).strict().refine(value => !(value.onBehalfOfCustomerId && value.signerCustomerIds), {
  message: "Provide one signer representation.",
});

export const reversalSchema = z.object({
  reason: z.string().trim().min(1, "A reversal reason is required.").max(255),
}).strict();

export const transferSchema = z.object({
  sourceAccountId: z.string().uuid(), destinationAccountId: z.string().uuid(), amount,
  signerCustomerIds: z.array(z.string().uuid()).min(1).max(4), narration:z.string().max(255).optional(),
}).strict().refine(value=>value.sourceAccountId!==value.destinationAccountId, {message:'Choose different accounts.'});
