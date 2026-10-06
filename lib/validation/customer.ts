import { z } from "zod";

const text = (length: number) => z.string().trim().min(1).max(length);
const uuid = z.string().uuid();
const identity = text(50).transform(value => value.toUpperCase()).refine(
  value => /^[A-Z0-9]{5,50}$/.test(value), "Identity must be a 5–50 character alphanumeric NIC/passport reference.",
);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date must be a valid YYYY-MM-DD calendar date.");

export const registerCustomerSchema = z.object({
  fullName: text(150), nicPassportNo: identity, dateOfBirth: calendarDate,
  gender: text(20).nullish(), phone: text(20).nullish(), address: text(255).nullish(),
  email: z.string().trim().email().max(150).transform(value => value.toLowerCase()),
  branchId: uuid, agentId: uuid,
  documents: z.array(z.object({ docType: text(50), filePath: text(500) }).strict()).max(20),
}).strict();

export const customerSearchSchema = z.object({
  q: text(150).optional(), name: text(150).optional(), nicPassportNo: identity.optional(),
  branchId: uuid.optional(), agentId: uuid.optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  sortBy: z.enum(["fullName", "customerNumber", "createdAt"]).default("fullName"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
}).strict();

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
