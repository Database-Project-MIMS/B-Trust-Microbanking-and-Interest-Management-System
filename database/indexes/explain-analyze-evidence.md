# EXPLAIN ANALYZE Evidence

## RPT-01: Agent-wise Transactions
### Query
```sql
SELECT * FROM vw_rpt01_agent_transactions
WHERE transaction_date >= '2025-01-01' AND transaction_date < '2026-01-01'
```
### Before Index
```
ERROR: REPORT_ACCESS_DENIED
```
### After Index
```
ERROR: REPORT_ACCESS_DENIED
```
### Index Created
`CREATE INDEX ix_txn_agent_date ON transaction (agent_id, transaction_date);`

## RPT-02: Account-wise Summary
### Query
```sql
SELECT * FROM vw_rpt02_account_summary
WHERE transaction_date >= '2025-01-01' AND transaction_date < '2026-01-01'
```
### Before Index
```
Nested Loop Left Join  (cost=56.14..2880.92 rows=188 width=910) (actual time=0.034..0.035 rows=0.00 loops=1)
  Buffers: shared hit=26
  ->  Hash Left Join  (cost=39.22..1680.90 rows=188 width=862) (actual time=0.034..0.035 rows=0.00 loops=1)
        Hash Cond: (a.account_id = t.account_id)
        Buffers: shared hit=26
        ->  Nested Loop  (cost=0.14..1639.90 rows=188 width=478) (actual time=0.033..0.034 rows=0.00 loops=1)
              Buffers: shared hit=26
              ->  Seq Scan on savings_plan sp  (cost=0.00..10.80 rows=80 width=234) (actual time=0.003..0.004 rows=5.00 loops=1)
                    Buffers: shared hit=1
              ->  Index Scan using ix_account_plan on account a  (cost=0.14..20.35 rows=1 width=260) (actual time=0.006..0.006 rows=0.00 loops=5)
                    Index Cond: (plan_id = sp.plan_id)
                    Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (ANY (account_id = (hashed SubPlan 2).col1))))
                    Rows Removed by Filter: 2
                    Index Searches: 5
                    Buffers: shared hit=25
                    SubPlan 2
                      ->  Nested Loop  (cost=4.32..19.54 rows=11 width=16) (actual time=0.002..0.002 rows=0.00 loops=1)
                            ->  Index Scan using uq_customer_app_user_id on customer c  (cost=0.15..8.23 rows=1 width=16) (actual time=0.002..0.002 rows=0.00 loops=1)
                                  Index Cond: (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)
                                  Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (app_user_id IS NOT NULL) AND (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)))
                                  Index Searches: 0
                            ->  Bitmap Heap Scan on account_holder ah  (cost=4.17..11.28 rows=3 width=32) (never executed)
                                  Recheck Cond: (c.customer_id = customer_id)
                                  ->  Bitmap Index Scan on ix_account_holder_customer  (cost=0.00..4.17 rows=3 width=0) (never executed)
                                        Index Cond: (customer_id = c.customer_id)
                                        Index Searches: 0
        ->  Hash  (cost=37.45..37.45 rows=130 width=384) (never executed)
              ->  Hash Left Join  (cost=23.50..37.45 rows=130 width=384) (never executed)
                    Hash Cond: (reversal.original_transaction_id = original.transaction_id)
                    ->  Hash Right Join  (cost=11.93..23.58 rows=130 width=250) (never executed)
                          Hash Cond: (reversal.reversal_transaction_id = t.transaction_id)
                          ->  Seq Scan on transaction_reversal reversal  (cost=0.00..11.30 rows=130 width=32) (never executed)
                          ->  Hash  (cost=11.05..11.05 rows=70 width=234) (never executed)
                                ->  Seq Scan on transaction t  (cost=0.00..11.05 rows=70 width=234) (never executed)
                    ->  Hash  (cost=10.70..10.70 rows=70 width=134) (never executed)
                          ->  Seq Scan on transaction original  (cost=0.00..10.70 rows=70 width=134) (never executed)
  ->  Memoize  (cost=16.92..16.93 rows=1 width=32) (never executed)
        Cache Key: t.balance_after, t.account_id, t.ledger_seq
        Cache Mode: binary
        ->  Aggregate  (cost=16.91..16.92 rows=1 width=32) (never executed)
              ->  Result  (cost=0.43..16.88 rows=2 width=254) (never executed)
                    One-Time Filter: (t.balance_after IS NULL)
                    ->  Nested Loop Left Join  (cost=0.43..16.88 rows=2 width=254) (never executed)
                          ->  Index Scan using ux_transaction_account_ledger_seq on transaction t_1  (cost=0.14..8.16 rows=1 width=152) (never executed)
                                Index Cond: ((account_id = t.account_id) AND (ledger_seq <= t.ledger_seq))
                                Index Searches: 0
                          ->  Nested Loop Left Join  (cost=0.29..8.70 rows=1 width=134) (never executed)
                                ->  Index Scan using transaction_reversal_reversal_transaction_id_key on transaction_reversal reversal_1  (cost=0.14..8.16 rows=1 width=32) (never executed)
                                      Index Cond: (reversal_transaction_id = t_1.transaction_id)
                                      Index Searches: 0
                                ->  Index Scan using transaction_pkey on transaction original_1  (cost=0.14..0.53 rows=1 width=134) (never executed)
                                      Index Cond: (transaction_id = reversal_1.original_transaction_id)
                                      Index Searches: 0
Planning:
  Buffers: shared hit=1063
Planning Time: 1.448 ms
Execution Time: 0.203 ms
```
### After Index
```
Nested Loop Left Join  (cost=56.14..2880.92 rows=188 width=910) (actual time=0.033..0.034 rows=0.00 loops=1)
  Buffers: shared hit=26
  ->  Hash Left Join  (cost=39.22..1680.90 rows=188 width=862) (actual time=0.033..0.034 rows=0.00 loops=1)
        Hash Cond: (a.account_id = t.account_id)
        Buffers: shared hit=26
        ->  Nested Loop  (cost=0.14..1639.90 rows=188 width=478) (actual time=0.032..0.033 rows=0.00 loops=1)
              Buffers: shared hit=26
              ->  Seq Scan on savings_plan sp  (cost=0.00..10.80 rows=80 width=234) (actual time=0.004..0.005 rows=5.00 loops=1)
                    Buffers: shared hit=1
              ->  Index Scan using ix_account_plan on account a  (cost=0.14..20.35 rows=1 width=260) (actual time=0.005..0.005 rows=0.00 loops=5)
                    Index Cond: (plan_id = sp.plan_id)
                    Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (ANY (account_id = (hashed SubPlan 2).col1))))
                    Rows Removed by Filter: 2
                    Index Searches: 5
                    Buffers: shared hit=25
                    SubPlan 2
                      ->  Nested Loop  (cost=4.32..19.54 rows=11 width=16) (actual time=0.002..0.002 rows=0.00 loops=1)
                            ->  Index Scan using uq_customer_app_user_id on customer c  (cost=0.15..8.23 rows=1 width=16) (actual time=0.002..0.002 rows=0.00 loops=1)
                                  Index Cond: (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)
                                  Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (app_user_id IS NOT NULL) AND (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)))
                                  Index Searches: 0
                            ->  Bitmap Heap Scan on account_holder ah  (cost=4.17..11.28 rows=3 width=32) (never executed)
                                  Recheck Cond: (c.customer_id = customer_id)
                                  ->  Bitmap Index Scan on ix_account_holder_customer  (cost=0.00..4.17 rows=3 width=0) (never executed)
                                        Index Cond: (customer_id = c.customer_id)
                                        Index Searches: 0
        ->  Hash  (cost=37.45..37.45 rows=130 width=384) (never executed)
              ->  Hash Left Join  (cost=23.50..37.45 rows=130 width=384) (never executed)
                    Hash Cond: (reversal.original_transaction_id = original.transaction_id)
                    ->  Hash Right Join  (cost=11.93..23.58 rows=130 width=250) (never executed)
                          Hash Cond: (reversal.reversal_transaction_id = t.transaction_id)
                          ->  Seq Scan on transaction_reversal reversal  (cost=0.00..11.30 rows=130 width=32) (never executed)
                          ->  Hash  (cost=11.05..11.05 rows=70 width=234) (never executed)
                                ->  Seq Scan on transaction t  (cost=0.00..11.05 rows=70 width=234) (never executed)
                    ->  Hash  (cost=10.70..10.70 rows=70 width=134) (never executed)
                          ->  Seq Scan on transaction original  (cost=0.00..10.70 rows=70 width=134) (never executed)
  ->  Memoize  (cost=16.92..16.93 rows=1 width=32) (never executed)
        Cache Key: t.balance_after, t.account_id, t.ledger_seq
        Cache Mode: binary
        ->  Aggregate  (cost=16.91..16.92 rows=1 width=32) (never executed)
              ->  Result  (cost=0.43..16.88 rows=2 width=254) (never executed)
                    One-Time Filter: (t.balance_after IS NULL)
                    ->  Nested Loop Left Join  (cost=0.43..16.88 rows=2 width=254) (never executed)
                          ->  Index Scan using ux_transaction_account_ledger_seq on transaction t_1  (cost=0.14..8.16 rows=1 width=152) (never executed)
                                Index Cond: ((account_id = t.account_id) AND (ledger_seq <= t.ledger_seq))
                                Index Searches: 0
                          ->  Nested Loop Left Join  (cost=0.29..8.70 rows=1 width=134) (never executed)
                                ->  Index Scan using transaction_reversal_reversal_transaction_id_key on transaction_reversal reversal_1  (cost=0.14..8.16 rows=1 width=32) (never executed)
                                      Index Cond: (reversal_transaction_id = t_1.transaction_id)
                                      Index Searches: 0
                                ->  Index Scan using transaction_pkey on transaction original_1  (cost=0.14..0.53 rows=1 width=134) (never executed)
                                      Index Cond: (transaction_id = reversal_1.original_transaction_id)
                                      Index Searches: 0
Planning:
  Buffers: shared hit=1060
Planning Time: 1.460 ms
Execution Time: 0.194 ms
```
### Index Created
`CREATE INDEX ix_txn_account_date ON transaction (account_id, transaction_date);`

