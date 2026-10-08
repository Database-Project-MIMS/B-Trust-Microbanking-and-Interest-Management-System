import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { BusinessRuleError, DatabaseError, NotAuthorizedError, NotFoundError,
  UniqueViolationError, ValidationError } from "@/lib/db/errors";
import { customerSearchSchema, registerCustomerSchema } from "@/lib/validation/customer";
import type { AuthenticatedUser } from "@/lib/auth/rbac";
import { setRlsContext } from "@/lib/db/rls-context";

export type CustomerActor = Pick<AuthenticatedUser, "userId" | "roleName" | "branchId">;
interface ActorScope { userId: string; roleName: string; branchId: string | null; today: string }
interface CustomerRow {
  customer_id: string; customer_number: string; branch_id: string; full_name: string;
  nic_passport_no: string; date_of_birth: string; gender: string | null; phone: string | null;
  address: string | null; email: string; status: "ACTIVE" | "INACTIVE"; created_at: Date;
}
export interface Customer {
  customerId: string; customerNumber: string; branchId: string; fullName: string;
  nicPassportNo: string; dateOfBirth: string; gender: string | null; phone: string | null;
  address: string | null; email: string; status: "ACTIVE" | "INACTIVE"; createdAt: Date;
}
export interface CustomerSearchResult { customers: Customer[]; total: number; page: number; pageSize: number }
interface AssignmentRow {
  cust_agent_id: string; agent_id: string; full_name: string; assigned_date: string;
  end_date: string | null; is_active: boolean;
}
interface DocumentRow { doc_id: string; doc_type: string; uploaded_date: Date; verified_by: string | null; verified_date: Date | null }
interface AccountRow { account_id: string; account_number: string; status: string; current_balance: string }
export interface CustomerProfile {
  customer: Customer;
  assignmentHistory: { assignmentId: string; agentId: string; agentName: string; assignedDate: string; endDate: string | null; isActive: boolean }[];
  documents: { docId: string; docType: string; uploadedDate: Date; verifiedBy: string | null; verifiedDate: Date | null }[];
  accounts: { accountId: string; accountNumber: string; status: string; currentBalance: string }[] | null;
}

const WRITE_ROLES = ["AGENT", "BRANCH_MANAGER"];
const SEARCH_ROLES = ["AGENT", "BRANCH_MANAGER", "CENTRAL_OPS", "AUDITOR"];
const PROFILE_ROLES = [...SEARCH_ROLES, "CUSTOMER"];
const actorSchema = z.object({ userId: z.string().uuid(), roleName: z.string(), branchId: z.string().uuid().nullable() });
const CUSTOMER_COLUMNS = `c.customer_id, c.customer_number, c.branch_id, c.full_name, c.nic_passport_no,
  c.date_of_birth::text, c.gender, c.phone, c.address, c.email, c.status, c.created_at`;
// SQL fragments are fixed server-side constants, never request input.
const SCOPE_SQL = `($1::uuid IS NULL OR c.branch_id = $1)
  AND ($2::text <> 'AGENT' OR EXISTS (SELECT 1 FROM customer_agent ca
    WHERE ca.customer_id = c.customer_id AND ca.agent_id = $3 AND ca.is_active))
  AND ($2::text <> 'CUSTOMER' OR c.app_user_id = $3)`;

function validateActor(actor: CustomerActor, allowedRoles: readonly string[]): CustomerActor {
  const result = actorSchema.safeParse(actor);
  if (!result.success || !allowedRoles.includes(result.data.roleName)) throw new NotAuthorizedError();
  return result.data;
}

async function resolveScope(tx: Parameters<typeof setRlsContext>[0], actor: CustomerActor, allowedRoles: readonly string[]): Promise<ActorScope> {
  const result = await tx.query<{ role_name: string; today: string }>(
    `SELECT r.role_name, CURRENT_DATE::text AS today FROM app_user u JOIN role r ON r.role_id = u.role_id
      WHERE u.user_id = $1 AND u.status = 'ACTIVE' AND r.status = 'ACTIVE' FOR SHARE OF u`, [actor.userId],
  );
  const current = result.rows[0];
  if (!current || current.role_name !== actor.roleName || !allowedRoles.includes(current.role_name)) throw new NotAuthorizedError();
  let branchId: string | null = null;
  if (WRITE_ROLES.includes(current.role_name)) {
    const profile = await tx.query<{ branch_id: string }>(
      `SELECT a.branch_id FROM agent a JOIN branch b ON b.branch_id = a.branch_id
        WHERE a.agent_id = $1 AND a.status = 'ACTIVE' AND b.status = 'ACTIVE' FOR SHARE OF a, b`, [actor.userId],
    );
    branchId = profile.rows[0]?.branch_id ?? null;
    if (!branchId || branchId !== actor.branchId) throw new NotAuthorizedError();
  }
  await setRlsContext(tx, { userId: actor.userId, branchId, roleName: current.role_name });
  return { userId: actor.userId, roleName: current.role_name, branchId, today: current.today };
}

