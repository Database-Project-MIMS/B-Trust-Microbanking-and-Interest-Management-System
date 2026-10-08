# P03-M04-T05: Transaction APIs

I've implemented the transaction APIs required for Phase 3!

These are located at:
- `POST /api/transactions/deposits`
- `POST /api/transactions/withdrawals`
- `POST /api/transactions/{id}/reverse`
- `GET /api/accounts/{id}/transactions`
- `GET /api/transactions/{id}`

**To Member 3 (Nisith):**
When building your balance panel (`P03-M03-T03`), you can now use `GET /api/accounts/{id}/transactions` to fetch the paginated list of transactions, and the `availableToWithdraw` property on the account endpoints for display.

**To Member 5 (Selith):**
When building your Fixed Deposit opening features (`P04-M05-T05`), you can refer to the `transaction-service.ts` for how we use `withTransaction` and `throwTransactionDatabaseError` to securely interface with the `sp_open_fixed_deposit` routine.

The API endpoints correctly implement idempotency (returning 201 on success, and 200 on replay).
