import "server-only";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { setRlsContext } from "@/lib/db/rls-context";
import { BusinessRuleError, NotAuthorizedError, NotFoundError, ValidationError, isPgError } from "@/lib/db/errors";

export interface VerifiedDocument {
  docId: string; customerId: string; verifiedBy: string; verifiedDate: Date;
}

/** One transaction locks current authorization/document, verifies and audits atomically. */
export async function verifyDocument(docId: string, verifierUserId: string): Promise<VerifiedDocument> {
  if (!z.string().uuid().safeParse(docId).success || !z.string().uuid().safeParse(verifierUserId).success) {
    throw new ValidationError("Document and verifier IDs must be valid UUIDs.");
  }
  return withTransaction(async tx => {
    const actor = (await tx.query<{ role_name: string; branch_id: string }>(
      `SELECT r.role_name,a.branch_id FROM app_user u JOIN role r ON r.role_id=u.role_id
       JOIN agent a ON a.agent_id=u.user_id WHERE u.user_id=$1`, [verifierUserId])).rows[0];
    if (!actor) throw new NotAuthorizedError();
    await setRlsContext(tx, { userId: verifierUserId, roleName: actor.role_name, branchId: actor.branch_id });
    try {
      const row = (await tx.query<{ doc_id: string; customer_id: string; verified_by: string; verified_date: Date }>(
        "SELECT doc_id,customer_id,verified_by,verified_date FROM fn_verify_customer_document($1,$2)", [docId, verifierUserId])).rows[0];
      if (!row) throw new Error("Document verification receipt unavailable.");
      return { docId: row.doc_id, customerId: row.customer_id, verifiedBy: row.verified_by, verifiedDate: row.verified_date };
    } catch (error) {
      if (isPgError(error)) {
        if (error.code === '42501') throw new NotAuthorizedError();
        if (error.code === 'P0002') throw new NotFoundError('Document');
        if (error.code === 'P0001' && error.message === 'DOCUMENT_ALREADY_VERIFIED') {
          throw new BusinessRuleError('DOCUMENT_ALREADY_VERIFIED', 'The document has already been verified.');
        }
      }
      throw error;
    }
  });
}