## RPT-03: Active FDs
### Query
```sql
SELECT * FROM vw_rpt03_active_fds
```
### Before Index
```
GroupAggregate  (cost=36.82..37.94 rows=4 width=828) (actual time=0.201..0.210 rows=10.00 loops=1)
  Group Key: fd.fd_id, a.account_number, b.branch_name, fp.plan_name
  Buffers: shared hit=196
  ->  Sort  (cost=36.82..36.83 rows=4 width=1094) (actual time=0.067..0.069 rows=13.00 loops=1)
        Sort Key: fd.fd_id, a.account_number, b.branch_name, fp.plan_name, ah.joined_date
        Sort Method: quicksort  Memory: 27kB
        Buffers: shared hit=81
        ->  Nested Loop Left Join  (cost=21.22..36.78 rows=4 width=1094) (actual time=0.034..0.051 rows=13.00 loops=1)
              Buffers: shared hit=72
              ->  Nested Loop Left Join  (cost=21.08..35.80 rows=4 width=792) (actual time=0.031..0.043 rows=13.00 loops=1)
                    Buffers: shared hit=46
                    ->  Nested Loop  (cost=20.93..34.95 rows=2 width=772) (actual time=0.027..0.034 rows=10.00 loops=1)
                          Buffers: shared hit=26
                          ->  Hash Join  (cost=20.79..34.24 rows=2 width=554) (actual time=0.024..0.027 rows=10.00 loops=1)
                                Hash Cond: (a.account_id = fd.account_id)
                                Buffers: shared hit=6
                                ->  Seq Scan on account a  (cost=0.00..12.50 rows=250 width=150) (actual time=0.002..0.003 rows=10.00 loops=1)
                                      Buffers: shared hit=3
                                ->  Hash  (cost=20.77..20.77 rows=2 width=404) (actual time=0.019..0.020 rows=10.00 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 10kB
                                      Buffers: shared hit=3
                                      ->  Hash Join  (cost=9.52..20.77 rows=2 width=404) (actual time=0.017..0.019 rows=10.00 loops=1)
                                            Hash Cond: (fp.fd_plan_id = fd.fd_plan_id)
                                            Buffers: shared hit=3
                                            ->  Seq Scan on fd_plan fp  (cost=0.00..10.90 rows=90 width=238) (actual time=0.003..0.003 rows=3.00 loops=1)
                                                  Buffers: shared hit=1
                                            ->  Hash  (cost=9.49..9.49 rows=2 width=182) (actual time=0.011..0.011 rows=10.00 loops=1)
                                                  Buckets: 1024  Batches: 1  Memory Usage: 10kB
                                                  Buffers: shared hit=2
                                                  ->  Bitmap Heap Scan on fixed_deposit fd  (cost=4.15..9.49 rows=2 width=182) (actual time=0.008..0.009 rows=10.00 loops=1)
                                                        Recheck Cond: ((status)::text = 'ACTIVE'::text)
                                                        Heap Blocks: exact=1
                                                        Buffers: shared hit=2
                                                        ->  Bitmap Index Scan on ix_fd_due_interest  (cost=0.00..4.15 rows=2 width=0) (actual time=0.001..0.001 rows=10.00 loops=1)
                                                              Index Searches: 1
                                                              Buffers: shared hit=1
                          ->  Index Scan using branch_pkey on branch b  (cost=0.14..0.35 rows=1 width=234) (actual time=0.000..0.000 rows=1.00 loops=10)
                                Index Cond: (branch_id = a.branch_id)
                                Index Searches: 10
                                Buffers: shared hit=20
                    ->  Index Scan using uq_account_holder_account_customer on account_holder ah  (cost=0.15..0.39 rows=3 width=52) (actual time=0.001..0.001 rows=1.30 loops=10)
                          Index Cond: (account_id = a.account_id)
                          Index Searches: 10
                          Buffers: shared hit=20
              ->  Index Scan using customer_pkey on customer c  (cost=0.14..0.24 rows=1 width=334) (actual time=0.000..0.000 rows=1.00 loops=13)
                    Index Cond: (customer_id = ah.customer_id)
                    Index Searches: 13
                    Buffers: shared hit=26
Planning:
  Buffers: shared hit=258
Planning Time: 0.448 ms
Execution Time: 0.473 ms
```
### After Index
```
GroupAggregate  (cost=36.82..37.94 rows=4 width=828) (actual time=0.195..0.204 rows=10.00 loops=1)
  Group Key: fd.fd_id, a.account_number, b.branch_name, fp.plan_name
  Buffers: shared hit=196
  ->  Sort  (cost=36.82..36.83 rows=4 width=1094) (actual time=0.063..0.064 rows=13.00 loops=1)
        Sort Key: fd.fd_id, a.account_number, b.branch_name, fp.plan_name, ah.joined_date
        Sort Method: quicksort  Memory: 27kB
        Buffers: shared hit=81
        ->  Nested Loop Left Join  (cost=21.22..36.78 rows=4 width=1094) (actual time=0.029..0.047 rows=13.00 loops=1)
              Buffers: shared hit=72
              ->  Nested Loop Left Join  (cost=21.08..35.80 rows=4 width=792) (actual time=0.027..0.039 rows=13.00 loops=1)
                    Buffers: shared hit=46
                    ->  Nested Loop  (cost=20.93..34.95 rows=2 width=772) (actual time=0.025..0.032 rows=10.00 loops=1)
                          Buffers: shared hit=26
                          ->  Hash Join  (cost=20.79..34.24 rows=2 width=554) (actual time=0.022..0.025 rows=10.00 loops=1)
                                Hash Cond: (a.account_id = fd.account_id)
                                Buffers: shared hit=6
                                ->  Seq Scan on account a  (cost=0.00..12.50 rows=250 width=150) (actual time=0.002..0.003 rows=10.00 loops=1)
                                      Buffers: shared hit=3
                                ->  Hash  (cost=20.77..20.77 rows=2 width=404) (actual time=0.017..0.018 rows=10.00 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 10kB
                                      Buffers: shared hit=3
                                      ->  Hash Join  (cost=9.52..20.77 rows=2 width=404) (actual time=0.015..0.017 rows=10.00 loops=1)
                                            Hash Cond: (fp.fd_plan_id = fd.fd_plan_id)
                                            Buffers: shared hit=3
                                            ->  Seq Scan on fd_plan fp  (cost=0.00..10.90 rows=90 width=238) (actual time=0.001..0.001 rows=3.00 loops=1)
                                                  Buffers: shared hit=1
                                            ->  Hash  (cost=9.49..9.49 rows=2 width=182) (actual time=0.011..0.011 rows=10.00 loops=1)
                                                  Buckets: 1024  Batches: 1  Memory Usage: 10kB
                                                  Buffers: shared hit=2
                                                  ->  Bitmap Heap Scan on fixed_deposit fd  (cost=4.15..9.49 rows=2 width=182) (actual time=0.008..0.008 rows=10.00 loops=1)
                                                        Recheck Cond: ((status)::text = 'ACTIVE'::text)
                                                        Heap Blocks: exact=1
                                                        Buffers: shared hit=2
                                                        ->  Bitmap Index Scan on ix_fd_due_interest  (cost=0.00..4.15 rows=2 width=0) (actual time=0.001..0.001 rows=10.00 loops=1)
                                                              Index Searches: 1
                                                              Buffers: shared hit=1
                          ->  Index Scan using branch_pkey on branch b  (cost=0.14..0.35 rows=1 width=234) (actual time=0.000..0.000 rows=1.00 loops=10)
                                Index Cond: (branch_id = a.branch_id)
                                Index Searches: 10
                                Buffers: shared hit=20
                    ->  Index Scan using uq_account_holder_account_customer on account_holder ah  (cost=0.15..0.39 rows=3 width=52) (actual time=0.000..0.001 rows=1.30 loops=10)
                          Index Cond: (account_id = a.account_id)
                          Index Searches: 10
                          Buffers: shared hit=20
              ->  Index Scan using customer_pkey on customer c  (cost=0.14..0.24 rows=1 width=334) (actual time=0.000..0.000 rows=1.00 loops=13)
                    Index Cond: (customer_id = ah.customer_id)
                    Index Searches: 13
                    Buffers: shared hit=26
Planning:
  Buffers: shared hit=264
Planning Time: 0.465 ms
Execution Time: 0.487 ms
```
### Index Created
`CREATE INDEX ix_fd_due_interest ON fixed_deposit (status, next_interest_date);`

