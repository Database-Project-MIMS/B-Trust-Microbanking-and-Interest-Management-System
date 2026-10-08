/* PENDING M4 PROCEDURES: DO NOT UNCOMMENT YET
-- Seed Set 4: Financial transactions
-- Posted through sp_post_deposit / sp_post_withdrawal to maintain balance integrity

-- Day: 2025-07-01
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000002', 3377.48, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0001');
-- Day: 2025-07-01
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000003', 19681.86, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0002');
-- Day: 2025-07-01
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 2780.21, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0003');
-- Day: 2025-07-01
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 14604.37, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0004');
-- Day: 2025-07-02
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 12196.05, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0005');
-- Day: 2025-07-02
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000001', 2881.75, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0006');
-- Day: 2025-07-02
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000003', 4424.38, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0007');
-- Day: 2025-07-02
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 17102.39, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0008');
-- Day: 2025-07-03
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000010', 7250.02, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0009');
-- Day: 2025-07-03
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000009', 11893.14, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0010');
-- Day: 2025-07-03
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000009', 15438.15, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0011');
-- Day: 2025-07-03
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000006', 3799.36, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0012');
-- Day: 2025-07-04
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000004', 20858.43, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0013');
-- Day: 2025-07-04
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 13078.0, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0014');
-- Day: 2025-07-04
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000006', 4980.63, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0015');
-- Day: 2025-07-04
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000005', 17100.45, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0016');
-- Day: 2025-07-05
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 6129.01, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0017');
-- Day: 2025-07-05
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000009', 14350.06, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0018');
-- Day: 2025-07-05
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000001', 4975.35, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0019');
-- Day: 2025-07-05
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000007', 18349.59, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0020');
-- Day: 2025-07-06
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000010', 10485.39, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0021');
-- Day: 2025-07-06
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000008', 5685.92, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0022');
-- Day: 2025-07-06
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000009', 4466.16, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0023');
-- Day: 2025-07-06
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000010', 19949.19, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0024');
-- Day: 2025-07-07
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000003', 1895.21, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0025');
-- Day: 2025-07-07
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000002', 21523.02, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0026');
-- Day: 2025-07-07
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000007', 12321.88, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0027');
-- Day: 2025-07-07
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000008', 19301.98, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0028');
-- Day: 2025-07-08
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000001', 2149.28, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0029');
-- Day: 2025-07-08
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000005', 9260.54, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0030');
-- Day: 2025-07-08
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000008', 11178.37, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0031');
-- Day: 2025-07-08
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000005', 3021.81, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0032');
-- Day: 2025-07-09
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000005', 15487.71, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0033');
-- Day: 2025-07-09
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 10283.51, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0034');
-- Day: 2025-07-09
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000002', 13623.72, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0035');
-- Day: 2025-07-09
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000005', 17682.18, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0036');
-- Day: 2025-07-10
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000002', 7818.25, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0037');
-- Day: 2025-07-10
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 10030.37, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0038');
-- Day: 2025-07-10
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 17576.23, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0039');
-- Day: 2025-07-10
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000007', 22656.26, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0040');
-- Day: 2025-07-11
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 13762.05, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0041');
-- Day: 2025-07-11
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000006', 33273.67, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0042');
-- Day: 2025-07-11
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 1399.65, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0043');
-- Day: 2025-07-11
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 1136.63, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0044');
-- Day: 2025-07-12
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000001', 1596.85, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0045');
-- Day: 2025-07-12
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000006', 6291.07, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0046');
-- Day: 2025-07-12
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000008', 14743.7, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0047');
-- Day: 2025-07-12
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000010', 9986.49, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0048');
-- Day: 2025-07-13
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000007', 13520.67, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0049');
-- Day: 2025-07-13
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000006', 17412.9, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0050');
-- Day: 2025-07-13
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000001', 14836.06, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0051');
-- Day: 2025-07-13
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 11189.43, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0052');
-- Day: 2025-07-14
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000003', 9789.93, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0053');
-- Day: 2025-07-14
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000002', 9619.28, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0054');
-- Day: 2025-07-14
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000002', 3659.27, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0055');
-- Day: 2025-07-14
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000001', 9167.95, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0056');
-- Day: 2025-07-15
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000003', 5061.2, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0057');
-- Day: 2025-07-15
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000007', 1040.95, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0058');
-- Day: 2025-07-15
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000007', 20354.68, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0059');
-- Day: 2025-07-15
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000005', 81714.58, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0060');
-- Day: 2025-07-16
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 6637.45, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0061');
-- Day: 2025-07-16
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000001', 821.8, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0062');
-- Day: 2025-07-16
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000010', 17201.68, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0063');
-- Day: 2025-07-16
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000003', 1927.59, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0064');
-- Day: 2025-07-17
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000003', 13829.04, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0065');
-- Day: 2025-07-17
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 17915.46, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0066');
-- Day: 2025-07-17
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000004', 14324.38, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0067');
-- Day: 2025-07-17
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000010', 7533.94, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0068');
-- Day: 2025-07-18
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000006', 3486.69, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0069');
-- Day: 2025-07-18
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000005', 15285.43, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0070');
-- Day: 2025-07-18
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 19970.63, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0071');
-- Day: 2025-07-18
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 10611.81, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0072');
-- Day: 2025-07-19
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000003', 21400.94, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0073');
-- Day: 2025-07-19
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000006', 16841.15, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0074');
-- Day: 2025-07-19
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000005', 43737.53, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0075');
-- Day: 2025-07-19
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 17904.54, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0076');
-- Day: 2025-07-20
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 12491.77, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0077');
-- Day: 2025-07-20
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000006', 67001.36, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0078');
-- Day: 2025-07-20
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 18255.02, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0079');
-- Day: 2025-07-20
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000001', 4827.86, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0080');
-- Day: 2025-07-21
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000001', 3485.57, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0081');
-- Day: 2025-07-21
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000005', 31445.16, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0082');
-- Day: 2025-07-21
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000007', 18955.97, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0083');
-- Day: 2025-07-21
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000003', 8113.58, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0084');
-- Day: 2025-07-22
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000003', 6856.91, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0085');
-- Day: 2025-07-22
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000001', 5741.07, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0086');
-- Day: 2025-07-22
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000002', 25483.87, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0087');
-- Day: 2025-07-22
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000007', 6321.15, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0088');
-- Day: 2025-07-23
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000003', 808.39, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0089');
-- Day: 2025-07-23
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000006', 38924.08, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0090');
-- Day: 2025-07-23
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 14324.29, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0091');
-- Day: 2025-07-23
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000007', 5266.42, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0092');
-- Day: 2025-07-24
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000008', 16111.56, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0093');
-- Day: 2025-07-24
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 4669.47, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0094');
-- Day: 2025-07-24
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000006', 24678.98, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0095');
-- Day: 2025-07-24
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000005', 16635.01, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0096');
-- Day: 2025-07-25
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000009', 5716.88, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0097');
-- Day: 2025-07-25
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000005', 19687.46, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0098');
-- Day: 2025-07-25
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000001', 7568.06, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0099');
-- Day: 2025-07-25
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000006', 6978.45, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0100');
-- Day: 2025-07-26
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000007', 14466.92, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0101');
-- Day: 2025-07-26
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000001', 2329.5, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0102');
-- Day: 2025-07-26
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000006', 1643.84, '00000000-0000-0000-0401-000000000014', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0103');
-- Day: 2025-07-26
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000005', 14165.82, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0104');
-- Day: 2025-07-27
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000005', 13633.66, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0105');
-- Day: 2025-07-27
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000007', 8333.34, '00000000-0000-0000-0401-000000000013', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0106');
-- Day: 2025-07-27
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 4993.47, '00000000-0000-0000-0401-000000000015', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0107');
-- Day: 2025-07-27
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000010', 9401.04, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0108');
-- Day: 2025-07-28
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000004', 34392.38, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0109');
-- Day: 2025-07-28
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000003', 13613.22, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0110');
-- Day: 2025-07-28
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000010', 19087.99, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0111');
-- Day: 2025-07-28
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 4783.47, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0112');
-- Day: 2025-07-29
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000001', 10027.59, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0113');
-- Day: 2025-07-29
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 12965.54, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0114');
-- Day: 2025-07-29
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000004', 5635.7, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0115');
-- Day: 2025-07-29
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000001', 4303.54, '00000000-0000-0000-0401-000000000011', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0116');
-- Day: 2025-07-30
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000009', 5734.77, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0117');
-- Day: 2025-07-30
SELECT sp_post_deposit('00000000-0000-0000-0801-000000000002', 9828.22, '00000000-0000-0000-0401-000000000012', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed deposit', 'seed-txn-0118');
-- Day: 2025-07-30
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000009', 43052.61, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0119');
-- Day: 2025-07-30
SELECT sp_post_withdrawal('00000000-0000-0000-0801-000000000010', 25107.07, '00000000-0000-0000-0401-000000000016', (SELECT channel_id FROM transaction_channel WHERE channel_code = 'BRANCH_COUNTER'), 'Seed withdrawal', 'seed-txn-0120');
-- Reversal on 2025-08-01
SELECT sp_reverse_transaction((SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0001'), '00000000-0000-0000-0401-000000000012', 'Seed reversal', 'seed-rev-0001');
-- Reversal on 2025-08-01
SELECT sp_reverse_transaction((SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0002'), '00000000-0000-0000-0401-000000000011', 'Seed reversal', 'seed-rev-0002');
-- Reversal on 2025-08-01
SELECT sp_reverse_transaction((SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0003'), '00000000-0000-0000-0401-000000000016', 'Seed reversal', 'seed-rev-0003');
-- Reversal on 2025-08-01
SELECT sp_reverse_transaction((SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0004'), '00000000-0000-0000-0401-000000000012', 'Seed reversal', 'seed-rev-0004');
-- Reversal on 2025-08-01
SELECT sp_reverse_transaction((SELECT transaction_id FROM transaction WHERE idempotency_key = 'seed-txn-0005'), '00000000-0000-0000-0401-000000000012', 'Seed reversal', 'seed-rev-0005');
*/