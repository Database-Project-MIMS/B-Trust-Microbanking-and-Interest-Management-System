INSERT INTO system_parameter (param_key, param_value, description, data_type)
VALUES 
  ('INTEREST_CYCLE_DAYS', '30', 'Days between interest calculations', 'NUMBER'),
  ('MIN_FD_PRINCIPAL', '10000.00', 'Minimum fixed deposit principal', 'NUMBER')
ON CONFLICT (param_key) DO NOTHING;
