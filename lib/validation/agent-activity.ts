import { z } from "zod";

export const AGENT_ACTIVITY_ROLES = ["ADMIN", "CENTRAL_OPS", "BRANCH_MANAGER", "AGENT"] as const;

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  if (value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a real calendar date in YYYY-MM-DD format.");

export const agentActivityRangeSchema = z.object({ from: calendarDate, to: calendarDate }).strict()
  .refine(value => value.from <= value.to, { path: ["to"], message: "End date must follow start date." });

/** Returns the business calendar date without depending on the browser/server local timezone. */
export function colomboToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Rejects ambiguous query inputs; one supplied date selects a single business day. */
export function parseAgentActivityRange(params: URLSearchParams) {
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    if (!["from", "to"].includes(key) || key in values) {
      throw new z.ZodError([{ code: "custom", path: [key], message: "Unknown or repeated query parameter." }]);
    }
    values[key] = value;
  }
  const today = colomboToday();
  return agentActivityRangeSchema.parse({ from: values.from ?? values.to ?? today, to: values.to ?? values.from ?? today });
}
