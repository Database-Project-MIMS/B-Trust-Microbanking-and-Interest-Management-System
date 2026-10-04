# Transaction Schema Handoff (P02-M04-T01)

**To: Member 3 (Account Opening)**
The `transaction` table is live. When your `sp_open_savings_account` routine handles an initial deposit, you must supply these exact columns:
`account_id`, `initiated_by_user_id`, `channel_id`, `reference_number`, `transaction_type` ('DEPOSIT'), and `amount` (must be > 0). 

**To: Member 2 (Branch/Agent Attribution)**
I have deliberately omitted `agent_id` and `branch_id` from this Phase 2 migration as discussed. These are reserved for your Phase 3 (G-07) task. Please add them in your own upcoming migration block.