# I-5: Interest Credit Posting (`sp_post_interest_credit`)

**From:** Pramudith (Member 4)
**To:** Member 5

This handoff describes the contract for posting interest credits using the new routine `sp_post_interest_credit`.

**Contract for M5 (write this into the handoff verbatim):**
- Call `sp_post_interest_credit` exactly once per FD per cycle, inside the **same** transaction as their `interest_payout` insert (so both succeed or both roll back together for that one FD).
- Never construct a `transaction` INSERT directly — every `INTEREST_CREDIT` row must come through this routine, so the immutability trigger, audit trail and balance update all stay in one place.
- This routine does not itself check `interest_payout`'s `UNIQUE(fd_id, cycle_date)` — that idempotency guarantee is M5's table's job (BR-F2); this routine simply posts whatever it's told to post, once, per call.

Routine signature:
```sql
CALL sp_post_interest_credit(
    p_account_id uuid,
    p_amount numeric(15,2),
    p_fd_id uuid,
    p_cycle_date date,
    OUT p_transaction_id uuid,
    OUT p_reference_number varchar,
    OUT p_balance_after numeric(15,2)
);
```
