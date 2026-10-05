-- ==========================================
-- 01_branches.sql
-- Seed the 3 initial branches
-- ==========================================

INSERT INTO branch (branch_id, branch_code, branch_name, address, district, phone, status) VALUES
('00000000-0000-0000-0101-000000000001', 'BR-COL', 'Colombo Main', '123 Main Street, Colombo 01', 'Colombo', '0112345678', 'ACTIVE'),
('00000000-0000-0000-0101-000000000002', 'BR-KAN', 'Kandy City', '45 Dalada Vidiya, Kandy', 'Kandy', '0812345678', 'ACTIVE'),
('00000000-0000-0000-0101-000000000003', 'BR-GAL', 'Galle Fort', '78 Fort Road, Galle', 'Galle', '0912345678', 'ACTIVE')
ON CONFLICT (branch_id) DO NOTHING;
