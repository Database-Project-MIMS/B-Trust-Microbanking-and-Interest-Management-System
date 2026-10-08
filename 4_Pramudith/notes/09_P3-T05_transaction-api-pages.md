# Notes for P03-M04-T05 (Transaction APIs)

1. **Idempotency Middleware**: Implemented `requireIdempotencyKey` in `lib/api/idempotency.ts`. We read the `Idempotency-Key` header and pass it straight to the `transaction-service`, strictly following the rule that the database is the source of truth for idempotency.
2. **Transaction Services**: 
   - Created `services/transaction-service.ts` providing `postDeposit`, `postWithdrawal`, `reverseTransaction`, `getStatement`, and `getTransaction`.
   - Used `withTransaction` for the connection and `setRlsContext` to inject actor identity.
3. **Transaction Error Mapping**:
   - Created `services/transaction-errors.ts` to map `P0001` exceptions raised by `sp_post_withdrawal` and `sp_post_deposit` to correct HTTP codes and safe domain errors.
4. **API Route Handlers**:
   - `POST /api/transactions/deposits`
   - `POST /api/transactions/withdrawals`
   - `GET /api/accounts/[id]/transactions`
   - `GET /api/transactions/[id]`
   - Updated `POST /api/transactions/[id]/reverse` (which Nadija started) to actually call the new `reverseTransaction` service method instead of returning `501 NOT IMPLEMENTED`.
5. **Testing**:
   - Created API tests in `tests/api/` mimicking the structure of existing `accounts.test.mjs`, mocking the next request logic for deposits, withdrawals, and reversals.
6. **Documentation**:
   - Updated `docs/09_task-tracker.md` to mark this task as DONE.
   - Wrote handoff notes in `.agent/handoffs/p03-m04-t05-transaction-apis.md`.
