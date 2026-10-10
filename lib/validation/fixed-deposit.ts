import { z } from 'zod';
export const fdOpeningSchema = z.object({
  accountId:z.string().uuid(), fdPlanId:z.string().uuid(),
  principalAmount:z.string().regex(/^\d{1,13}\.\d{2}$/),
}).strict();
export const fdKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);
export const fdListSchema = z.object({
  accountId:z.string().uuid().optional(), status:z.enum(['ACTIVE','MATURED','CLOSED']).optional(),
  page:z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize:z.coerce.number().int().min(1).max(100).default(25),
}).strict();
