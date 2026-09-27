import { query } from '@/lib/db';

export interface SystemParameter {
  param_id: string;
  param_key: string;
  param_value: string;
  description: string | null;
  data_type: string | null;
  updated_at: string | null;
}

/** Read a system parameter as a string. Throws if key does not exist. */
export async function getParameter(key: string): Promise<string> {
  const result = await query<{ param_value: string }>(
    `SELECT param_value FROM system_parameter WHERE param_key = $1`,
    [key]
  );
  if (result.rows.length === 0) throw new Error(`System parameter not found: ${key}`);
  return result.rows[0].param_value;
}

/** Read a system parameter as a number. */
export async function getParameterAsNumber(key: string): Promise<number> {
  const raw = await getParameter(key);
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`System parameter ${key} is not a valid number: ${raw}`);
  return n;
}

/** List all parameters (for the admin page). */
export async function listParameters(): Promise<SystemParameter[]> {
  const result = await query<SystemParameter>(
    `SELECT param_id, param_key, param_value, description, data_type, updated_at
     FROM system_parameter
     ORDER BY param_key ASC`
  );
  return result.rows;
}

/** Update a single parameter value. ADMIN only — enforced at route level. */
export async function updateParameter(paramKey: string, newValue: string): Promise<SystemParameter> {
  const result = await query<SystemParameter>(
    `UPDATE system_parameter
     SET param_value = $1, updated_at = now()
     WHERE param_key = $2
     RETURNING param_id, param_key, param_value, description, data_type, updated_at`,
    [newValue, paramKey]
  );
  if (result.rows.length === 0) throw new Error(`Parameter not found: ${paramKey}`);
  return result.rows[0];
}