## RPT-04: Interest Distribution
### Query
```sql
SELECT * FROM vw_rpt04_interest_distribution
```
### Before Index
```
GroupAggregate  (cost=149.38..216.40 rows=2391 width=874) (actual time=0.094..0.106 rows=22.00 loops=1)
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name, fp.plan_name, a.branch_id, b.branch_name
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name, fp.plan_name
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date))
  Group Key: ()
  Buffers: shared hit=12
  ->  Sort  (cost=149.38..150.98 rows=640 width=772) (actual time=0.088..0.089 rows=10.00 loops=1)
        Sort Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name, fp.plan_name, a.branch_id, b.branch_name
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=12
        ->  Hash Join  (cost=89.70..119.55 rows=640 width=772) (actual time=0.067..0.074 rows=10.00 loops=1)
              Hash Cond: (a.plan_id = sp.plan_id)
              Buffers: shared hit=9
              ->  Hash Join  (cost=77.90..102.83 rows=640 width=506) (actual time=0.061..0.066 rows=10.00 loops=1)
                    Hash Cond: (a.branch_id = b.branch_id)
                    Buffers: shared hit=8
                    ->  Hash Join  (cost=66.32..89.55 rows=640 width=288) (actual time=0.056..0.060 rows=10.00 loops=1)
                          Hash Cond: (fd.account_id = a.account_id)
                          Buffers: shared hit=7
                          ->  Hash Join  (cost=50.70..72.21 rows=640 width=272) (actual time=0.044..0.047 rows=10.00 loops=1)
                                Hash Cond: (fd.fd_plan_id = fp.fd_plan_id)
                                Buffers: shared hit=4
                                ->  Hash Join  (cost=38.67..58.47 rows=640 width=70) (actual time=0.031..0.033 rows=10.00 loops=1)
                                      Hash Cond: (ip.fd_id = fd.fd_id)
                                      Buffers: shared hit=3
                                      ->  Hash Join  (cost=20.57..38.67 rows=640 width=54) (actual time=0.016..0.018 rows=10.00 loops=1)
                                            Hash Cond: (ip.interest_run_id = ir.run_id)
                                            Buffers: shared hit=2
                                            ->  Seq Scan on interest_payout ip  (cost=0.00..16.40 rows=640 width=66) (actual time=0.003..0.004 rows=10.00 loops=1)
                                                  Buffers: shared hit=1
                                            ->  Hash  (cost=14.70..14.70 rows=470 width=20) (actual time=0.003..0.003 rows=1.00 loops=1)
                                                  Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                                  Buffers: shared hit=1
                                                  ->  Seq Scan on interest_run ir  (cost=0.00..14.70 rows=470 width=20) (actual time=0.002..0.002 rows=1.00 loops=1)
                                                        Buffers: shared hit=1
                                      ->  Hash  (cost=13.60..13.60 rows=360 width=48) (actual time=0.004..0.004 rows=10.00 loops=1)
                                            Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                            Buffers: shared hit=1
                                            ->  Seq Scan on fixed_deposit fd  (cost=0.00..13.60 rows=360 width=48) (actual time=0.001..0.001 rows=10.00 loops=1)
                                                  Buffers: shared hit=1
                                ->  Hash  (cost=10.90..10.90 rows=90 width=234) (actual time=0.003..0.003 rows=3.00 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                      Buffers: shared hit=1
                                      ->  Seq Scan on fd_plan fp  (cost=0.00..10.90 rows=90 width=234) (actual time=0.002..0.002 rows=3.00 loops=1)
                                            Buffers: shared hit=1
                          ->  Hash  (cost=12.50..12.50 rows=250 width=48) (actual time=0.004..0.004 rows=10.00 loops=1)
                                Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                Buffers: shared hit=3
                                ->  Seq Scan on account a  (cost=0.00..12.50 rows=250 width=48) (actual time=0.001..0.002 rows=10.00 loops=1)
                                      Buffers: shared hit=3
                    ->  Hash  (cost=10.70..10.70 rows=70 width=234) (actual time=0.005..0.005 rows=3.00 loops=1)
                          Buckets: 1024  Batches: 1  Memory Usage: 9kB
                          Buffers: shared hit=1
                          ->  Seq Scan on branch b  (cost=0.00..10.70 rows=70 width=234) (actual time=0.001..0.001 rows=3.00 loops=1)
                                Buffers: shared hit=1
              ->  Hash  (cost=10.80..10.80 rows=80 width=234) (actual time=0.004..0.004 rows=5.00 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 9kB
                    Buffers: shared hit=1
                    ->  Seq Scan on savings_plan sp  (cost=0.00..10.80 rows=80 width=234) (actual time=0.002..0.003 rows=5.00 loops=1)
                          Buffers: shared hit=1
Planning:
  Buffers: shared hit=175
Planning Time: 0.444 ms
Execution Time: 0.136 ms
```
### After Index
```
GroupAggregate  (cost=149.38..216.40 rows=2391 width=874) (actual time=0.099..0.113 rows=22.00 loops=1)
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name, fp.plan_name, a.branch_id, b.branch_name
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name, fp.plan_name
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name
  Group Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date))
  Group Key: ()
  Buffers: shared hit=12
  ->  Sort  (cost=149.38..150.98 rows=640 width=772) (actual time=0.093..0.095 rows=10.00 loops=1)
        Sort Key: ir.cycle_date, (EXTRACT(year FROM ir.cycle_date)), (EXTRACT(month FROM ir.cycle_date)), sp.plan_name, fp.plan_name, a.branch_id, b.branch_name
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=12
        ->  Hash Join  (cost=89.70..119.55 rows=640 width=772) (actual time=0.071..0.079 rows=10.00 loops=1)
              Hash Cond: (a.plan_id = sp.plan_id)
              Buffers: shared hit=9
              ->  Hash Join  (cost=77.90..102.83 rows=640 width=506) (actual time=0.065..0.070 rows=10.00 loops=1)
                    Hash Cond: (a.branch_id = b.branch_id)
                    Buffers: shared hit=8
                    ->  Hash Join  (cost=66.32..89.55 rows=640 width=288) (actual time=0.058..0.063 rows=10.00 loops=1)
                          Hash Cond: (fd.account_id = a.account_id)
                          Buffers: shared hit=7
                          ->  Hash Join  (cost=50.70..72.21 rows=640 width=272) (actual time=0.045..0.049 rows=10.00 loops=1)
                                Hash Cond: (fd.fd_plan_id = fp.fd_plan_id)
                                Buffers: shared hit=4
                                ->  Hash Join  (cost=38.67..58.47 rows=640 width=70) (actual time=0.032..0.035 rows=10.00 loops=1)
                                      Hash Cond: (ip.fd_id = fd.fd_id)
                                      Buffers: shared hit=3
                                      ->  Hash Join  (cost=20.57..38.67 rows=640 width=54) (actual time=0.016..0.018 rows=10.00 loops=1)
                                            Hash Cond: (ip.interest_run_id = ir.run_id)
                                            Buffers: shared hit=2
                                            ->  Seq Scan on interest_payout ip  (cost=0.00..16.40 rows=640 width=66) (actual time=0.003..0.004 rows=10.00 loops=1)
                                                  Buffers: shared hit=1
                                            ->  Hash  (cost=14.70..14.70 rows=470 width=20) (actual time=0.004..0.004 rows=1.00 loops=1)
                                                  Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                                  Buffers: shared hit=1
                                                  ->  Seq Scan on interest_run ir  (cost=0.00..14.70 rows=470 width=20) (actual time=0.002..0.002 rows=1.00 loops=1)
                                                        Buffers: shared hit=1
                                      ->  Hash  (cost=13.60..13.60 rows=360 width=48) (actual time=0.004..0.004 rows=10.00 loops=1)
                                            Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                            Buffers: shared hit=1
                                            ->  Seq Scan on fixed_deposit fd  (cost=0.00..13.60 rows=360 width=48) (actual time=0.001..0.001 rows=10.00 loops=1)
                                                  Buffers: shared hit=1
                                ->  Hash  (cost=10.90..10.90 rows=90 width=234) (actual time=0.003..0.003 rows=3.00 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                      Buffers: shared hit=1
                                      ->  Seq Scan on fd_plan fp  (cost=0.00..10.90 rows=90 width=234) (actual time=0.002..0.002 rows=3.00 loops=1)
                                            Buffers: shared hit=1
                          ->  Hash  (cost=12.50..12.50 rows=250 width=48) (actual time=0.004..0.004 rows=10.00 loops=1)
                                Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                Buffers: shared hit=3
                                ->  Seq Scan on account a  (cost=0.00..12.50 rows=250 width=48) (actual time=0.001..0.002 rows=10.00 loops=1)
                                      Buffers: shared hit=3
                    ->  Hash  (cost=10.70..10.70 rows=70 width=234) (actual time=0.005..0.005 rows=3.00 loops=1)
                          Buckets: 1024  Batches: 1  Memory Usage: 9kB
                          Buffers: shared hit=1
                          ->  Seq Scan on branch b  (cost=0.00..10.70 rows=70 width=234) (actual time=0.001..0.001 rows=3.00 loops=1)
                                Buffers: shared hit=1
              ->  Hash  (cost=10.80..10.80 rows=80 width=234) (actual time=0.004..0.004 rows=5.00 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 9kB
                    Buffers: shared hit=1
                    ->  Seq Scan on savings_plan sp  (cost=0.00..10.80 rows=80 width=234) (actual time=0.002..0.003 rows=5.00 loops=1)
                          Buffers: shared hit=1
Planning:
  Buffers: shared hit=192
Planning Time: 0.467 ms
Execution Time: 0.145 ms
```
### Index Created
`CREATE INDEX ix_payout_cycle ON interest_payout (cycle_date);`

