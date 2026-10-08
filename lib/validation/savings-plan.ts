import { z } from "zod";

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

// interest_rate domain: numeric(6,4), a fraction (10% = 0.1000). Kept as a string
// end to end — never parsed to a float for storage, only Number() for range checks.
const interestRateSchema = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, "Interest rate must be a decimal with up to 4 places.")
  .refine(
    (value) => Number(value) > 0 && Number(value) <= 1,
    "Interest rate must be a fraction between 0 (exclusive) and 1 (inclusive), e.g. 0.1300.",
  );

// min_balance domain: numeric(15,2), non-negative (chk_savings_plan_min_balance_nonneg).
const minBalanceSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Minimum balance must be a non-negative decimal with up to 2 places.")
  .refine((value) => Number(value) >= 0, "Minimum balance cannot be negative.");

const ageYearsSchema = z.number().int().min(0).max(120).nullable();
const holdersSchema = z.number().int().min(1).max(20);

export const savingsPlanIdSchema = z.string().uuid();

export const updateSavingsPlanSchema = z
  .object({
    interestRate: interestRateSchema.optional(),
    minBalance: minBalanceSchema.optional(),
    description: z.string().trim().max(255).nullable().optional(),
    status: statusSchema.optional(),
    minAgeYears: ageYearsSchema.optional(),
    maxAgeYears: ageYearsSchema.optional(),
    minHolders: holdersSchema.optional(),
    maxHolders: holdersSchema.optional(),
    requiresAllAdult: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.")
  .refine(
    (value) =>
      value.minAgeYears == null ||
      value.maxAgeYears == null ||
      value.maxAgeYears >= value.minAgeYears,
    { message: "maxAgeYears must be greater than or equal to minAgeYears.", path: ["maxAgeYears"] },
  )
  .refine(
    (value) =>
      value.minHolders == null ||
      value.maxHolders == null ||
      value.maxHolders >= value.minHolders,
    { message: "maxHolders must be greater than or equal to minHolders.", path: ["maxHolders"] },
  );

export type UpdateSavingsPlanInput = z.infer<typeof updateSavingsPlanSchema>;
export type SavingsPlanStatus = z.infer<typeof statusSchema>;
