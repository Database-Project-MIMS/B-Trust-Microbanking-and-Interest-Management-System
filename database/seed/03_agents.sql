-- ==========================================
-- 03_agents.sql
-- Seed the 6 agents, linking them to their app_users
-- ==========================================

INSERT INTO agent (agent_id, branch_id, employee_no, nic_passport_no, full_name, date_of_birth, gender, phone, address, email, hired_date, status) VALUES
-- Colombo Main (BR-COL: 0101-...01)
('00000000-0000-0000-0401-000000000011', '00000000-0000-0000-0101-000000000001', 'EMP001', '901234567V', 'Kamal Perera', '1990-05-15', 'MALE', '0771111111', '12 Colombo Road', 'kamal@btrust.lk', '2020-01-10', 'ACTIVE'),
('00000000-0000-0000-0401-000000000012', '00000000-0000-0000-0101-000000000001', 'EMP002', '921234567V', 'Nimali Silva', '1992-08-20', 'FEMALE', '0772222222', '34 Colombo Road', 'nimali@btrust.lk', '2021-03-15', 'ACTIVE'),

-- Kandy City (BR-KAN: 0101-...02)
('00000000-0000-0000-0401-000000000013', '00000000-0000-0000-0101-000000000002', 'EMP003', '881234567V', 'Sunil Fernando', '1988-11-30', 'MALE', '0773333333', '56 Kandy Road', 'sunil@btrust.lk', '2019-06-01', 'ACTIVE'),
('00000000-0000-0000-0401-000000000014', '00000000-0000-0000-0101-000000000002', 'EMP004', '951234567V', 'Amali Bandara', '1995-02-10', 'FEMALE', '0774444444', '78 Kandy Road', 'amali@btrust.lk', '2022-09-01', 'ACTIVE'),

-- Galle Fort (BR-GAL: 0101-...03)
('00000000-0000-0000-0401-000000000015', '00000000-0000-0000-0101-000000000003', 'EMP005', '911234567V', 'Ruwan Kumara', '1991-07-25', 'MALE', '0775555555', '90 Galle Road', 'ruwan@btrust.lk', '2020-11-15', 'ACTIVE'),
('00000000-0000-0000-0401-000000000016', '00000000-0000-0000-0101-000000000003', 'EMP006', '931234567V', 'Samanthi de Silva', '1993-04-05', 'FEMALE', '0776666666', '12 Galle Road', 'samanthi@btrust.lk', '2021-08-20', 'ACTIVE')
ON CONFLICT (agent_id) DO NOTHING;
