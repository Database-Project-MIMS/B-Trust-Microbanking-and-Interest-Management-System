INSERT INTO joint_mandate (account_id, mandate_type, required_signatories) VALUES
('00000000-0000-0000-0801-000000000005', 'ANY_ONE', 1),
('00000000-0000-0000-0801-000000000006', 'ALL_HOLDERS', 3)
ON CONFLICT (account_id) DO NOTHING;
