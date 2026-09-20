import "server-only";
import { query, queryOne } from "@/lib/db";
import { NotFoundError } from "@/lib/db/errors";
import type {
  CreateBranchInput,
  RecordStatus,
  UpdateBranchInput,
} from "@/lib/validation/organization";
import { throwOrganizationDatabaseError } from "@/services/organization-errors";

interface BranchRow {
  branch_id: string;
  branch_code: string;
  branch_name: string;
  address: string;
  district: string;
  phone: string;
  status: RecordStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Branch {
  branchId: string;
  branchCode: string;
  branchName: string;
  address: string;
  district: string;
  phone: string;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
}

function mapBranch(row: BranchRow): Branch {
  return {
    branchId: row.branch_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    address: row.address,
    district: row.district,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lists branches in one read query with branch scope enforced in SQL. */
export async function listBranches(
  scopeBranchId: string | null,
  status?: RecordStatus,
): Promise<Branch[]> {
  const rows = await query<BranchRow>(
    `SELECT branch_id, branch_code, branch_name, address, district, phone,
            status, created_at, updated_at
       FROM branch
      WHERE ($1::uuid IS NULL OR branch_id = $1::uuid)
        AND ($2::text IS NULL OR status::text = $2::text)
      ORDER BY branch_code`,
    [scopeBranchId, status ?? null],
  );

  return rows.map(mapBranch);
}

/** Creates one branch in a single statement without opening a transaction. */
export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  try {
    const row = await queryOne<BranchRow>(
      `INSERT INTO branch (branch_code, branch_name, address, district, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING branch_id, branch_code, branch_name, address, district, phone,
                 status, created_at, updated_at`,
      [input.branchCode, input.branchName, input.address, input.district, input.phone],
    );

    if (!row) {
      throw new Error("Branch insert returned no row.");
    }

    return mapBranch(row);
  } catch (error) {
    throwOrganizationDatabaseError(error);
  }
}

/** Updates one branch atomically in a single statement; records are never deleted. */
export async function updateBranch(
  branchId: string,
  input: UpdateBranchInput,
): Promise<Branch> {
  try {
    const row = await queryOne<BranchRow>(
      `UPDATE branch
          SET branch_name = COALESCE($1, branch_name),
              address = COALESCE($2, address),
              district = COALESCE($3, district),
              phone = COALESCE($4, phone),
              status = COALESCE($5::record_status, status)
        WHERE branch_id = $6
        RETURNING branch_id, branch_code, branch_name, address, district, phone,
                  status, created_at, updated_at`,
      [
        input.branchName ?? null,
        input.address ?? null,
        input.district ?? null,
        input.phone ?? null,
        input.status ?? null,
        branchId,
      ],
    );

    if (!row) {
      throw new NotFoundError("Branch");
    }

    return mapBranch(row);
  } catch (error) {
    throwOrganizationDatabaseError(error);
  }
}
