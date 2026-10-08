import { z } from "zod";
import { agentActivityRangeSchema, colomboToday } from "./agent-activity";

/** Who may run RPT-02: bank-wide roles, and a branch manager for their own branch. */
export const RPT02_ROLES = ["ADMIN", "CENTRAL_OPS", "AUDITOR", "BRANCH_MANAGER"] as const;
export const RPT02_STATUSES = ["ACTIVE", "FROZEN", "CLOSED"] as const;
/** Request sort keys; the service maps them to fixed SQL expressions (never request text). */
export const RPT02_SORTS = ["accountNumber", "openingBalance", "closingBalance", "netMovement"] as const;
/** The most rows one CSV export may carry (one row per account); larger scopes must be narrowed. */
export const RPT02_CSV_MAX_ROWS = 50000;

const uuid = z.string().uuid().transform(value => value.toLowerCase());

export const rpt02QuerySchema = z.object({
  from: z.string(), to: z.string(),
  branchId: uuid.optional(), accountId: uuid.optional(), planId: uuid.optional(),
  status: z.enum(RPT02_STATUSES).optional(),
  format: z.enum(["json", "csv"]).default("json"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(RPT02_SORTS).default("accountNumber"),
  direction: z.enum(["asc", "desc"]).default("asc"),
}).strict().superRefine((value, ctx) => {
  const range = agentActivityRangeSchema.safeParse({ from: value.from, to: value.to });
  if (!range.success) for (const issue of range.error.issues) ctx.addIssue(issue);
});
export type Rpt02Query = z.infer<typeof rpt02QuerySchema>;

/** Rejects repeated or unknown parameters; one supplied date selects one Colombo day. */
export function parseRpt02Query(params: URLSearchParams): Rpt02Query {
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    // An empty parameter (an untouched form field) means "not supplied".
    if (key in values) throw new z.ZodError([{ code: "custom", path: [key], message: "Repeated query parameter." }]);
    if (value !== "") values[key] = value;
  }
  const today = colomboToday();
  return rpt02QuerySchema.parse({ ...values, from: values.from ?? values.to ?? today, to: values.to ?? values.from ?? today });
}