function mapCustomer(row: CustomerRow, scope: ActorScope): Customer {
  const masked = WRITE_ROLES.includes(scope.roleName);
  return { customerId: row.customer_id, customerNumber: row.customer_number, branchId: row.branch_id,
    fullName: row.full_name, nicPassportNo: masked ? `***${row.nic_passport_no.slice(-4)}` : row.nic_passport_no,
    dateOfBirth: row.date_of_birth, gender: row.gender, phone: row.phone, address: row.address,
    email: masked ? "***@***" : row.email, status: row.status, createdAt: row.created_at };
}

/** Registers customer, metadata and assignment with the customer audit trigger in one transaction. */
export async function registerCustomer(input: unknown, actor: CustomerActor): Promise<{ customerId: string; customerNumber: string }> {
  const authenticated = validateActor(actor, WRITE_ROLES);
  const parsed = registerCustomerSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Customer registration contains invalid or missing fields.");
  const value = parsed.data;
  try {
    return await withTransaction(async tx => {
      const scope = await resolveScope(tx, authenticated, WRITE_ROLES);
      if (value.branchId !== scope.branchId || (scope.roleName === "AGENT" && value.agentId !== scope.userId)) throw new NotAuthorizedError();
      if (value.dateOfBirth >= scope.today) throw new ValidationError("Date of birth must be in the past.");
      const agent = await tx.query<{ agent_id: string }>(
        `SELECT a.agent_id FROM agent a JOIN app_user u ON u.user_id = a.agent_id JOIN role r ON r.role_id = u.role_id
          WHERE a.agent_id = $1 AND a.branch_id = $2 AND a.status = 'ACTIVE'
            AND u.status = 'ACTIVE' AND r.status = 'ACTIVE' AND r.role_name = 'AGENT' FOR SHARE OF a, u`,
        [value.agentId, scope.branchId],
      );
      if (!agent.rows[0]) throw new BusinessRuleError("INVALID_ASSIGNED_AGENT", "Select an active agent in your branch.");
      const customerNumber = `CUS-${randomBytes(12).toString("hex").toUpperCase()}`;
      const created = await tx.query<{ customer_id: string; customer_number: string }>(
        `INSERT INTO customer (branch_id, customer_number, nic_passport_no, full_name, date_of_birth, gender, phone, address, email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING customer_id, customer_number`,
        [value.branchId, customerNumber, value.nicPassportNo, value.fullName, value.dateOfBirth,
          value.gender ?? null, value.phone ?? null, value.address ?? null, value.email],
      );
      const customer = created.rows[0];
      if (!customer) throw new DatabaseError();
      for (const document of value.documents) await tx.query(
        "INSERT INTO customer_document (customer_id, doc_type, file_path) VALUES ($1,$2,$3)",
        [customer.customer_id, document.docType, document.filePath],
      );
      await tx.query("INSERT INTO customer_agent (customer_id, agent_id) VALUES ($1,$2)", [customer.customer_id, value.agentId]);
      // M1's customer trigger writes one sanitized audit in this same transaction.
      return { customerId: customer.customer_id, customerNumber: customer.customer_number };
    });
  } catch (error) {
    if (error instanceof UniqueViolationError) {
      if (error.constraint === "uq_customer_nic_passport_no") throw new BusinessRuleError("DUPLICATE_IDENTITY", "A customer with this identity already exists.");
      if (error.constraint === "uq_customer_email") throw new BusinessRuleError("DUPLICATE_EMAIL", "A customer with this email already exists.");
      if (error.constraint === "uq_customer_number") throw new BusinessRuleError("DUPLICATE_CUSTOMER_NUMBER", "Customer number conflict. Retry registration.");
    }
    throw error;
  }
}

