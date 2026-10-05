-- ==========================================
-- 00_roles.sql
-- Seed the 7 system roles
-- ==========================================

INSERT INTO role (role_id, role_name, description, status) VALUES
('00000000-0000-0000-0201-000000000001', 'ADMIN', 'System Administrator', 'ACTIVE'),
('00000000-0000-0000-0201-000000000002', 'CENTRAL_OPS', 'Central Operations Staff', 'ACTIVE'),
('00000000-0000-0000-0201-000000000003', 'BRANCH_MANAGER', 'Branch Manager', 'ACTIVE'),
('00000000-0000-0000-0201-000000000004', 'AGENT', 'Field Agent / Bank Teller', 'ACTIVE'),
('00000000-0000-0000-0201-000000000005', 'CUSTOMER', 'Bank Customer', 'ACTIVE'),
('00000000-0000-0000-0201-000000000006', 'AUDITOR', 'System Auditor', 'ACTIVE'),
('00000000-0000-0000-0201-000000000007', 'SYSTEM', 'Internal System Account', 'ACTIVE')
ON CONFLICT (role_id) DO NOTHING;
