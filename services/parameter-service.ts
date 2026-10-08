import { query, withTransaction, NotFoundError, ValidationError } from '@/lib/db';

export interface SystemParameter {
  param_id: string;
  param_key: string;
  param_value: string;
  description: string | null;
  data_type: string | null;
  updated_at: string | null;
}

/** Reads one parameter outside a write transaction. */
export async function getParameter(key: string): Promise<string> {
  const result = await query<{ param_value: string }>(
    `SELECT param_value FROM system_parameter WHERE param_key = $1`,
    [key]
  );
  const parameter = result[0];
  if (!parameter) throw new Error(`System parameter not found: ${key}`);
  return parameter.param_value;
}

/** Lists parameters outside a write transaction. */
export async function listParameters(): Promise<SystemParameter[]> {
  const result = await query<SystemParameter>(
    `SELECT param_id, param_key, param_value, description, data_type, updated_at
     FROM system_parameter
     ORDER BY param_key ASC`
  );
  return result;
}

/** Updates one parameter and its trigger audit inside one locked transaction. */
export async function updateParameter(paramKey: string, newValue: string): Promise<SystemParameter> {
  return withTransaction(async (tx) => {
    const current = await tx.query<SystemParameter>(
      `SELECT param_id, param_key, param_value, description, data_type, updated_at
       FROM system_parameter WHERE param_key = $1 FOR UPDATE`, [paramKey],
    );
    const parameter = current.rows[0];
    if (!parameter) throw new NotFoundError('Parameter');
    const value = newValue.trim();
    if (!value || value.length > 500) throw new ValidationError('A parameter value is required.');
    if (paramKey.startsWith('BUSINESS_HOUR_') && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new ValidationError('Business hours must use HH:mm.');
    }
    if (paramKey.startsWith('WITHDRAWAL_') &&
        (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(value) || !/[1-9]/.test(value))) {
      throw new ValidationError('Withdrawal limits must be positive decimal amounts.');
    }
    if ((paramKey.startsWith('SESSION_') || paramKey === 'INTEREST_CYCLE_DAYS') && !/^[1-9]\d{0,3}$/.test(value)) {
      throw new ValidationError('The value must be a positive whole number.');
    }
    const result = await tx.query<SystemParameter>(
    `UPDATE system_parameter
     SET param_value = $1, updated_at = now()
     WHERE param_key = $2
     RETURNING param_id, param_key, param_value, description, data_type, updated_at`,
    [value, paramKey]
  );
    const updated = result.rows[0];
    if (!updated) throw new NotFoundError('Parameter');
    return updated;
  });
}
