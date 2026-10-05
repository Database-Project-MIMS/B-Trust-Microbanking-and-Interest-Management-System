import { z } from "zod";

const recordStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

const requiredText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "Date must be a valid calendar date in YYYY-MM-DD format.");

const nonFutureDateSchema = isoDateSchema.refine(
  (value) => value <= new Date().toISOString().slice(0, 10),
  "Date cannot be in the future.",
);

export const organizationListQuerySchema = z.object({
  status: recordStatusSchema.optional(),
});

export const organizationIdSchema = z.string().uuid();

export const createBranchSchema = z
  .object({
    branchCode: requiredText(20),
    branchName: requiredText(100),
    address: requiredText(255),
    district: requiredText(100),
    phone: requiredText(20),
  })
  .strict();

export const updateBranchSchema = z
  .object({
    branchName: requiredText(100).optional(),
    address: requiredText(255).optional(),
    district: requiredText(100).optional(),
    phone: requiredText(20).optional(),
    status: recordStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

const agentProfileSchema = z.object({
  branchId: z.string().uuid().optional(),
  employeeNo: requiredText(30),
  nicPassportNo: requiredText(50),
  fullName: requiredText(150),
  dateOfBirth: nonFutureDateSchema,
  gender: requiredText(20),
  phone: requiredText(20),
  address: requiredText(255),
  email: z.string().trim().email().max(150),
  hiredDate: nonFutureDateSchema,
});

export const createAgentSchema = agentProfileSchema
  .extend({
    username: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[A-Za-z0-9._-]+$/, "Username contains unsupported characters."),
    password: z.string().min(12).max(128),
  })
  .strict();

export const updateAgentSchema = agentProfileSchema
  .partial()
  .extend({ status: recordStatusSchema.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type RecordStatus = z.infer<typeof recordStatusSchema>;
