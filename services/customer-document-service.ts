import "server-only";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { setRlsContext } from "@/lib/db/rls-context";
import {
  BusinessRuleError,
  NotAuthorizedError,
  NotFoundError,
  ValidationError,
} from "@/lib/db/errors";

interface VerifierRow {
  role_name: "AGENT" | "BRANCH_MANAGER";
  branch_id: string;
}

interface DocumentRow {
  doc_id: string;
  customer_id: string;
  verified_by: string | null;
  verified_date: Date | null;
}

export interface VerifiedDocument {
  docId: string;
  customerId: string;
  verifiedBy: string;
  verifiedDate: Date;
}

function mapVerified(row: DocumentRow): VerifiedDocument {
  if (!row.verified_by || !row.verified_date) {
    throw new BusinessRuleError("DOCUMENT_NOT_VERIFIED", "Document verification did not complete.");
  }
  return {
    docId: row.doc_id,
    customerId: row.customer_id,
    verifiedBy: row.verified_by,
    verifiedDate: row.verified_date,
  };
}

/** Verifies an in-scope document and audits it atomically in one withTransaction boundary. */
export async function verifyDocument(docId: string, verifierUserId: string): Promise<VerifiedDocument> {
  // The future controller supplies verifierUserId from requireUser(), never the request body.
  if (!z.string().uuid().safeParse(docId).success || !z.string().uuid().safeParse(verifierUserId).success) {
    throw new ValidationError("Document and verifier IDs must be valid UUIDs.");
  }

  return withTransaction(async (tx) => {
    // Shared locks prevent privilege/profile/branch changes during verification.
    const verifierResult = await tx.query<VerifierRow>(
      `SELECT r.role_name, a.branch_id
         FROM app_user u
         JOIN role r ON r.role_id = u.role_id
         JOIN agent a ON a.agent_id = u.user_id
         JOIN branch b ON b.branch_id = a.branch_id
        WHERE u.user_id = $1 AND u.status = 'ACTIVE' AND r.status = 'ACTIVE'
          AND a.status = 'ACTIVE' AND b.status = 'ACTIVE'
          AND r.role_name IN ('AGENT', 'BRANCH_MANAGER')
        FOR SHARE OF u, r, a, b`,
      [verifierUserId],
    );
    const verifier = verifierResult.rows[0];
    if (!verifier) throw new NotAuthorizedError();

    // Supply transaction-local identity for M1's upcoming RLS/audit integration.
    await setRlsContext(tx, {
      userId: verifierUserId,
      branchId: verifier.branch_id,
      roleName: verifier.role_name,
    });
    const documentResult = await tx.query<DocumentRow>(
      `SELECT d.doc_id, d.customer_id, d.verified_by, d.verified_date
         FROM customer_document d JOIN customer c ON c.customer_id = d.customer_id
        WHERE d.doc_id = $1 AND c.branch_id = $2 AND c.status = 'ACTIVE'
          AND ($3::text = 'BRANCH_MANAGER' OR EXISTS (
            SELECT 1 FROM customer_agent ca
             WHERE ca.customer_id = c.customer_id AND ca.agent_id = $4 AND ca.is_active
          ))
        FOR UPDATE OF d FOR SHARE OF c`,
      [docId, verifier.branch_id, verifier.role_name, verifierUserId],
    );
    const document = documentResult.rows[0];
    if (!document) {
      // Only existence, never another branch's document contents, is inspected.
      const exists = await tx.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM customer_document WHERE doc_id = $1) AS exists", [docId],
      );
      if (exists.rows[0]?.exists) throw new NotAuthorizedError();
      throw new NotFoundError("Document");
    }
    if (verifier.role_name === "AGENT") {
      // Recheck and lock the assignment so reassignment cannot race this operation.
      const assignment = await tx.query<{ cust_agent_id: string }>(
        `SELECT cust_agent_id FROM customer_agent
          WHERE customer_id = $1 AND agent_id = $2 AND is_active FOR SHARE`,
        [document.customer_id, verifierUserId],
      );
      if (!assignment.rows[0]) throw new NotAuthorizedError();
    }
    if (document.verified_by === verifierUserId) return mapVerified(document);
    if (document.verified_by !== null) {
      throw new BusinessRuleError("DOCUMENT_ALREADY_VERIFIED", "The document has already been verified.");
    }

    const updated = await tx.query<DocumentRow>(
      `UPDATE customer_document SET verified_by = $1, verified_date = now()
        WHERE doc_id = $2 RETURNING doc_id, customer_id, verified_by, verified_date`,
      [verifierUserId, docId],
    );
    const updatedDocument = updated.rows[0];
    if (!updatedDocument) throw new NotFoundError("Document");
    const verified = mapVerified(updatedDocument);
    // Existing audit-service uses the global pool; use this transaction client instead.
    // Omit paths, document contents and customer identity from audit JSON.
    await tx.query(
      `INSERT INTO audit_log (user_id, actor_type, entity_type, entity_id, action, old_values, new_values)
       VALUES ($1, 'USER', 'customer_document', $2, 'UPDATE', $3::jsonb, $4::jsonb)`,
      [verifierUserId, docId, JSON.stringify({ verified_by: null, verified_date: null }),
        JSON.stringify({ verified_by: verified.verifiedBy, verified_date: verified.verifiedDate.toISOString() })],
    );
    return verified;
  });
}
