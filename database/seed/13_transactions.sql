-- Seed Set 4: Financial transactions
DO $$
DECLARE
    v_branch_counter uuid := (SELECT channel_id FROM transaction_channel WHERE channel_name = 'BRANCH_COUNTER');
    v_online uuid := (SELECT channel_id FROM transaction_channel WHERE channel_name = 'ONLINE');
    v_system uuid := (SELECT channel_id FROM transaction_channel WHERE channel_name = 'SYSTEM');
    v_tx_id uuid;
    v_signers uuid[];
    v_agent_id uuid;
    v_branch_id uuid;
    v_out_tx_id uuid;
    v_out_ref varchar;
    v_out_bal numeric;
    v_out_posted timestamptz;
BEGIN
    -- Temporarily open business hours for seeding regardless of system time
    UPDATE system_parameter SET param_value = '00:00' WHERE param_key = 'BUSINESS_HOUR_START';
    UPDATE system_parameter SET param_value = '23:59' WHERE param_key = 'BUSINESS_HOUR_END';
    -- Temporarily bump withdrawal limits to allow all seed transactions to run on the same day
    UPDATE system_parameter SET param_value = '999999999.00' WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT';
    UPDATE system_parameter SET param_value = '999999999.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT';
    -- Seed Set 4: Financial transactions
    -- Posted through sp_post_deposit / sp_post_withdrawal to maintain balance integrity
    -- Day: 2025-07-01
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000002'::uuid, 3377.48, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0001'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-01
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000003';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000003'::uuid, 19681.86, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0002'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-01
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 2780.21, v_branch_counter, v_agent_id, 'seed-txn-0003'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-01
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 14604.37, v_branch_counter, v_agent_id, 'seed-txn-0004'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-02
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 12196.05, v_branch_counter, v_agent_id, 'seed-txn-0005'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-02
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000001';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000001'::uuid, 2881.75, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0006'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-02
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000003';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000003'::uuid, 4424.38, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0007'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-02
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 17102.39, v_branch_counter, v_agent_id, 'seed-txn-0008'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-03
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000010';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000010'::uuid, 7250.02, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0009'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-03
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000009';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000009'::uuid, 11893.14, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0010'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-03
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000009';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000009'::uuid, 15438.15, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0011'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-03
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000006';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000006'::uuid, 3799.36, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0012'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-04
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000004';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000004'::uuid, 20858.43, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0013'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-04
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 13078.0, v_branch_counter, v_agent_id, 'seed-txn-0014'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-04
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000006'::uuid, 4980.63, v_branch_counter, v_agent_id, 'seed-txn-0015'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-04
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000005';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000005'::uuid, 17100.45, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0016'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-05
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 6129.01, v_branch_counter, v_agent_id, 'seed-txn-0017'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-05
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000009';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000009'::uuid, 14350.06, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0018'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-05
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000001';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000001'::uuid, 4975.35, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0019'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-05
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000007'::uuid, 18349.59, v_branch_counter, v_agent_id, 'seed-txn-0020'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-06
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000010'::uuid, 10485.39, v_branch_counter, v_agent_id, 'seed-txn-0021'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-06
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000008' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000008'::uuid, 5685.92, v_branch_counter, v_agent_id, 'seed-txn-0022'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-06
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000009';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000009'::uuid, 4466.16, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0023'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-06
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000010'::uuid, 19949.19, v_branch_counter, v_agent_id, 'seed-txn-0024'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-07
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000003'::uuid, 1895.21, v_branch_counter, v_agent_id, 'seed-txn-0025'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-07
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000002'::uuid, 21523.02, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0026'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-07
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000007'::uuid, 12321.88, v_branch_counter, v_agent_id, 'seed-txn-0027'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-07
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000008' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000008';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000008'::uuid, 19301.98, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0028'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-08
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000001';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000001'::uuid, 2149.28, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0029'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-08
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000005'::uuid, 9260.54, v_branch_counter, v_agent_id, 'seed-txn-0030'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-08
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000008' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000008';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000008'::uuid, 11178.37, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0031'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-08
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000005'::uuid, 3021.81, v_branch_counter, v_agent_id, 'seed-txn-0032'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-09
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000005'::uuid, 15487.71, v_branch_counter, v_agent_id, 'seed-txn-0033'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-09
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 10283.51, v_branch_counter, v_agent_id, 'seed-txn-0034'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-09
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000002'::uuid, 13623.72, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0035'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-09
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000005'::uuid, 17682.18, v_branch_counter, v_agent_id, 'seed-txn-0036'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-10
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000002'::uuid, 7818.25, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0037'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-10
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 10030.37, v_branch_counter, v_agent_id, 'seed-txn-0038'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-10
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 17576.23, v_branch_counter, v_agent_id, 'seed-txn-0039'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-10
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000007';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000007'::uuid, 22656.26, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0040'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-11
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 13762.05, v_branch_counter, v_agent_id, 'seed-txn-0041'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-11
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000006';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000006'::uuid, 33273.67, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0042'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-11
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 1399.65, v_branch_counter, v_agent_id, 'seed-txn-0043'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-11
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 1136.63, v_branch_counter, v_agent_id, 'seed-txn-0044'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-12
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000001'::uuid, 1596.85, v_branch_counter, v_agent_id, 'seed-txn-0045'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-12
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000006'::uuid, 6291.07, v_branch_counter, v_agent_id, 'seed-txn-0046'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-12
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000008' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000008'::uuid, 14743.7, v_branch_counter, v_agent_id, 'seed-txn-0047'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-12
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000010'::uuid, 9986.49, v_branch_counter, v_agent_id, 'seed-txn-0048'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-13
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000007'::uuid, 13520.67, v_branch_counter, v_agent_id, 'seed-txn-0049'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-13
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000006'::uuid, 17412.9, v_branch_counter, v_agent_id, 'seed-txn-0050'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-13
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000001'::uuid, 14836.06, v_branch_counter, v_agent_id, 'seed-txn-0051'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-13
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 11189.43, v_branch_counter, v_agent_id, 'seed-txn-0052'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-14
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000003'::uuid, 9789.93, v_branch_counter, v_agent_id, 'seed-txn-0053'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-14
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000002'::uuid, 9619.28, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0054'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-14
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000002'::uuid, 3659.27, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0055'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-14
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000001';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000001'::uuid, 9167.95, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0056'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-15
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000003'::uuid, 5061.2, v_branch_counter, v_agent_id, 'seed-txn-0057'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-15
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000007'::uuid, 1040.95, v_branch_counter, v_agent_id, 'seed-txn-0058'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-15
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000007';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000007'::uuid, 20354.68, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0059'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-15
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000005';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000005'::uuid, 81714.58, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0060'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-16
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 6637.45, v_branch_counter, v_agent_id, 'seed-txn-0061'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-16
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000001';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000001'::uuid, 821.8, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0062'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-16
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000010'::uuid, 17201.68, v_branch_counter, v_agent_id, 'seed-txn-0063'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-16
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000003';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000003'::uuid, 1927.59, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0064'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-17
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000003'::uuid, 13829.04, v_branch_counter, v_agent_id, 'seed-txn-0065'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-17
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 17915.46, v_branch_counter, v_agent_id, 'seed-txn-0066'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-17
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000004';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000004'::uuid, 14324.38, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0067'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-17
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000010';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000010'::uuid, 7533.94, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0068'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-18
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000006'::uuid, 3486.69, v_branch_counter, v_agent_id, 'seed-txn-0069'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-18
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000005'::uuid, 15285.43, v_branch_counter, v_agent_id, 'seed-txn-0070'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-18
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 19970.63, v_branch_counter, v_agent_id, 'seed-txn-0071'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-18
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 10611.81, v_branch_counter, v_agent_id, 'seed-txn-0072'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-19
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000003';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000003'::uuid, 21400.94, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0073'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-19
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000006'::uuid, 16841.15, v_branch_counter, v_agent_id, 'seed-txn-0074'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-19
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000005';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000005'::uuid, 43737.53, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0075'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-19
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 17904.54, v_branch_counter, v_agent_id, 'seed-txn-0076'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-20
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 12491.77, v_branch_counter, v_agent_id, 'seed-txn-0077'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-20
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000006';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000006'::uuid, 67001.36, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0078'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-20
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 18255.02, v_branch_counter, v_agent_id, 'seed-txn-0079'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-20
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000001';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000001'::uuid, 4827.86, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0080'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-21
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000001'::uuid, 3485.57, v_branch_counter, v_agent_id, 'seed-txn-0081'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-21
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000005';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000005'::uuid, 31445.16, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0082'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-21
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000007'::uuid, 18955.97, v_branch_counter, v_agent_id, 'seed-txn-0083'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-21
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000003';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000003'::uuid, 8113.58, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0084'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-22
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000003'::uuid, 6856.91, v_branch_counter, v_agent_id, 'seed-txn-0085'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-22
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000001'::uuid, 5741.07, v_branch_counter, v_agent_id, 'seed-txn-0086'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-22
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000002';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000002'::uuid, 25483.87, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0087'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-22
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000007';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000007'::uuid, 6321.15, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0088'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-23
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000003';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000003'::uuid, 808.39, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0089'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-23
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000006';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000006'::uuid, 38924.08, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0090'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-23
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 14324.29, v_branch_counter, v_agent_id, 'seed-txn-0091'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-23
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000007';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000007'::uuid, 5266.42, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0092'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-24
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000008' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000008'::uuid, 16111.56, v_branch_counter, v_agent_id, 'seed-txn-0093'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-24
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 4669.47, v_branch_counter, v_agent_id, 'seed-txn-0094'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-24
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000006';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000006'::uuid, 24678.98, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0095'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-24
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000005';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000005'::uuid, 16635.01, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0096'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-25
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000009';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000009'::uuid, 5716.88, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0097'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-25
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000005'::uuid, 19687.46, v_branch_counter, v_agent_id, 'seed-txn-0098'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-25
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000001'::uuid, 7568.06, v_branch_counter, v_agent_id, 'seed-txn-0099'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-25
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000006';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000006'::uuid, 6978.45, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0100'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-26
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000007'::uuid, 14466.92, v_branch_counter, v_agent_id, 'seed-txn-0101'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-26
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000001'::uuid, 2329.5, v_branch_counter, v_agent_id, 'seed-txn-0102'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-26
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000006' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000006';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000006'::uuid, 1643.84, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0103'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-26
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000005';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000005'::uuid, 14165.82, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0104'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-27
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000005' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000005'::uuid, 13633.66, v_branch_counter, v_agent_id, 'seed-txn-0105'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-27
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000007' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000007';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000007'::uuid, 8333.34, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0106'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-27
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 4993.47, v_branch_counter, v_agent_id, 'seed-txn-0107'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-27
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000010'::uuid, 9401.04, v_branch_counter, v_agent_id, 'seed-txn-0108'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-28
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000004';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000004'::uuid, 34392.38, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0109'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-28
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000003' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000003'::uuid, 13613.22, v_branch_counter, v_agent_id, 'seed-txn-0110'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-28
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000010'::uuid, 19087.99, v_branch_counter, v_agent_id, 'seed-txn-0111'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-28
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 4783.47, v_branch_counter, v_agent_id, 'seed-txn-0112'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-29
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000001'::uuid, 10027.59, v_branch_counter, v_agent_id, 'seed-txn-0113'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-29
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 12965.54, v_branch_counter, v_agent_id, 'seed-txn-0114'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-29
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000004' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000004'::uuid, 5635.7, v_branch_counter, v_agent_id, 'seed-txn-0115'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-29
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000001' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000001';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000001'::uuid, 4303.54, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0116'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-30
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000009'::uuid, 5734.77, v_branch_counter, v_agent_id, 'seed-txn-0117'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-30
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000002' LIMIT 1;
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_deposit('00000000-0000-0000-0801-000000000002'::uuid, 9828.22, v_branch_counter, v_agent_id, 'seed-txn-0118'::varchar, 'Seed deposit'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-30
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000009' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000009';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000009'::uuid, 43052.61, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0119'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Day: 2025-07-30
    SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM account_holder ah JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE ah.account_id = '00000000-0000-0000-0801-000000000010' LIMIT 1;
    SELECT ARRAY_AGG(ah.customer_id)::uuid[] INTO v_signers FROM account_holder ah WHERE ah.account_id = '00000000-0000-0000-0801-000000000010';
    PERFORM set_config('app.current_user_id', v_agent_id::text, true);
    PERFORM set_config('app.current_user_role', 'AGENT', true);
    PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
    CALL sp_post_withdrawal('00000000-0000-0000-0801-000000000010'::uuid, 25107.07, v_branch_counter, v_agent_id, v_signers, 'seed-txn-0120'::varchar, 'Seed withdrawal'::varchar, v_out_tx_id, v_out_ref, v_out_bal, v_out_posted);
    -- Reversal on 2025-08-01
    v_tx_id := (SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0001');
    IF NOT EXISTS (SELECT 1 FROM transaction_reversal WHERE original_transaction_id = v_tx_id) THEN
        SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM transaction t JOIN account_holder ah ON ah.account_id = t.account_id JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE t.transaction_id = v_tx_id LIMIT 1;
        PERFORM set_config('app.current_user_id', v_agent_id::text, true);
        PERFORM set_config('app.current_user_role', 'AGENT', true);
        PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
        CALL sp_reverse_transaction(v_tx_id, 'Seed reversal'::varchar, v_agent_id, v_out_tx_id, v_out_ref, v_out_bal);
    END IF;
    -- Reversal on 2025-08-01
    v_tx_id := (SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0002');
    IF NOT EXISTS (SELECT 1 FROM transaction_reversal WHERE original_transaction_id = v_tx_id) THEN
        SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM transaction t JOIN account_holder ah ON ah.account_id = t.account_id JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE t.transaction_id = v_tx_id LIMIT 1;
        PERFORM set_config('app.current_user_id', v_agent_id::text, true);
        PERFORM set_config('app.current_user_role', 'AGENT', true);
        PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
        CALL sp_reverse_transaction(v_tx_id, 'Seed reversal'::varchar, v_agent_id, v_out_tx_id, v_out_ref, v_out_bal);
    END IF;
    -- Reversal on 2025-08-01
    v_tx_id := (SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0003');
    IF NOT EXISTS (SELECT 1 FROM transaction_reversal WHERE original_transaction_id = v_tx_id) THEN
        SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM transaction t JOIN account_holder ah ON ah.account_id = t.account_id JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE t.transaction_id = v_tx_id LIMIT 1;
        PERFORM set_config('app.current_user_id', v_agent_id::text, true);
        PERFORM set_config('app.current_user_role', 'AGENT', true);
        PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
        CALL sp_reverse_transaction(v_tx_id, 'Seed reversal'::varchar, v_agent_id, v_out_tx_id, v_out_ref, v_out_bal);
    END IF;
    -- Reversal on 2025-08-01
    v_tx_id := (SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0004');
    IF NOT EXISTS (SELECT 1 FROM transaction_reversal WHERE original_transaction_id = v_tx_id) THEN
        SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM transaction t JOIN account_holder ah ON ah.account_id = t.account_id JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE t.transaction_id = v_tx_id LIMIT 1;
        PERFORM set_config('app.current_user_id', v_agent_id::text, true);
        PERFORM set_config('app.current_user_role', 'AGENT', true);
        PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
        CALL sp_reverse_transaction(v_tx_id, 'Seed reversal'::varchar, v_agent_id, v_out_tx_id, v_out_ref, v_out_bal);
    END IF;
    -- Reversal on 2025-08-01
    v_tx_id := (SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0005');
    IF NOT EXISTS (SELECT 1 FROM transaction_reversal WHERE original_transaction_id = v_tx_id) THEN
        SELECT ca.agent_id, a.branch_id INTO v_agent_id, v_branch_id FROM transaction t JOIN account_holder ah ON ah.account_id = t.account_id JOIN customer_agent ca ON ca.customer_id = ah.customer_id JOIN agent a ON a.agent_id = ca.agent_id WHERE t.transaction_id = v_tx_id LIMIT 1;
        PERFORM set_config('app.current_user_id', v_agent_id::text, true);
        PERFORM set_config('app.current_user_role', 'AGENT', true);
        PERFORM set_config('app.current_branch_id', v_branch_id::text, true);
        CALL sp_reverse_transaction(v_tx_id, 'Seed reversal'::varchar, v_agent_id, v_out_tx_id, v_out_ref, v_out_bal);
    END IF;
    -- Revert business hours
    UPDATE system_parameter SET param_value = '08:00' WHERE param_key = 'BUSINESS_HOUR_START';
    UPDATE system_parameter SET param_value = '17:00' WHERE param_key = 'BUSINESS_HOUR_END';
    -- Revert limits
    UPDATE system_parameter SET param_value = '200000.00' WHERE param_key = 'WITHDRAWAL_DAILY_LIMIT';
    UPDATE system_parameter SET param_value = '100000.00' WHERE param_key = 'WITHDRAWAL_SINGLE_LIMIT';
END $$;