function likePattern(value: string | undefined): string | null {
  return value === undefined ? null : `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

/** Searches authorized customers with a consistent paginated snapshot in one repeatable-read transaction. */
export async function searchCustomers(input: unknown, actor: CustomerActor): Promise<CustomerSearchResult> {
  const authenticated = validateActor(actor, SEARCH_ROLES);
  const parsed = customerSearchSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Customer search contains invalid fields.");
  const value = parsed.data;
  return withTransaction(async tx => {
    const scope = await resolveScope(tx, authenticated, SEARCH_ROLES);
    if (scope.branchId && value.branchId && value.branchId !== scope.branchId) throw new NotAuthorizedError();
    const filters = `${SCOPE_SQL}
      AND ($4::text IS NULL OR c.full_name ILIKE $4 OR c.customer_number ILIKE $4 OR c.nic_passport_no ILIKE $4)
      AND ($5::text IS NULL OR c.full_name ILIKE $5) AND ($6::text IS NULL OR c.nic_passport_no = $6)
      AND ($7::uuid IS NULL OR c.branch_id = $7) AND ($8::uuid IS NULL OR EXISTS (
        SELECT 1 FROM customer_agent ca WHERE ca.customer_id = c.customer_id AND ca.agent_id = $8 AND ca.is_active))
      AND ($9::text IS NULL OR c.status = $9)`;
    const params = [scope.branchId, scope.roleName, scope.userId, likePattern(value.q), likePattern(value.name),
      value.nicPassportNo ?? null, value.branchId ?? null, value.agentId ?? null, value.status ?? null];
    const count = await tx.query<{ total: number }>(`SELECT count(*)::int AS total FROM customer c WHERE ${filters}`, params);
    const sortColumns = { fullName: "c.full_name", customerNumber: "c.customer_number", createdAt: "c.created_at" } as const;
    const directions = { asc: "ASC", desc: "DESC" } as const;
    const rows = await tx.query<CustomerRow>(
      `SELECT ${CUSTOMER_COLUMNS} FROM customer c WHERE ${filters}
        ORDER BY ${sortColumns[value.sortBy]} ${directions[value.sortDirection]}, c.customer_id
        LIMIT $10 OFFSET $11`, [...params, value.pageSize, (value.page - 1) * value.pageSize],
    );
    return { customers: rows.rows.map(row => mapCustomer(row, scope)), total: count.rows[0]?.total ?? 0,
      page: value.page, pageSize: value.pageSize };
  }, { isolationLevel: "REPEATABLE READ" });
}

/** Reads one authorized customer, history and metadata in one repeatable-read transaction. */
export async function getCustomerProfile(customerId: string, actor: CustomerActor): Promise<CustomerProfile> {
  const authenticated = validateActor(actor, PROFILE_ROLES);
  if (!z.string().uuid().safeParse(customerId).success) throw new ValidationError("Customer ID must be a UUID.");
  return withTransaction(async tx => {
    const scope = await resolveScope(tx, authenticated, PROFILE_ROLES);
    const params = [scope.branchId, scope.roleName, scope.userId, customerId];
    const result = await tx.query<CustomerRow>(
      `SELECT ${CUSTOMER_COLUMNS} FROM customer c WHERE ${SCOPE_SQL} AND c.customer_id = $4`, params,
    );
    const customer = result.rows[0];
    // Uniform 404 conceals other customers' existence, including customer self requests.
    if (!customer) throw new NotFoundError("Customer");
    const history = await tx.query<AssignmentRow>(
      `SELECT ca.cust_agent_id, ca.agent_id, a.full_name, ca.assigned_date::text, ca.end_date::text, ca.is_active
        FROM customer_agent ca JOIN agent a ON a.agent_id = ca.agent_id JOIN customer c ON c.customer_id = ca.customer_id
        WHERE ${SCOPE_SQL} AND c.customer_id = $4 ORDER BY ca.assigned_date, ca.created_at, ca.cust_agent_id`, params,
    );
    const documents = await tx.query<DocumentRow>(
      `SELECT d.doc_id, d.doc_type, d.uploaded_date, d.verified_by, d.verified_date
        FROM customer_document d JOIN customer c ON c.customer_id = d.customer_id
        WHERE ${SCOPE_SQL} AND c.customer_id = $4 ORDER BY d.uploaded_date, d.doc_id`, params,
    );
    const available = await tx.query<{ available: boolean }>("SELECT to_regclass('public.account_holder') IS NOT NULL AS available");
    let accounts: CustomerProfile["accounts"] = null;
    if (available.rows[0]?.available) {
      const rows = await tx.query<AccountRow>(
        `SELECT a.account_id, a.account_number, a.status, a.current_balance::text
          FROM account_holder ah JOIN account a ON a.account_id = ah.account_id
          JOIN customer c ON c.customer_id = ah.customer_id
          WHERE ${SCOPE_SQL} AND c.customer_id = $4 AND ($1::uuid IS NULL OR a.branch_id = $1)
          ORDER BY a.account_number`, params,
      );
      accounts = rows.rows.map(row => ({ accountId: row.account_id, accountNumber: row.account_number,
        status: row.status, currentBalance: row.current_balance }));
    }
    return { customer: mapCustomer(customer, scope),
      assignmentHistory: history.rows.map(row => ({ assignmentId: row.cust_agent_id, agentId: row.agent_id,
        agentName: row.full_name, assignedDate: row.assigned_date, endDate: row.end_date, isActive: row.is_active })),
      documents: documents.rows.map(row => ({ docId: row.doc_id, docType: row.doc_type, uploadedDate: row.uploaded_date,
        verifiedBy: row.verified_by, verifiedDate: row.verified_date })), accounts };
  }, { isolationLevel: "REPEATABLE READ" });
}
