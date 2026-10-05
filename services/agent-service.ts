import "server-only";
import { hashPassword } from "@/lib/auth/password";
import { query, withTransaction, type Executor } from "@/lib/db";
import {
  DomainError,
  NotAuthorizedError,
  NotFoundError,
  ValidationError,
} from "@/lib/db/errors";
import type {
  CreateAgentInput,
  RecordStatus,
  UpdateAgentInput,
} from "@/lib/validation/organization";
import { throwOrganizationDatabaseError } from "@/services/organization-errors";

interface AgentRow {
  agent_id: string;
  username: string;
  branch_id: string;
  branch_code: string;
  branch_name: string;
  employee_no: string;
  nic_passport_no: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
  hired_date: string;
  status: RecordStatus;
  created_at: Date;
  updated_at: Date;
}

interface IdRow {
  user_id: string;
}

interface RoleRow {
  role_id: string;
}

interface ExistsRow {
  exists: boolean;
}

export interface Agent {
  agentId: string;
  username: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  employeeNo: string;
  nicPassportNo: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
  hiredDate: string;
  status: RecordStatus;
  roleName: "AGENT";
  createdAt: Date;
  updatedAt: Date;
}

function mapAgent(row: AgentRow): Agent {
  return {
    agentId: row.agent_id,
    username: row.username,
    branchId: row.branch_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    employeeNo: row.employee_no,
    nicPassportNo: row.nic_passport_no,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    phone: row.phone,
    address: row.address,
    email: row.email,
    hiredDate: row.hired_date,
    status: row.status,
    roleName: "AGENT",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function selectAgent(
  executor: Executor,
  agentId: string,
  scopeBranchId: string | null,
): Promise<AgentRow | null> {
  const result = await executor.query<AgentRow>(
    `SELECT a.agent_id, u.username, a.branch_id, b.branch_code, b.branch_name,
            a.employee_no, a.nic_passport_no, a.full_name, a.date_of_birth,
            a.gender, a.phone, a.address, a.email, a.hired_date, a.status,
            a.created_at, a.updated_at
       FROM agent a
       JOIN app_user u ON u.user_id = a.agent_id
       JOIN role r ON r.role_id = u.role_id
       JOIN branch b ON b.branch_id = a.branch_id
      WHERE a.agent_id = $1
        AND r.role_name = 'AGENT'
        AND ($2::uuid IS NULL OR a.branch_id = $2::uuid)`,
    [agentId, scopeBranchId],
  );

  return result.rows[0] ?? null;
}

async function assertScopedAgentExists(
  executor: Executor,
  agentId: string,
  scopeBranchId: string | null,
): Promise<void> {
  const scoped = await executor.query<ExistsRow>(
    `SELECT EXISTS (
       SELECT 1
         FROM agent a
         JOIN app_user u ON u.user_id = a.agent_id
         JOIN role r ON r.role_id = u.role_id
        WHERE a.agent_id = $1
          AND r.role_name = 'AGENT'
          AND ($2::uuid IS NULL OR a.branch_id = $2::uuid)
     ) AS exists`,
    [agentId, scopeBranchId],
  );

  if (scoped.rows[0]?.exists) {
    return;
  }

  const unscoped = await executor.query<ExistsRow>(
    `SELECT EXISTS (
       SELECT 1
         FROM agent a
         JOIN app_user u ON u.user_id = a.agent_id
         JOIN role r ON r.role_id = u.role_id
        WHERE a.agent_id = $1
          AND r.role_name = 'AGENT'
     ) AS exists`,
    [agentId],
  );

  if (unscoped.rows[0]?.exists) {
    throw new NotAuthorizedError();
  }

  throw new NotFoundError("Agent");
}

function resolveTargetBranch(
  requestedBranchId: string | undefined,
  scopeBranchId: string | null,
): string {
  if (scopeBranchId !== null) {
    if (requestedBranchId !== undefined && requestedBranchId !== scopeBranchId) {
      throw new NotAuthorizedError("You cannot manage agents in another branch.");
    }
    return scopeBranchId;
  }

  if (!requestedBranchId) {
    throw new ValidationError("branchId is required for bank-wide users.");
  }

  return requestedBranchId;
}

/** Lists ordinary agents in one read query with branch scope enforced in SQL. */
export async function listAgents(
  scopeBranchId: string | null,
  status?: RecordStatus,
): Promise<Agent[]> {
  const rows = await query<AgentRow>(
    `SELECT a.agent_id, u.username, a.branch_id, b.branch_code, b.branch_name,
            a.employee_no, a.nic_passport_no, a.full_name, a.date_of_birth,
            a.gender, a.phone, a.address, a.email, a.hired_date, a.status,
            a.created_at, a.updated_at
       FROM agent a
       JOIN app_user u ON u.user_id = a.agent_id
       JOIN role r ON r.role_id = u.role_id
       JOIN branch b ON b.branch_id = a.branch_id
      WHERE r.role_name = 'AGENT'
        AND ($1::uuid IS NULL OR a.branch_id = $1::uuid)
        AND ($2::text IS NULL OR a.status::text = $2::text)
      ORDER BY a.employee_no`,
    [scopeBranchId, status ?? null],
  );

  return rows.map(mapAgent);
}

/** Creates the login and ordinary-agent profile in one database transaction. */
export async function createAgent(
  input: CreateAgentInput,
  scopeBranchId: string | null,
): Promise<Agent> {
  const targetBranchId = resolveTargetBranch(input.branchId, scopeBranchId);
  const passwordHash = await hashPassword(input.password);

  try {
    return await withTransaction(async (tx) => {
      const roleResult = await tx.query<RoleRow>(
        `SELECT role_id
           FROM role
          WHERE role_name = 'AGENT'
            AND status = 'ACTIVE'`,
      );

      const role = roleResult.rows[0];
      if (!role) {
        throw new DomainError(
          "AGENT_ROLE_UNAVAILABLE",
          "The AGENT role is not configured as active.",
          500,
        );
      }

      const userResult = await tx.query<IdRow>(
        `INSERT INTO app_user (role_id, username, password_hash, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         RETURNING user_id`,
        [role.role_id, input.username, passwordHash],
      );
      const user = userResult.rows[0];
      if (!user) {
        throw new Error("User insert returned no row.");
      }

      await tx.query(
        `INSERT INTO agent (
           agent_id, branch_id, employee_no, nic_passport_no, full_name,
           date_of_birth, gender, phone, address, email, hired_date, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE')`,
        [
          user.user_id,
          targetBranchId,
          input.employeeNo,
          input.nicPassportNo,
          input.fullName,
          input.dateOfBirth,
          input.gender,
          input.phone,
          input.address,
          input.email,
          input.hiredDate,
        ],
      );

      const created = await selectAgent(tx, user.user_id, scopeBranchId);
      if (!created) {
        throw new Error("Agent insert returned no row.");
      }

      return mapAgent(created);
    });
  } catch (error) {
    throwOrganizationDatabaseError(error);
  }
}

/** Updates an ordinary agent and their login status in one database transaction. */
export async function updateAgent(
  agentId: string,
  input: UpdateAgentInput,
  scopeBranchId: string | null,
): Promise<Agent> {
  const targetBranchId =
    input.branchId === undefined
      ? undefined
      : resolveTargetBranch(input.branchId, scopeBranchId);

  try {
    return await withTransaction(async (tx) => {
      await assertScopedAgentExists(tx, agentId, scopeBranchId);

      const locked = await tx.query<IdRow>(
        `SELECT u.user_id
           FROM agent a
           JOIN app_user u ON u.user_id = a.agent_id
           JOIN role r ON r.role_id = u.role_id
          WHERE a.agent_id = $1
            AND r.role_name = 'AGENT'
            AND ($2::uuid IS NULL OR a.branch_id = $2::uuid)
          FOR UPDATE OF a, u`,
        [agentId, scopeBranchId],
      );

      if (!locked.rows[0]) {
        throw new NotAuthorizedError();
      }

      if (input.status !== undefined) {
        await tx.query(
          `UPDATE app_user
              SET status = $1,
                  updated_at = now()
            WHERE user_id = $2`,
          [input.status, agentId],
        );
      }

      await tx.query(
        `UPDATE agent
            SET branch_id = COALESCE($1::uuid, branch_id),
                employee_no = COALESCE($2, employee_no),
                nic_passport_no = COALESCE($3, nic_passport_no),
                full_name = COALESCE($4, full_name),
                date_of_birth = COALESCE($5::date, date_of_birth),
                gender = COALESCE($6, gender),
                phone = COALESCE($7, phone),
                address = COALESCE($8, address),
                email = COALESCE($9, email),
                hired_date = COALESCE($10::date, hired_date),
                status = COALESCE($11::record_status, status)
          WHERE agent_id = $12`,
        [
          targetBranchId ?? null,
          input.employeeNo ?? null,
          input.nicPassportNo ?? null,
          input.fullName ?? null,
          input.dateOfBirth ?? null,
          input.gender ?? null,
          input.phone ?? null,
          input.address ?? null,
          input.email ?? null,
          input.hiredDate ?? null,
          input.status ?? null,
          agentId,
        ],
      );

      const updated = await selectAgent(tx, agentId, scopeBranchId);
      if (!updated) {
        throw new NotFoundError("Agent");
      }

      return mapAgent(updated);
    });
  } catch (error) {
    throwOrganizationDatabaseError(error);
  }
}
