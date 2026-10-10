import { z } from "zod";

const uuid = z.string().uuid();
// Money crosses the API as a string; it is never parsed into a JavaScript number.
const money = z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, "Amount must be a positive decimal with at most two places.");

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);
export const accountIdSchema = uuid;

export const openAccountSchema = z.object({
  planId: uuid,
  branchId: uuid,
  holders: z.array(z.object({
    customerId: uuid,
    holderType: z.enum(["PRIMARY", "JOINT"]),
  }).strict()).min(1).max(4)
    .refine(holders => holders.filter(holder => holder.holderType === "PRIMARY").length === 1,
      "Exactly one holder must be PRIMARY."),
  mandate: z.object({
    type: z.enum(["ANY_ONE", "ALL_HOLDERS"]),
    requiredSignatories: z.number().int().min(1).max(4).optional(),
  }).strict().optional(),
  initialDeposit: money.optional(),
}).strict();

export const addHolderSchema = z.object({ customerId: uuid }).strict();

export const accountSearchSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["ACTIVE", "FROZEN", "CLOSED"]).optional(),
  planId: uuid.optional(),
  branchId: uuid.optional(),
  sortBy: z.enum(["accountNumber", "openedDate", "currentBalance", "status"]).default("accountNumber"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
}).strict();

export type OpenAccountInput = z.infer<typeof openAccountSchema>;
export type AddHolderInput = z.infer<typeof addHolderSchema>;
export type AccountSearchInput = z.infer<typeof accountSearchSchema>;
