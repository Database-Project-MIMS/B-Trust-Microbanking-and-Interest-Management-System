import { z } from "zod";
import { agentActivityRangeSchema, colomboToday } from "./agent-activity";

export const RPT01_ROLES = ["ADMIN", "CENTRAL_OPS", "AUDITOR", "BRANCH_MANAGER"] as const;
export const rpt01QuerySchema = z.object({
  from: z.string(), to: z.string(),
  branchId: z.string().uuid().transform(value => value.toLowerCase()).optional(),
  agentId: z.string().uuid().transform(value => value.toLowerCase()).optional(),
  format: z.enum(["json", "csv"]).default("json"),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["employeeNo", "agentName", "netTotal"]).default("employeeNo"),
  direction: z.enum(["asc", "desc"]).default("asc"),
}).strict().superRefine((value, ctx) => {
  const range = agentActivityRangeSchema.safeParse({ from: value.from, to: value.to });
  if (!range.success) for (const issue of range.error.issues) ctx.addIssue(issue);
});
export type Rpt01Query = z.infer<typeof rpt01QuerySchema>;

/** Rejects repeated/unknown fields; one supplied date selects one Colombo day. */
export function parseRpt01Query(params: URLSearchParams): Rpt01Query {
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in values) throw new z.ZodError([{ code: "custom", path: [key], message: "Repeated query parameter." }]);
    values[key] = value;
  }
  const today = colomboToday();
  return rpt01QuerySchema.parse({ ...values, from: values.from ?? values.to ?? today,
    to: values.to ?? values.from ?? today });
}