## RPT-05: Customer Activity
### Query
```sql
SELECT * FROM vw_rpt05_customer_activity
```
### Before Index
```
Hash Left Join  (cost=36.17..2381.81 rows=418 width=884) (actual time=0.006..0.007 rows=0.00 loops=1)
  Hash Cond: (a.account_id = t.account_id)
  Buffers: shared hit=1
  ->  Nested Loop Left Join  (cost=0.29..2340.07 rows=418 width=574) (actual time=0.006..0.006 rows=0.00 loops=1)
        Buffers: shared hit=1
        ->  Seq Scan on customer c  (cost=0.00..13.44 rows=38 width=350) (actual time=0.006..0.006 rows=0.00 loops=1)
              Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (app_user_id IS NOT NULL) AND (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)))
              Rows Removed by Filter: 15
              Buffers: shared hit=1
        ->  Nested Loop Left Join  (cost=0.29..61.20 rows=3 width=240) (never executed)
              ->  Index Scan using ix_account_holder_customer on account_holder ah  (cost=0.15..1.47 rows=3 width=32) (never executed)
                    Index Cond: (customer_id = c.customer_id)
                    Index Searches: 0
              ->  Index Scan using account_pkey on account a  (cost=0.14..19.84 rows=1 width=224) (never executed)
                    Index Cond: (account_id = ah.account_id)
                    Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (ANY (account_id = (hashed SubPlan 2).col1))))
                    Index Searches: 0
                    SubPlan 2
                      ->  Nested Loop  (cost=4.32..19.54 rows=11 width=16) (never executed)
                            ->  Index Scan using uq_customer_app_user_id on customer c_1  (cost=0.15..8.23 rows=1 width=16) (never executed)
                                  Index Cond: (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)
                                  Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (app_user_id IS NOT NULL) AND (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)))
                                  Index Searches: 0
                            ->  Bitmap Heap Scan on account_holder ah_1  (cost=4.17..11.28 rows=3 width=32) (never executed)
                                  Recheck Cond: (c_1.customer_id = customer_id)
                                  ->  Bitmap Index Scan on ix_account_holder_customer  (cost=0.00..4.17 rows=3 width=0) (never executed)
                                        Index Cond: (customer_id = c_1.customer_id)
                                        Index Searches: 0
  ->  Hash  (cost=35.00..35.00 rows=70 width=294) (never executed)
        ->  Hash Left Join  (cost=23.15..35.00 rows=70 width=294) (never executed)
              Hash Cond: (reversal.original_transaction_id = original.transaction_id)
              ->  Hash Right Join  (cost=11.57..23.23 rows=70 width=192) (never executed)
                    Hash Cond: (reversal.reversal_transaction_id = t.transaction_id)
                    ->  Seq Scan on transaction_reversal reversal  (cost=0.00..11.30 rows=130 width=32) (never executed)
                    ->  Hash  (cost=10.70..10.70 rows=70 width=176) (never executed)
                          ->  Seq Scan on transaction t  (cost=0.00..10.70 rows=70 width=176) (never executed)
              ->  Hash  (cost=10.70..10.70 rows=70 width=134) (never executed)
                    ->  Seq Scan on transaction original  (cost=0.00..10.70 rows=70 width=134) (never executed)
Planning:
  Buffers: shared hit=7
Planning Time: 0.450 ms
Execution Time: 0.029 ms
```
### After Index
```
Hash Left Join  (cost=36.17..2381.81 rows=418 width=884) (actual time=0.006..0.007 rows=0.00 loops=1)
  Hash Cond: (a.account_id = t.account_id)
  Buffers: shared hit=1
  ->  Nested Loop Left Join  (cost=0.29..2340.07 rows=418 width=574) (actual time=0.006..0.006 rows=0.00 loops=1)
        Buffers: shared hit=1
        ->  Seq Scan on customer c  (cost=0.00..13.44 rows=38 width=350) (actual time=0.006..0.006 rows=0.00 loops=1)
              Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (app_user_id IS NOT NULL) AND (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)))
              Rows Removed by Filter: 15
              Buffers: shared hit=1
        ->  Nested Loop Left Join  (cost=0.29..61.20 rows=3 width=240) (never executed)
              ->  Index Scan using ix_account_holder_customer on account_holder ah  (cost=0.15..1.47 rows=3 width=32) (never executed)
                    Index Cond: (customer_id = c.customer_id)
                    Index Searches: 0
              ->  Index Scan using account_pkey on account a  (cost=0.14..19.84 rows=1 width=224) (never executed)
                    Index Cond: (account_id = ah.account_id)
                    Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (ANY (account_id = (hashed SubPlan 2).col1))))
                    Index Searches: 0
                    SubPlan 2
                      ->  Nested Loop  (cost=4.32..19.54 rows=11 width=16) (never executed)
                            ->  Index Scan using uq_customer_app_user_id on customer c_1  (cost=0.15..8.23 rows=1 width=16) (never executed)
                                  Index Cond: (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)
                                  Filter: (COALESCE((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{ADMIN,CENTRAL_OPS,AUDITOR}'::text[])), false) OR COALESCE(((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = ANY ('{AGENT,BRANCH_MANAGER}'::text[])) AND ((NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid IS NOT NULL) AND (branch_id = (NULLIF(current_setting('app.current_branch_id'::text, true), ''::text))::uuid)), false) OR ((NULLIF(current_setting('app.current_user_role'::text, true), ''::text) = 'CUSTOMER'::text) AND (app_user_id IS NOT NULL) AND (app_user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)))
                                  Index Searches: 0
                            ->  Bitmap Heap Scan on account_holder ah_1  (cost=4.17..11.28 rows=3 width=32) (never executed)
                                  Recheck Cond: (c_1.customer_id = customer_id)
                                  ->  Bitmap Index Scan on ix_account_holder_customer  (cost=0.00..4.17 rows=3 width=0) (never executed)
                                        Index Cond: (customer_id = c_1.customer_id)
                                        Index Searches: 0
  ->  Hash  (cost=35.00..35.00 rows=70 width=294) (never executed)
        ->  Hash Left Join  (cost=23.15..35.00 rows=70 width=294) (never executed)
              Hash Cond: (reversal.original_transaction_id = original.transaction_id)
              ->  Hash Right Join  (cost=11.57..23.23 rows=70 width=192) (never executed)
                    Hash Cond: (reversal.reversal_transaction_id = t.transaction_id)
                    ->  Seq Scan on transaction_reversal reversal  (cost=0.00..11.30 rows=130 width=32) (never executed)
                    ->  Hash  (cost=10.70..10.70 rows=70 width=176) (never executed)
                          ->  Seq Scan on transaction t  (cost=0.00..10.70 rows=70 width=176) (never executed)
              ->  Hash  (cost=10.70..10.70 rows=70 width=134) (never executed)
                    ->  Seq Scan on transaction original  (cost=0.00..10.70 rows=70 width=134) (never executed)
Planning:
  Buffers: shared hit=7
Planning Time: 0.454 ms
Execution Time: 0.030 ms
```
### Index Created
`CREATE INDEX ix_txn_account_date ON transaction (account_id, transaction_date);`
