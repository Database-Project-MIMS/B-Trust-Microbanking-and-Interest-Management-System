# 18 — Implemented Database Catalog

Generated from the clean isolated rebuild; no customer rows or secrets are included.

28 public tables; 70 immutable migration entries. Historical ERD and proposals are distinguished in [docs/04](04_database-schema.md).

## account

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| account_id | uuid | yes | gen_random_uuid() |
| plan_id | uuid | yes | — |
| branch_id | uuid | yes | — |
| opened_by_agent_id | uuid | yes | — |
| account_number | character varying(50) | yes | — |
| opened_date | date | yes | CURRENT_DATE |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| current_balance | money_amount | yes | 0 |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | yes | now() |
| savings_interest_through | date | no | — |

| Constraint | Definition |
| --- | --- |
| account_account_id_not_null | NOT NULL account_id |
| account_account_number_not_null | NOT NULL account_number |
| account_branch_id_not_null | NOT NULL branch_id |
| account_created_at_not_null | NOT NULL created_at |
| account_current_balance_not_null | NOT NULL current_balance |
| account_opened_by_agent_id_not_null | NOT NULL opened_by_agent_id |
| account_opened_date_not_null | NOT NULL opened_date |
| account_pkey | PRIMARY KEY (account_id) |
| account_plan_id_not_null | NOT NULL plan_id |
| account_status_not_null | NOT NULL status |
| account_updated_at_not_null | NOT NULL updated_at |
| ck_account_balance_non_negative | CHECK (((current_balance)::numeric >= (0)::numeric)) |
| ck_account_status | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'FROZEN'::character varying, 'CLOSED'::character varying])::text[]))) |
| fk_account_branch | FOREIGN KEY (branch_id) REFERENCES branch(branch_id) ON DELETE RESTRICT |
| fk_account_opened_by_agent | FOREIGN KEY (opened_by_agent_id) REFERENCES agent(agent_id) ON DELETE RESTRICT |
| fk_account_plan | FOREIGN KEY (plan_id) REFERENCES savings_plan(plan_id) ON DELETE RESTRICT |
| uq_account_account_number | UNIQUE (account_number) |

## account_holder

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| account_holder_id | uuid | yes | gen_random_uuid() |
| account_id | uuid | yes | — |
| customer_id | uuid | yes | — |
| holder_type | character varying(20) | yes | 'PRIMARY'::character varying |
| joined_date | date | yes | CURRENT_DATE |
| created_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| account_holder_account_holder_id_not_null | NOT NULL account_holder_id |
| account_holder_account_id_not_null | NOT NULL account_id |
| account_holder_created_at_not_null | NOT NULL created_at |
| account_holder_customer_id_not_null | NOT NULL customer_id |
| account_holder_holder_type_not_null | NOT NULL holder_type |
| account_holder_joined_date_not_null | NOT NULL joined_date |
| account_holder_pkey | PRIMARY KEY (account_holder_id) |
| ck_account_holder_type | CHECK (((holder_type)::text = ANY ((ARRAY['PRIMARY'::character varying, 'JOINT'::character varying])::text[]))) |
| fk_account_holder_account | FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT |
| fk_account_holder_customer | FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT |
| uq_account_holder_account_customer | UNIQUE (account_id, customer_id) |

## account_opening_request

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| request_id | uuid | yes | gen_random_uuid() |
| user_id | uuid | yes | — |
| idempotency_key | character varying(80) | yes | — |
| request_hash | character(64) | yes | — |
| account_id | uuid | yes | — |
| created_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| account_opening_request_account_id_not_null | NOT NULL account_id |
| account_opening_request_created_at_not_null | NOT NULL created_at |
| account_opening_request_idempotency_key_not_null | NOT NULL idempotency_key |
| account_opening_request_pkey | PRIMARY KEY (request_id) |
| account_opening_request_request_hash_not_null | NOT NULL request_hash |
| account_opening_request_request_id_not_null | NOT NULL request_id |
| account_opening_request_user_id_not_null | NOT NULL user_id |
| ck_account_opening_request_hash_format | CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)) |
| ck_account_opening_request_key_format | CHECK (((idempotency_key)::text ~ '^[A-Za-z0-9_-]{8,80}$'::text)) |
| fk_account_opening_request_account | FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT |
| fk_account_opening_request_user | FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| uq_account_opening_request_account | UNIQUE (account_id) |
| uq_account_opening_request_user_key | UNIQUE (user_id, idempotency_key) |

## agent

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| agent_id | uuid | yes | — |
| branch_id | uuid | yes | — |
| employee_no | character varying(30) | yes | — |
| nic_passport_no | character varying(50) | yes | — |
| full_name | character varying(150) | yes | — |
| date_of_birth | date | yes | — |
| gender | character varying(20) | yes | — |
| phone | character varying(20) | yes | — |
| address | character varying(255) | yes | — |
| email | character varying(150) | yes | — |
| hired_date | date | yes | — |
| status | record_status | yes | 'ACTIVE'::character varying |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| agent_address_not_null | NOT NULL address |
| agent_agent_id_not_null | NOT NULL agent_id |
| agent_branch_id_not_null | NOT NULL branch_id |
| agent_created_at_not_null | NOT NULL created_at |
| agent_date_of_birth_not_null | NOT NULL date_of_birth |
| agent_email_not_null | NOT NULL email |
| agent_employee_no_not_null | NOT NULL employee_no |
| agent_full_name_not_null | NOT NULL full_name |
| agent_gender_not_null | NOT NULL gender |
| agent_hired_date_not_null | NOT NULL hired_date |
| agent_nic_passport_no_not_null | NOT NULL nic_passport_no |
| agent_phone_not_null | NOT NULL phone |
| agent_pkey | PRIMARY KEY (agent_id) |
| agent_status_not_null | NOT NULL status |
| agent_updated_at_not_null | NOT NULL updated_at |
| fk_agent_app_user | FOREIGN KEY (agent_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| fk_agent_branch | FOREIGN KEY (branch_id) REFERENCES branch(branch_id) ON DELETE RESTRICT |
| uq_agent_email | UNIQUE (email) |
| uq_agent_employee_no | UNIQUE (employee_no) |
| uq_agent_nic_passport_no | UNIQUE (nic_passport_no) |

## app_user

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| user_id | uuid | yes | gen_random_uuid() |
| role_id | uuid | yes | — |
| username | character varying(100) | yes | — |
| password_hash | character varying(255) | yes | — |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| registered_date | date | yes | CURRENT_DATE |
| last_login | timestamp with time zone | no | — |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | no | — |

| Constraint | Definition |
| --- | --- |
| app_user_created_at_not_null | NOT NULL created_at |
| app_user_password_hash_not_null | NOT NULL password_hash |
| app_user_pkey | PRIMARY KEY (user_id) |
| app_user_registered_date_not_null | NOT NULL registered_date |
| app_user_role_id_fkey | FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE RESTRICT |
| app_user_role_id_not_null | NOT NULL role_id |
| app_user_status_check | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying])::text[]))) |
| app_user_status_not_null | NOT NULL status |
| app_user_user_id_not_null | NOT NULL user_id |
| app_user_username_key | UNIQUE (username) |
| app_user_username_not_null | NOT NULL username |

## audit_log

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| log_id | uuid | yes | gen_random_uuid() |
| user_id | uuid | no | — |
| actor_type | character varying(20) | yes | — |
| entity_type | character varying(100) | yes | — |
| entity_id | uuid | no | — |
| action | character varying(50) | yes | — |
| old_values | jsonb | no | — |
| new_values | jsonb | no | — |
| ip_address | character varying(45) | no | — |
| logged_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| audit_log_action_not_null | NOT NULL action |
| audit_log_actor_type_check | CHECK (((actor_type)::text = ANY ((ARRAY['USER'::character varying, 'SYSTEM'::character varying])::text[]))) |
| audit_log_actor_type_not_null | NOT NULL actor_type |
| audit_log_entity_type_not_null | NOT NULL entity_type |
| audit_log_log_id_not_null | NOT NULL log_id |
| audit_log_logged_at_not_null | NOT NULL logged_at |
| audit_log_pkey | PRIMARY KEY (log_id) |
| audit_log_user_id_fkey | FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |

## branch

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| branch_id | uuid | yes | gen_random_uuid() |
| branch_code | character varying(20) | yes | — |
| branch_name | character varying(100) | yes | — |
| address | character varying(255) | yes | — |
| district | character varying(100) | yes | — |
| phone | character varying(20) | yes | — |
| status | record_status | yes | 'ACTIVE'::character varying |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| branch_address_not_null | NOT NULL address |
| branch_branch_code_not_null | NOT NULL branch_code |
| branch_branch_id_not_null | NOT NULL branch_id |
| branch_branch_name_not_null | NOT NULL branch_name |
| branch_created_at_not_null | NOT NULL created_at |
| branch_district_not_null | NOT NULL district |
| branch_phone_not_null | NOT NULL phone |
| branch_pkey | PRIMARY KEY (branch_id) |
| branch_status_not_null | NOT NULL status |
| branch_updated_at_not_null | NOT NULL updated_at |
| uq_branch_branch_code | UNIQUE (branch_code) |

## business_calendar

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| calendar_id | uuid | yes | gen_random_uuid() |
| calendar_date | date | yes | — |
| is_business_day | boolean | yes | true |
| open_time | time without time zone | no | — |
| close_time | time without time zone | no | — |
| description | character varying(255) | no | — |
| created_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| business_calendar_calendar_date_key | UNIQUE (calendar_date) |
| business_calendar_calendar_date_not_null | NOT NULL calendar_date |
| business_calendar_calendar_id_not_null | NOT NULL calendar_id |
| business_calendar_created_at_not_null | NOT NULL created_at |
| business_calendar_is_business_day_not_null | NOT NULL is_business_day |
| business_calendar_pkey | PRIMARY KEY (calendar_id) |

## customer

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| customer_id | uuid | yes | gen_random_uuid() |
| app_user_id | uuid | no | — |
| branch_id | uuid | yes | — |
| customer_number | character varying(30) | yes | — |
| nic_passport_no | character varying(50) | yes | — |
| full_name | character varying(150) | yes | — |
| date_of_birth | date | yes | — |
| gender | character varying(20) | no | — |
| phone | character varying(20) | no | — |
| address | character varying(255) | no | — |
| email | character varying(150) | yes | — |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| ck_customer_birth_date_past | CHECK ((date_of_birth < CURRENT_DATE)) |
| ck_customer_status | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))) |
| customer_branch_id_not_null | NOT NULL branch_id |
| customer_created_at_not_null | NOT NULL created_at |
| customer_customer_id_not_null | NOT NULL customer_id |
| customer_customer_number_not_null | NOT NULL customer_number |
| customer_date_of_birth_not_null | NOT NULL date_of_birth |
| customer_email_not_null | NOT NULL email |
| customer_full_name_not_null | NOT NULL full_name |
| customer_nic_passport_no_not_null | NOT NULL nic_passport_no |
| customer_pkey | PRIMARY KEY (customer_id) |
| customer_status_not_null | NOT NULL status |
| customer_updated_at_not_null | NOT NULL updated_at |
| fk_customer_app_user | FOREIGN KEY (app_user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| fk_customer_branch | FOREIGN KEY (branch_id) REFERENCES branch(branch_id) ON DELETE RESTRICT |
| uq_customer_app_user_id | UNIQUE (app_user_id) |
| uq_customer_email | UNIQUE (email) |
| uq_customer_nic_passport_no | UNIQUE (nic_passport_no) |
| uq_customer_number | UNIQUE (customer_number) |

## customer_agent

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| cust_agent_id | uuid | yes | gen_random_uuid() |
| customer_id | uuid | yes | — |
| agent_id | uuid | yes | — |
| assigned_date | date | yes | CURRENT_DATE |
| end_date | date | no | — |
| is_active | boolean | yes | true |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| ck_customer_agent_dates | CHECK (((end_date IS NULL) OR (end_date >= assigned_date))) |
| customer_agent_agent_id_not_null | NOT NULL agent_id |
| customer_agent_assigned_date_not_null | NOT NULL assigned_date |
| customer_agent_created_at_not_null | NOT NULL created_at |
| customer_agent_cust_agent_id_not_null | NOT NULL cust_agent_id |
| customer_agent_customer_id_not_null | NOT NULL customer_id |
| customer_agent_is_active_not_null | NOT NULL is_active |
| customer_agent_pkey | PRIMARY KEY (cust_agent_id) |
| customer_agent_updated_at_not_null | NOT NULL updated_at |
| fk_customer_agent_agent | FOREIGN KEY (agent_id) REFERENCES agent(agent_id) ON DELETE RESTRICT |
| fk_customer_agent_customer | FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT |

## customer_document

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| doc_id | uuid | yes | gen_random_uuid() |
| customer_id | uuid | yes | — |
| doc_type | character varying(50) | yes | — |
| file_path | character varying(500) | yes | — |
| uploaded_date | timestamp with time zone | yes | now() |
| verified_by | uuid | no | — |
| verified_date | timestamp with time zone | no | — |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| ck_customer_document_verification | CHECK (((verified_by IS NULL) = (verified_date IS NULL))) |
| customer_document_created_at_not_null | NOT NULL created_at |
| customer_document_customer_id_not_null | NOT NULL customer_id |
| customer_document_doc_id_not_null | NOT NULL doc_id |
| customer_document_doc_type_not_null | NOT NULL doc_type |
| customer_document_file_path_not_null | NOT NULL file_path |
| customer_document_pkey | PRIMARY KEY (doc_id) |
| customer_document_updated_at_not_null | NOT NULL updated_at |
| customer_document_uploaded_date_not_null | NOT NULL uploaded_date |
| fk_customer_document_customer | FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT |
| fk_customer_document_verifier | FOREIGN KEY (verified_by) REFERENCES app_user(user_id) ON DELETE RESTRICT |

## fd_maturity_receipt

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| receipt_id | uuid | yes | gen_random_uuid() |
| fd_id | uuid | yes | — |
| transaction_id | uuid | yes | — |
| created_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| fd_maturity_receipt_created_at_not_null | NOT NULL created_at |
| fd_maturity_receipt_fd_id_fkey | FOREIGN KEY (fd_id) REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT |
| fd_maturity_receipt_fd_id_key | UNIQUE (fd_id) |
| fd_maturity_receipt_fd_id_not_null | NOT NULL fd_id |
| fd_maturity_receipt_pkey | PRIMARY KEY (receipt_id) |
| fd_maturity_receipt_receipt_id_not_null | NOT NULL receipt_id |
| fd_maturity_receipt_transaction_id_fkey | FOREIGN KEY (transaction_id) REFERENCES transaction(transaction_id) ON DELETE RESTRICT |
| fd_maturity_receipt_transaction_id_key | UNIQUE (transaction_id) |
| fd_maturity_receipt_transaction_id_not_null | NOT NULL transaction_id |

## fd_opening_request

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| request_id | uuid | yes | gen_random_uuid() |
| actor_user_id | uuid | yes | — |
| idempotency_key | character varying(80) | yes | — |
| payload_hash | character varying(64) | yes | — |
| fd_id | uuid | yes | — |
| created_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| fd_opening_request_actor_user_id_fkey | FOREIGN KEY (actor_user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| fd_opening_request_actor_user_id_not_null | NOT NULL actor_user_id |
| fd_opening_request_created_at_not_null | NOT NULL created_at |
| fd_opening_request_fd_id_fkey | FOREIGN KEY (fd_id) REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT |
| fd_opening_request_fd_id_not_null | NOT NULL fd_id |
| fd_opening_request_idempotency_key_not_null | NOT NULL idempotency_key |
| fd_opening_request_payload_hash_check | CHECK (((payload_hash)::text ~ '^[a-f0-9]{64}$'::text)) |
| fd_opening_request_payload_hash_not_null | NOT NULL payload_hash |
| fd_opening_request_pkey | PRIMARY KEY (request_id) |
| fd_opening_request_request_id_not_null | NOT NULL request_id |
| uq_fd_opening_actor_key | UNIQUE (actor_user_id, idempotency_key) |

## fd_plan

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| fd_plan_id | uuid | yes | gen_random_uuid() |
| plan_name | character varying(100) | yes | — |
| tenure_months | integer | yes | — |
| interest_rate | numeric(6,4) | yes | — |
| description | character varying(255) | no | — |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| effective_from | date | no | CURRENT_DATE |
| effective_to | date | no | — |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | no | — |

| Constraint | Definition |
| --- | --- |
| chk_fd_plan_effective_dates | CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))) |
| fd_plan_created_at_not_null | NOT NULL created_at |
| fd_plan_fd_plan_id_not_null | NOT NULL fd_plan_id |
| fd_plan_interest_rate_check | CHECK (((interest_rate >= (0)::numeric) AND (interest_rate <= (1)::numeric))) |
| fd_plan_interest_rate_not_null | NOT NULL interest_rate |
| fd_plan_pkey | PRIMARY KEY (fd_plan_id) |
| fd_plan_plan_name_key | UNIQUE (plan_name) |
| fd_plan_plan_name_not_null | NOT NULL plan_name |
| fd_plan_status_check | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))) |
| fd_plan_status_not_null | NOT NULL status |
| fd_plan_tenure_months_check | CHECK ((tenure_months > 0)) |
| fd_plan_tenure_months_not_null | NOT NULL tenure_months |

## fixed_deposit

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| fd_id | uuid | yes | gen_random_uuid() |
| account_id | uuid | yes | — |
| fd_plan_id | uuid | yes | — |
| principal_amount | positive_money | yes | — |
| interest_rate_at_opening | interest_rate | yes | — |
| start_date | date | yes | — |
| maturity_date | date | yes | — |
| next_interest_date | date | yes | — |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | no | — |
| funding_transaction_id | uuid | no | — |

| Constraint | Definition |
| --- | --- |
| chk_fd_maturity_after_start | CHECK ((maturity_date > start_date)) |
| chk_fd_next_interest_after_start | CHECK ((next_interest_date >= start_date)) |
| fixed_deposit_account_id_fkey | FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT |
| fixed_deposit_account_id_not_null | NOT NULL account_id |
| fixed_deposit_created_at_not_null | NOT NULL created_at |
| fixed_deposit_fd_id_not_null | NOT NULL fd_id |
| fixed_deposit_fd_plan_id_fkey | FOREIGN KEY (fd_plan_id) REFERENCES fd_plan(fd_plan_id) ON DELETE RESTRICT |
| fixed_deposit_fd_plan_id_not_null | NOT NULL fd_plan_id |
| fixed_deposit_funding_transaction_id_fkey | FOREIGN KEY (funding_transaction_id) REFERENCES transaction(transaction_id) ON DELETE RESTRICT |
| fixed_deposit_funding_transaction_id_key | UNIQUE (funding_transaction_id) |
| fixed_deposit_interest_rate_at_opening_not_null | NOT NULL interest_rate_at_opening |
| fixed_deposit_maturity_date_not_null | NOT NULL maturity_date |
| fixed_deposit_next_interest_date_not_null | NOT NULL next_interest_date |
| fixed_deposit_pkey | PRIMARY KEY (fd_id) |
| fixed_deposit_principal_amount_not_null | NOT NULL principal_amount |
| fixed_deposit_start_date_not_null | NOT NULL start_date |
| fixed_deposit_status_check | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'MATURED'::character varying, 'CLOSED'::character varying])::text[]))) |
| fixed_deposit_status_not_null | NOT NULL status |

## interest_payout

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| interest_id | uuid | yes | gen_random_uuid() |
| fd_id | uuid | no | — |
| interest_run_id | uuid | yes | — |
| transaction_id | uuid | no | — |
| cycle_date | date | yes | — |
| payout_date | date | yes | — |
| interest_amount | numeric(15,2) | yes | — |
| created_at | timestamp with time zone | yes | now() |
| account_id | uuid | yes | — |
| source_type | text | yes | 'FIXED_DEPOSIT'::text |
| period_start | date | no | — |
| period_end | date | no | — |
| rate_at_payout | interest_rate | no | — |

| Constraint | Definition |
| --- | --- |
| ck_interest_source | CHECK ((((source_type = 'FIXED_DEPOSIT'::text) AND (fd_id IS NOT NULL)) OR ((source_type = 'SAVINGS'::text) AND (fd_id IS NULL) AND (period_start IS NOT NULL) AND (period_end > period_start) AND (rate_at_payout IS NOT NULL)))) |
| interest_payout_account_id_fkey | FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT |
| interest_payout_account_id_not_null | NOT NULL account_id |
| interest_payout_created_at_not_null | NOT NULL created_at |
| interest_payout_cycle_date_not_null | NOT NULL cycle_date |
| interest_payout_fd_id_fkey | FOREIGN KEY (fd_id) REFERENCES fixed_deposit(fd_id) ON DELETE RESTRICT |
| interest_payout_interest_amount_not_null | NOT NULL interest_amount |
| interest_payout_interest_id_not_null | NOT NULL interest_id |
| interest_payout_interest_run_id_fkey | FOREIGN KEY (interest_run_id) REFERENCES interest_run(run_id) ON DELETE RESTRICT |
| interest_payout_interest_run_id_not_null | NOT NULL interest_run_id |
| interest_payout_payout_date_not_null | NOT NULL payout_date |
| interest_payout_pkey | PRIMARY KEY (interest_id) |
| interest_payout_source_type_not_null | NOT NULL source_type |
| interest_payout_transaction_id_fkey | FOREIGN KEY (transaction_id) REFERENCES transaction(transaction_id) ON DELETE RESTRICT |
| interest_payout_transaction_id_key | UNIQUE (transaction_id) |

## interest_run

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| run_id | uuid | yes | gen_random_uuid() |
| cycle_date | date | yes | — |
| started_at | timestamp with time zone | yes | now() |
| completed_at | timestamp with time zone | no | — |
| status | character varying(20) | yes | 'RUNNING'::character varying |
| fd_count | integer | no | 0 |
| total_interest | numeric(15,2) | no | 0 |
| exception_count | integer | no | 0 |
| initiated_by | uuid | no | — |
| created_at | timestamp with time zone | yes | now() |
| savings_count | integer | yes | 0 |

| Constraint | Definition |
| --- | --- |
| interest_run_created_at_not_null | NOT NULL created_at |
| interest_run_cycle_date_key | UNIQUE (cycle_date) |
| interest_run_cycle_date_not_null | NOT NULL cycle_date |
| interest_run_initiated_by_fkey | FOREIGN KEY (initiated_by) REFERENCES app_user(user_id) |
| interest_run_pkey | PRIMARY KEY (run_id) |
| interest_run_run_id_not_null | NOT NULL run_id |
| interest_run_savings_count_check | CHECK ((savings_count >= 0)) |
| interest_run_savings_count_not_null | NOT NULL savings_count |
| interest_run_started_at_not_null | NOT NULL started_at |
| interest_run_status_check | CHECK (((status)::text = ANY ((ARRAY['RUNNING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[]))) |
| interest_run_status_not_null | NOT NULL status |

## joint_mandate

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| mandate_id | uuid | yes | gen_random_uuid() |
| account_id | uuid | yes | — |
| mandate_type | character varying(20) | yes | — |
| required_signatories | integer | yes | 1 |
| effective_from | date | yes | CURRENT_DATE |
| effective_to | date | no | — |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| ck_joint_mandate_any_one_single | CHECK ((((mandate_type)::text <> 'ANY_ONE'::text) OR (required_signatories = 1))) |
| ck_joint_mandate_effective_range | CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))) |
| ck_joint_mandate_signatories_range | CHECK (((required_signatories >= 1) AND (required_signatories <= 4))) |
| ck_joint_mandate_type | CHECK (((mandate_type)::text = ANY ((ARRAY['ANY_ONE'::character varying, 'ALL_HOLDERS'::character varying])::text[]))) |
| fk_joint_mandate_account | FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT |
| joint_mandate_account_id_not_null | NOT NULL account_id |
| joint_mandate_created_at_not_null | NOT NULL created_at |
| joint_mandate_effective_from_not_null | NOT NULL effective_from |
| joint_mandate_mandate_id_not_null | NOT NULL mandate_id |
| joint_mandate_mandate_type_not_null | NOT NULL mandate_type |
| joint_mandate_pkey | PRIMARY KEY (mandate_id) |
| joint_mandate_required_signatories_not_null | NOT NULL required_signatories |
| joint_mandate_updated_at_not_null | NOT NULL updated_at |
| uq_joint_mandate_account | UNIQUE (account_id) |

## login_attempt

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| attempt_id | uuid | yes | gen_random_uuid() |
| username_attempted | character varying(100) | yes | — |
| success | boolean | yes | — |
| ip_address | character varying(45) | no | — |
| attempted_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| login_attempt_attempt_id_not_null | NOT NULL attempt_id |
| login_attempt_attempted_at_not_null | NOT NULL attempted_at |
| login_attempt_pkey | PRIMARY KEY (attempt_id) |
| login_attempt_success_not_null | NOT NULL success |
| login_attempt_username_attempted_not_null | NOT NULL username_attempted |

## password_reset_token

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| reset_id | uuid | yes | gen_random_uuid() |
| user_id | uuid | yes | — |
| token_hash | character varying(64) | yes | — |
| expires_at | timestamp with time zone | yes | — |
| used_at | timestamp with time zone | no | — |
| created_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| password_reset_token_check | CHECK ((expires_at > created_at)) |
| password_reset_token_created_at_not_null | NOT NULL created_at |
| password_reset_token_expires_at_not_null | NOT NULL expires_at |
| password_reset_token_pkey | PRIMARY KEY (reset_id) |
| password_reset_token_reset_id_not_null | NOT NULL reset_id |
| password_reset_token_token_hash_check | CHECK (((token_hash)::text ~ '^[0-9a-f]{64}$'::text)) |
| password_reset_token_token_hash_key | UNIQUE (token_hash) |
| password_reset_token_token_hash_not_null | NOT NULL token_hash |
| password_reset_token_user_id_fkey | FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| password_reset_token_user_id_not_null | NOT NULL user_id |

## role

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| role_id | uuid | yes | gen_random_uuid() |
| role_name | character varying(50) | yes | — |
| description | character varying(255) | no | — |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | no | — |

| Constraint | Definition |
| --- | --- |
| role_created_at_not_null | NOT NULL created_at |
| role_pkey | PRIMARY KEY (role_id) |
| role_role_id_not_null | NOT NULL role_id |
| role_role_name_key | UNIQUE (role_name) |
| role_role_name_not_null | NOT NULL role_name |
| role_status_check | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))) |
| role_status_not_null | NOT NULL status |

## savings_plan

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| plan_id | uuid | yes | gen_random_uuid() |
| plan_name | character varying(100) | yes | — |
| interest_rate | interest_rate | yes | — |
| min_balance | money_amount | yes | 0 |
| description | character varying(255) | no | — |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| min_age_years | integer | no | — |
| max_age_years | integer | no | — |
| min_holders | integer | yes | 1 |
| max_holders | integer | yes | 1 |
| requires_all_adult | boolean | yes | false |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | no | — |

| Constraint | Definition |
| --- | --- |
| chk_savings_plan_age_range | CHECK (((max_age_years IS NULL) OR (min_age_years IS NULL) OR (max_age_years >= min_age_years))) |
| chk_savings_plan_holder_range | CHECK ((max_holders >= min_holders)) |
| chk_savings_plan_min_balance_nonneg | CHECK (((min_balance)::numeric >= (0)::numeric)) |
| savings_plan_created_at_not_null | NOT NULL created_at |
| savings_plan_interest_rate_not_null | NOT NULL interest_rate |
| savings_plan_max_holders_not_null | NOT NULL max_holders |
| savings_plan_min_balance_not_null | NOT NULL min_balance |
| savings_plan_min_holders_not_null | NOT NULL min_holders |
| savings_plan_pkey | PRIMARY KEY (plan_id) |
| savings_plan_plan_id_not_null | NOT NULL plan_id |
| savings_plan_plan_name_key | UNIQUE (plan_name) |
| savings_plan_plan_name_not_null | NOT NULL plan_name |
| savings_plan_requires_all_adult_not_null | NOT NULL requires_all_adult |
| savings_plan_status_check | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))) |
| savings_plan_status_not_null | NOT NULL status |

## schema_migration

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| filename | text | yes | — |
| checksum | text | yes | — |
| applied_at | timestamp with time zone | yes | now() |
| applied_by | text | yes | CURRENT_USER |

| Constraint | Definition |
| --- | --- |
| schema_migration_applied_at_not_null | NOT NULL applied_at |
| schema_migration_applied_by_not_null | NOT NULL applied_by |
| schema_migration_checksum_not_null | NOT NULL checksum |
| schema_migration_filename_not_null | NOT NULL filename |
| schema_migration_pkey | PRIMARY KEY (filename) |

## system_parameter

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| param_id | uuid | yes | gen_random_uuid() |
| param_key | character varying(100) | yes | — |
| param_value | character varying(500) | yes | — |
| description | character varying(500) | no | — |
| data_type | character varying(50) | no | — |
| created_at | timestamp with time zone | yes | now() |
| updated_at | timestamp with time zone | no | — |

| Constraint | Definition |
| --- | --- |
| system_parameter_created_at_not_null | NOT NULL created_at |
| system_parameter_param_id_not_null | NOT NULL param_id |
| system_parameter_param_key_key | UNIQUE (param_key) |
| system_parameter_param_key_not_null | NOT NULL param_key |
| system_parameter_param_value_not_null | NOT NULL param_value |
| system_parameter_pkey | PRIMARY KEY (param_id) |

## transaction

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| transaction_id | uuid | yes | gen_random_uuid() |
| account_id | uuid | yes | — |
| initiated_by_user_id | uuid | yes | — |
| channel_id | uuid | yes | — |
| reference_number | character varying(50) | yes | — |
| transaction_type | character varying(50) | yes | — |
| amount | numeric(15,2) | yes | — |
| transaction_date | timestamp with time zone | yes | now() |
| narration | character varying(255) | no | — |
| created_at | timestamp with time zone | yes | now() |
| agent_id | uuid | no | — |
| branch_id | uuid | no | — |
| idempotency_key | character varying(80) | no | — |
| balance_after | numeric(15,2) | no | — |
| ledger_seq | bigint | yes | nextval('transaction_ledger_seq'::regclass) |
| transfer_group_id | uuid | no | — |

| Constraint | Definition |
| --- | --- |
| ck_transfer_group | CHECK ((((transaction_type)::text = ANY ((ARRAY['TRANSFER_OUT'::character varying, 'TRANSFER_IN'::character varying])::text[])) = (transfer_group_id IS NOT NULL))) |
| fk_transaction_agent | FOREIGN KEY (agent_id) REFERENCES agent(agent_id) ON DELETE RESTRICT |
| fk_transaction_branch | FOREIGN KEY (branch_id) REFERENCES branch(branch_id) ON DELETE RESTRICT |
| transaction_account_id_fkey | FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE RESTRICT |
| transaction_account_id_not_null | NOT NULL account_id |
| transaction_amount_check | CHECK ((amount > (0)::numeric)) |
| transaction_amount_not_null | NOT NULL amount |
| transaction_channel_id_fkey | FOREIGN KEY (channel_id) REFERENCES transaction_channel(channel_id) ON DELETE RESTRICT |
| transaction_channel_id_not_null | NOT NULL channel_id |
| transaction_created_at_not_null | NOT NULL created_at |
| transaction_initiated_by_user_id_fkey | FOREIGN KEY (initiated_by_user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| transaction_initiated_by_user_id_not_null | NOT NULL initiated_by_user_id |
| transaction_ledger_seq_not_null | NOT NULL ledger_seq |
| transaction_pkey | PRIMARY KEY (transaction_id) |
| transaction_reference_number_not_null | NOT NULL reference_number |
| transaction_transaction_date_not_null | NOT NULL transaction_date |
| transaction_transaction_id_not_null | NOT NULL transaction_id |
| transaction_transaction_type_check | CHECK (((transaction_type)::text = ANY ((ARRAY['DEPOSIT'::character varying, 'WITHDRAWAL'::character varying, 'INTEREST_CREDIT'::character varying, 'REVERSAL'::character varying, 'TRANSFER_OUT'::character varying, 'TRANSFER_IN'::character varying, 'FD_MATURITY'::character varying])::text[]))) |
| transaction_transaction_type_not_null | NOT NULL transaction_type |
| trg_transfer_pair | TRIGGER DEFERRABLE INITIALLY DEFERRED |
| ux_transaction_reference | UNIQUE (reference_number) |

## transaction_channel

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| channel_id | uuid | yes | gen_random_uuid() |
| channel_name | character varying(100) | yes | — |
| status | character varying(20) | yes | 'ACTIVE'::character varying |
| created_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| transaction_channel_channel_id_not_null | NOT NULL channel_id |
| transaction_channel_channel_name_key | UNIQUE (channel_name) |
| transaction_channel_channel_name_not_null | NOT NULL channel_name |
| transaction_channel_created_at_not_null | NOT NULL created_at |
| transaction_channel_pkey | PRIMARY KEY (channel_id) |
| transaction_channel_status_check | CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))) |
| transaction_channel_status_not_null | NOT NULL status |

## transaction_reversal

Owner: mims_owner. RLS: enabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| reversal_id | uuid | yes | gen_random_uuid() |
| original_transaction_id | uuid | yes | — |
| reversal_transaction_id | uuid | yes | — |
| reason | character varying(255) | yes | — |
| reversed_by_user_id | uuid | yes | — |
| reversed_at | timestamp with time zone | yes | now() |

| Constraint | Definition |
| --- | --- |
| fk_tx_reversal_original | FOREIGN KEY (original_transaction_id) REFERENCES transaction(transaction_id) ON DELETE RESTRICT |
| fk_tx_reversal_reversal | FOREIGN KEY (reversal_transaction_id) REFERENCES transaction(transaction_id) ON DELETE RESTRICT |
| fk_tx_reversal_user | FOREIGN KEY (reversed_by_user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| transaction_reversal_original_transaction_id_key | UNIQUE (original_transaction_id) |
| transaction_reversal_original_transaction_id_not_null | NOT NULL original_transaction_id |
| transaction_reversal_pkey | PRIMARY KEY (reversal_id) |
| transaction_reversal_reason_not_null | NOT NULL reason |
| transaction_reversal_reversal_id_not_null | NOT NULL reversal_id |
| transaction_reversal_reversal_transaction_id_key | UNIQUE (reversal_transaction_id) |
| transaction_reversal_reversal_transaction_id_not_null | NOT NULL reversal_transaction_id |
| transaction_reversal_reversed_at_not_null | NOT NULL reversed_at |
| transaction_reversal_reversed_by_user_id_not_null | NOT NULL reversed_by_user_id |
| trg_transfer_reversal_pair | TRIGGER DEFERRABLE INITIALLY DEFERRED |

## user_session

Owner: mims_owner. RLS: disabled.

| Column | PostgreSQL type | Not null | Default |
| --- | --- | --- | --- |
| session_id | uuid | yes | gen_random_uuid() |
| user_id | uuid | yes | — |
| token_hash | character varying(255) | yes | — |
| created_at | timestamp with time zone | yes | now() |
| expires_at | timestamp with time zone | yes | — |
| revoked_at | timestamp with time zone | no | — |
| ip_address | character varying(45) | no | — |
| user_agent | character varying(500) | no | — |

| Constraint | Definition |
| --- | --- |
| user_session_created_at_not_null | NOT NULL created_at |
| user_session_expires_at_not_null | NOT NULL expires_at |
| user_session_pkey | PRIMARY KEY (session_id) |
| user_session_session_id_not_null | NOT NULL session_id |
| user_session_token_hash_key | UNIQUE (token_hash) |
| user_session_token_hash_not_null | NOT NULL token_hash |
| user_session_user_id_fkey | FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT |
| user_session_user_id_not_null | NOT NULL user_id |

## Routines

| Name | Arguments | Kind | Security |
| --- | --- | --- | --- |
| armor | bytea | function | INVOKER |
| armor | bytea, text[], text[] | function | INVOKER |
| crypt | text, text | function | INVOKER |
| dearmor | text | function | INVOKER |
| decrypt | bytea, bytea, text | function | INVOKER |
| decrypt_iv | bytea, bytea, bytea, text | function | INVOKER |
| digest | bytea, text | function | INVOKER |
| digest | text, text | function | INVOKER |
| encrypt | bytea, bytea, text | function | INVOKER |
| encrypt_iv | bytea, bytea, bytea, text | function | INVOKER |
| fips_mode |  | function | INVOKER |
| fn_account_close_guard |  | function | DEFINER |
| fn_agent_activity_scoped | p_agent uuid, p_from date, p_to date | function | DEFINER |
| fn_audit_log_immutable |  | function | INVOKER |
| fn_audit_master_changes |  | function | INVOKER |
| fn_calculate_fd_interest | p_principal numeric, p_rate numeric, p_days integer | function | INVOKER |
| fn_check_account_fd_eligible | p_account_id uuid | function | INVOKER |
| fn_check_account_holder_sets | p_account_ids uuid[] | function | DEFINER |
| fn_check_business_hours | check_ts timestamp with time zone | function | INVOKER |
| fn_check_plan_eligibility | p_plan_id uuid, p_date_of_birth date, p_holder_count integer | function | INVOKER |
| fn_check_plan_minimum | p_account_id uuid, p_resulting_balance numeric | function | INVOKER |
| fn_check_withdrawal_daily_limit | p_account_id uuid, p_amount numeric | function | INVOKER |
| fn_check_withdrawal_mandate | p_account_id uuid, p_signer_customer_ids uuid[] | function | INVOKER |
| fn_check_withdrawal_single_limit | p_amount numeric | function | INVOKER |
| fn_consume_password_reset | p_token_hash character varying, p_password_hash text | function | DEFINER |
| fn_customer_fd_actor_is_current |  | function | INVOKER |
| fn_fd_control_actor_is_current |  | function | INVOKER |
| fn_fd_funding_verdict | p_account_id uuid, p_principal numeric | function | INVOKER |
| fn_get_parameter | p_key character varying | function | INVOKER |
| fn_install_customer_fd_scope_guard |  | function | INVOKER |
| fn_install_customer_fd_summary |  | function | INVOKER |
| fn_install_fd_runtime_control |  | function | INVOKER |
| fn_invalidate_password_resets |  | function | DEFINER |
| fn_is_business_hour | check_ts timestamp with time zone | function | INVOKER |
| fn_issue_password_reset | p_user uuid, p_token_hash character varying | function | DEFINER |
| fn_mask_audit_values | p_table text, p_row jsonb | function | INVOKER |
| fn_next_account_number | p_branch_code character varying | function | DEFINER |
| fn_next_transaction_reference |  | function | INVOKER |
| fn_password_reset_valid | p_token_hash character varying | function | DEFINER |
| fn_payout_account |  | function | DEFINER |
| fn_post_savings_interest | p_account uuid, p_run uuid, p_cycle date | function | DEFINER |
| fn_post_staff_transfer | p_source uuid, p_destination uuid, p_amount numeric, p_actor uuid, p_signers uuid[], p_key character varying, p_narration character varying | function | DEFINER |
| fn_preserve_active_administrator |  | function | DEFINER |
| fn_prevent_account_branch_change |  | function | INVOKER |
| fn_prevent_branch_deactivation_with_active_agents |  | function | INVOKER |
| fn_return_fd_principal | p_fd uuid, p_cycle date | function | DEFINER |
| fn_reversal_actor_is_current |  | function | INVOKER |
| fn_reverse_transfer | p_original uuid, p_reason character varying, p_actor uuid, p_key character varying | function | DEFINER |
| fn_rls_branch_id |  | function | INVOKER |
| fn_rls_can_write | p_branch uuid | function | INVOKER |
| fn_rls_in_branch | p_branch uuid | function | INVOKER |
| fn_rls_is_bank_wide |  | function | INVOKER |
| fn_rls_role |  | function | INVOKER |
| fn_rls_user_id |  | function | INVOKER |
| fn_rpt01_exclusions | p_from date, p_to date, p_branch uuid | function | DEFINER |
| fn_rpt01_rows | p_from date, p_to date, p_branch uuid, p_agent uuid | function | DEFINER |
| fn_rpt01_scope | p_branch uuid | function | INVOKER |
| fn_savings_interest | p_account uuid, p_start date, p_end date, p_rate numeric | function | INVOKER |
| fn_trg_account_holder_inserted |  | function | DEFINER |
| fn_trg_account_holder_updated |  | function | DEFINER |
| fn_validate_agent_active_branch |  | function | INVOKER |
| fn_validate_joint_mandate_fit |  | function | DEFINER |
| fn_validate_transfer_pair |  | function | DEFINER |
| fn_validate_transfer_reversal |  | function | DEFINER |
| fn_verify_customer_document | p_doc_id uuid, p_actor uuid | function | DEFINER |
| fn_withdrawal_mandate_verdict | p_account_id uuid, p_signer_customer_ids uuid[] | function | INVOKER |
| gen_random_bytes | integer | function | INVOKER |
| gen_random_uuid |  | function | INVOKER |
| gen_salt | text | function | INVOKER |
| gen_salt | text, integer | function | INVOKER |
| gin_extract_query_trgm | text, internal, smallint, internal, internal, internal, internal | function | INVOKER |
| gin_extract_value_trgm | text, internal | function | INVOKER |
| gin_trgm_consistent | internal, smallint, text, integer, internal, internal, internal, internal | function | INVOKER |
| gin_trgm_triconsistent | internal, smallint, text, integer, internal, internal, internal | function | INVOKER |
| gtrgm_compress | internal | function | INVOKER |
| gtrgm_consistent | internal, text, smallint, oid, internal | function | INVOKER |
| gtrgm_decompress | internal | function | INVOKER |
| gtrgm_distance | internal, text, smallint, oid, internal | function | INVOKER |
| gtrgm_in | cstring | function | INVOKER |
| gtrgm_options | internal | function | INVOKER |
| gtrgm_out | gtrgm | function | INVOKER |
| gtrgm_penalty | internal, internal, internal | function | INVOKER |
| gtrgm_picksplit | internal, internal | function | INVOKER |
| gtrgm_same | gtrgm, gtrgm, internal | function | INVOKER |
| gtrgm_union | internal, internal | function | INVOKER |
| hmac | bytea, bytea, text | function | INVOKER |
| hmac | text, text, text | function | INVOKER |
| set_limit | real | function | INVOKER |
| set_updated_at |  | function | INVOKER |
| show_limit |  | function | INVOKER |
| show_trgm | text | function | INVOKER |
| similarity | text, text | function | INVOKER |
| similarity_dist | text, text | function | INVOKER |
| similarity_op | text, text | function | INVOKER |
| sp_add_account_holder | IN p_account_id uuid, IN p_customer_id uuid, IN p_actor_user_id uuid, OUT p_account_holder_id uuid, OUT p_holder_count integer | procedure | INVOKER |
| sp_close_account | IN p_account_id uuid, IN p_actor_user_id uuid, OUT p_closed_at timestamp with time zone | procedure | INVOKER |
| sp_open_fd_controlled | p_account_id uuid, p_fd_plan_id uuid, p_amount numeric, p_user_id uuid, p_channel_id uuid | function | INVOKER |
| sp_open_fixed_deposit | p_account_id uuid, p_fd_plan_id uuid, p_amount numeric, p_user_id uuid, p_channel_id uuid | function | INVOKER |
| sp_open_savings_account | IN p_plan_id uuid, IN p_branch_id uuid, IN p_opened_by_agent_id uuid, IN p_holders jsonb, IN p_mandate jsonb, IN p_initial_deposit numeric, IN p_channel_id uuid, IN p_actor_user_id uuid, OUT p_account_id uuid, OUT p_account_number character varying, OUT p_current_balance numeric | procedure | INVOKER |
| sp_post_deposit | IN p_account_id uuid, IN p_amount numeric, IN p_channel_id uuid, IN p_initiated_by_user_id uuid, IN p_idempotency_key character varying, IN p_narration character varying, INOUT p_transaction_id uuid, INOUT p_reference_number character varying, INOUT p_balance_after numeric, INOUT p_posted_at timestamp with time zone | procedure | INVOKER |
| sp_post_interest_credit | IN p_account_id uuid, IN p_amount numeric, IN p_fd_id uuid, IN p_cycle_date date, INOUT p_transaction_id uuid, INOUT p_reference_number character varying, INOUT p_balance_after numeric | procedure | INVOKER |
| sp_post_withdrawal | IN p_account_id uuid, IN p_amount numeric, IN p_channel_id uuid, IN p_initiated_by_user_id uuid, IN p_requesting_customer_id uuid, IN p_idempotency_key character varying, IN p_narration character varying, OUT p_transaction_id uuid, OUT p_reference_number character varying, OUT p_balance_after numeric, OUT p_posted_at timestamp with time zone | procedure | INVOKER |
| sp_post_withdrawal | IN p_account_id uuid, IN p_amount numeric, IN p_channel_id uuid, IN p_initiated_by_user_id uuid, IN p_signer_customer_ids uuid[], IN p_idempotency_key character varying, IN p_narration character varying, OUT p_transaction_id uuid, OUT p_reference_number character varying, OUT p_balance_after numeric, OUT p_posted_at timestamp with time zone | procedure | INVOKER |
| sp_reverse_transaction | IN p_original_transaction_id uuid, IN p_reason character varying, IN p_reversed_by_user_id uuid, INOUT p_reversal_transaction_id uuid, INOUT p_reversal_reference character varying, INOUT p_balance_after numeric | procedure | INVOKER |
| sp_reverse_transaction_controlled | IN p_original_transaction_id uuid, IN p_reason character varying, IN p_reversed_by_user_id uuid, IN p_idempotency_key character varying, INOUT p_reversal_transaction_id uuid, INOUT p_reversal_reference character varying, INOUT p_balance_after numeric | procedure | INVOKER |
| sp_run_interest_cycle | p_cycle_date date, p_user_id uuid | function | INVOKER |
| sp_try_customer_withdrawal | IN p_account_id uuid, IN p_amount numeric, IN p_channel_id uuid, IN p_initiated_by_user_id uuid, IN p_signer_customer_ids uuid[], IN p_idempotency_key character varying, IN p_narration character varying, OUT p_transaction_id uuid, OUT p_reference_number character varying, OUT p_balance_after numeric, OUT p_posted_at timestamp with time zone, OUT p_rejection_code character varying | procedure | DEFINER |
| sp_try_post_withdrawal | IN p_account_id uuid, IN p_amount numeric, IN p_channel_id uuid, IN p_initiated_by_user_id uuid, IN p_signer_customer_ids uuid[], IN p_idempotency_key character varying, IN p_narration character varying, OUT p_transaction_id uuid, OUT p_reference_number character varying, OUT p_balance_after numeric, OUT p_posted_at timestamp with time zone, OUT p_rejection_code character varying | procedure | INVOKER |
| sp_write_rejection_audit | IN p_account_id uuid, IN p_user_id uuid, IN p_reason character varying | procedure | INVOKER |
| strict_word_similarity | text, text | function | INVOKER |
| strict_word_similarity_commutator_op | text, text | function | INVOKER |
| strict_word_similarity_dist_commutator_op | text, text | function | INVOKER |
| strict_word_similarity_dist_op | text, text | function | INVOKER |
| strict_word_similarity_op | text, text | function | INVOKER |
| trg_fn_financial_transaction_immutable |  | function | INVOKER |
| word_similarity | text, text | function | INVOKER |
| word_similarity_commutator_op | text, text | function | INVOKER |
| word_similarity_dist_commutator_op | text, text | function | INVOKER |
| word_similarity_dist_op | text, text | function | INVOKER |
| word_similarity_op | text, text | function | INVOKER |

## Views

| Name |
| --- |
| vw_customer_fd_summary |
| vw_reconciliation_balance |
| vw_reconciliation_running_balance |
| vw_rpt01_agent_transactions |
| vw_rpt02_account_summary |
| vw_rpt03_active_fds |
| vw_rpt04_interest_distribution |
| vw_rpt05_customer_activity |

## Indexes

| Table | Name | Definition |
| --- | --- | --- |
| account | account_pkey | CREATE UNIQUE INDEX account_pkey ON public.account USING btree (account_id) |
| account | ix_account_branch_status | CREATE INDEX ix_account_branch_status ON public.account USING btree (branch_id, status) |
| account | ix_account_plan | CREATE INDEX ix_account_plan ON public.account USING btree (plan_id) |
| account | ix_account_status | CREATE INDEX ix_account_status ON public.account USING btree (status) |
| account | uq_account_account_number | CREATE UNIQUE INDEX uq_account_account_number ON public.account USING btree (account_number) |
| account_holder | account_holder_pkey | CREATE UNIQUE INDEX account_holder_pkey ON public.account_holder USING btree (account_holder_id) |
| account_holder | ix_account_holder_customer | CREATE INDEX ix_account_holder_customer ON public.account_holder USING btree (customer_id) |
| account_holder | uq_account_holder_account_customer | CREATE UNIQUE INDEX uq_account_holder_account_customer ON public.account_holder USING btree (account_id, customer_id) |
| account_holder | uq_account_holder_one_primary | CREATE UNIQUE INDEX uq_account_holder_one_primary ON public.account_holder USING btree (account_id) WHERE ((holder_type)::text = 'PRIMARY'::text) |
| account_opening_request | account_opening_request_pkey | CREATE UNIQUE INDEX account_opening_request_pkey ON public.account_opening_request USING btree (request_id) |
| account_opening_request | uq_account_opening_request_account | CREATE UNIQUE INDEX uq_account_opening_request_account ON public.account_opening_request USING btree (account_id) |
| account_opening_request | uq_account_opening_request_user_key | CREATE UNIQUE INDEX uq_account_opening_request_user_key ON public.account_opening_request USING btree (user_id, idempotency_key) |
| agent | agent_pkey | CREATE UNIQUE INDEX agent_pkey ON public.agent USING btree (agent_id) |
| agent | ix_agent_branch_status | CREATE INDEX ix_agent_branch_status ON public.agent USING btree (branch_id, status) |
| agent | uq_agent_email | CREATE UNIQUE INDEX uq_agent_email ON public.agent USING btree (email) |
| agent | uq_agent_employee_no | CREATE UNIQUE INDEX uq_agent_employee_no ON public.agent USING btree (employee_no) |
| agent | uq_agent_nic_passport_no | CREATE UNIQUE INDEX uq_agent_nic_passport_no ON public.agent USING btree (nic_passport_no) |
| app_user | app_user_pkey | CREATE UNIQUE INDEX app_user_pkey ON public.app_user USING btree (user_id) |
| app_user | app_user_username_key | CREATE UNIQUE INDEX app_user_username_key ON public.app_user USING btree (username) |
| app_user | ix_app_user_role_status | CREATE INDEX ix_app_user_role_status ON public.app_user USING btree (role_id, status) |
| audit_log | audit_log_pkey | CREATE UNIQUE INDEX audit_log_pkey ON public.audit_log USING btree (log_id) |
| audit_log | ix_audit_log_entity | CREATE INDEX ix_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id) |
| audit_log | ix_audit_log_user_time | CREATE INDEX ix_audit_log_user_time ON public.audit_log USING btree (user_id, logged_at DESC) |
| branch | branch_pkey | CREATE UNIQUE INDEX branch_pkey ON public.branch USING btree (branch_id) |
| branch | uq_branch_branch_code | CREATE UNIQUE INDEX uq_branch_branch_code ON public.branch USING btree (branch_code) |
| business_calendar | business_calendar_calendar_date_key | CREATE UNIQUE INDEX business_calendar_calendar_date_key ON public.business_calendar USING btree (calendar_date) |
| business_calendar | business_calendar_pkey | CREATE UNIQUE INDEX business_calendar_pkey ON public.business_calendar USING btree (calendar_id) |
| customer | customer_pkey | CREATE UNIQUE INDEX customer_pkey ON public.customer USING btree (customer_id) |
| customer | ix_customer_branch | CREATE INDEX ix_customer_branch ON public.customer USING btree (branch_id) |
| customer | ix_customer_full_name_trgm | CREATE INDEX ix_customer_full_name_trgm ON public.customer USING gin (full_name gin_trgm_ops) |
| customer | uq_customer_app_user_id | CREATE UNIQUE INDEX uq_customer_app_user_id ON public.customer USING btree (app_user_id) |
| customer | uq_customer_email | CREATE UNIQUE INDEX uq_customer_email ON public.customer USING btree (email) |
| customer | uq_customer_nic_passport_no | CREATE UNIQUE INDEX uq_customer_nic_passport_no ON public.customer USING btree (nic_passport_no) |
| customer | uq_customer_number | CREATE UNIQUE INDEX uq_customer_number ON public.customer USING btree (customer_number) |
| customer_agent | customer_agent_pkey | CREATE UNIQUE INDEX customer_agent_pkey ON public.customer_agent USING btree (cust_agent_id) |
| customer_agent | ix_customer_agent_agent | CREATE INDEX ix_customer_agent_agent ON public.customer_agent USING btree (agent_id) |
| customer_agent | ix_customer_agent_customer | CREATE INDEX ix_customer_agent_customer ON public.customer_agent USING btree (customer_id) |
| customer_agent | ux_customer_agent_one_active | CREATE UNIQUE INDEX ux_customer_agent_one_active ON public.customer_agent USING btree (customer_id) WHERE is_active |
| customer_document | customer_document_pkey | CREATE UNIQUE INDEX customer_document_pkey ON public.customer_document USING btree (doc_id) |
| customer_document | ix_customer_document_customer | CREATE INDEX ix_customer_document_customer ON public.customer_document USING btree (customer_id) |
| fd_maturity_receipt | fd_maturity_receipt_fd_id_key | CREATE UNIQUE INDEX fd_maturity_receipt_fd_id_key ON public.fd_maturity_receipt USING btree (fd_id) |
| fd_maturity_receipt | fd_maturity_receipt_pkey | CREATE UNIQUE INDEX fd_maturity_receipt_pkey ON public.fd_maturity_receipt USING btree (receipt_id) |
| fd_maturity_receipt | fd_maturity_receipt_transaction_id_key | CREATE UNIQUE INDEX fd_maturity_receipt_transaction_id_key ON public.fd_maturity_receipt USING btree (transaction_id) |
| fd_opening_request | fd_opening_request_pkey | CREATE UNIQUE INDEX fd_opening_request_pkey ON public.fd_opening_request USING btree (request_id) |
| fd_opening_request | uq_fd_opening_actor_key | CREATE UNIQUE INDEX uq_fd_opening_actor_key ON public.fd_opening_request USING btree (actor_user_id, idempotency_key) |
| fd_plan | fd_plan_pkey | CREATE UNIQUE INDEX fd_plan_pkey ON public.fd_plan USING btree (fd_plan_id) |
| fd_plan | fd_plan_plan_name_key | CREATE UNIQUE INDEX fd_plan_plan_name_key ON public.fd_plan USING btree (plan_name) |
| fixed_deposit | fixed_deposit_funding_transaction_id_key | CREATE UNIQUE INDEX fixed_deposit_funding_transaction_id_key ON public.fixed_deposit USING btree (funding_transaction_id) |
| fixed_deposit | fixed_deposit_pkey | CREATE UNIQUE INDEX fixed_deposit_pkey ON public.fixed_deposit USING btree (fd_id) |
| fixed_deposit | ix_fd_due_interest | CREATE INDEX ix_fd_due_interest ON public.fixed_deposit USING btree (status, next_interest_date) WHERE ((status)::text = 'ACTIVE'::text) |
| fixed_deposit | uq_one_active_fd_per_account | CREATE UNIQUE INDEX uq_one_active_fd_per_account ON public.fixed_deposit USING btree (account_id) WHERE ((status)::text = 'ACTIVE'::text) |
| interest_payout | interest_payout_pkey | CREATE UNIQUE INDEX interest_payout_pkey ON public.interest_payout USING btree (interest_id) |
| interest_payout | interest_payout_transaction_id_key | CREATE UNIQUE INDEX interest_payout_transaction_id_key ON public.interest_payout USING btree (transaction_id) |
| interest_payout | ix_payout_cycle | CREATE INDEX ix_payout_cycle ON public.interest_payout USING btree (cycle_date) |
| interest_payout | uq_payout_fd_cycle | CREATE UNIQUE INDEX uq_payout_fd_cycle ON public.interest_payout USING btree (fd_id, cycle_date) |
| interest_payout | uq_savings_payout_cycle | CREATE UNIQUE INDEX uq_savings_payout_cycle ON public.interest_payout USING btree (account_id, cycle_date) WHERE (source_type = 'SAVINGS'::text) |
| interest_run | interest_run_cycle_date_key | CREATE UNIQUE INDEX interest_run_cycle_date_key ON public.interest_run USING btree (cycle_date) |
| interest_run | interest_run_pkey | CREATE UNIQUE INDEX interest_run_pkey ON public.interest_run USING btree (run_id) |
| joint_mandate | joint_mandate_pkey | CREATE UNIQUE INDEX joint_mandate_pkey ON public.joint_mandate USING btree (mandate_id) |
| joint_mandate | uq_joint_mandate_account | CREATE UNIQUE INDEX uq_joint_mandate_account ON public.joint_mandate USING btree (account_id) |
| login_attempt | ix_login_attempt_user_time | CREATE INDEX ix_login_attempt_user_time ON public.login_attempt USING btree (username_attempted, attempted_at DESC) |
| login_attempt | login_attempt_pkey | CREATE UNIQUE INDEX login_attempt_pkey ON public.login_attempt USING btree (attempt_id) |
| password_reset_token | ix_password_reset_user | CREATE INDEX ix_password_reset_user ON public.password_reset_token USING btree (user_id) |
| password_reset_token | password_reset_token_pkey | CREATE UNIQUE INDEX password_reset_token_pkey ON public.password_reset_token USING btree (reset_id) |
| password_reset_token | password_reset_token_token_hash_key | CREATE UNIQUE INDEX password_reset_token_token_hash_key ON public.password_reset_token USING btree (token_hash) |
| role | role_pkey | CREATE UNIQUE INDEX role_pkey ON public.role USING btree (role_id) |
| role | role_role_name_key | CREATE UNIQUE INDEX role_role_name_key ON public.role USING btree (role_name) |
| savings_plan | savings_plan_pkey | CREATE UNIQUE INDEX savings_plan_pkey ON public.savings_plan USING btree (plan_id) |
| savings_plan | savings_plan_plan_name_key | CREATE UNIQUE INDEX savings_plan_plan_name_key ON public.savings_plan USING btree (plan_name) |
| schema_migration | schema_migration_pkey | CREATE UNIQUE INDEX schema_migration_pkey ON public.schema_migration USING btree (filename) |
| system_parameter | system_parameter_param_key_key | CREATE UNIQUE INDEX system_parameter_param_key_key ON public.system_parameter USING btree (param_key) |
| system_parameter | system_parameter_pkey | CREATE UNIQUE INDEX system_parameter_pkey ON public.system_parameter USING btree (param_id) |
| transaction | ix_transaction_branch_date | CREATE INDEX ix_transaction_branch_date ON public.transaction USING btree (branch_id, transaction_date) |
| transaction | ix_txn_account_date | CREATE INDEX ix_txn_account_date ON public.transaction USING btree (account_id, transaction_date DESC) |
| transaction | ix_txn_agent_date | CREATE INDEX ix_txn_agent_date ON public.transaction USING btree (agent_id, transaction_date) |
| transaction | transaction_pkey | CREATE UNIQUE INDEX transaction_pkey ON public.transaction USING btree (transaction_id) |
| transaction | uq_transfer_leg | CREATE UNIQUE INDEX uq_transfer_leg ON public.transaction USING btree (transfer_group_id, transaction_type) WHERE (transfer_group_id IS NOT NULL) |
| transaction | ux_transaction_account_ledger_seq | CREATE UNIQUE INDEX ux_transaction_account_ledger_seq ON public.transaction USING btree (account_id, ledger_seq) |
| transaction | ux_transaction_idempotency | CREATE UNIQUE INDEX ux_transaction_idempotency ON public.transaction USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL) |
| transaction | ux_transaction_reference | CREATE UNIQUE INDEX ux_transaction_reference ON public.transaction USING btree (reference_number) |
| transaction_channel | transaction_channel_channel_name_key | CREATE UNIQUE INDEX transaction_channel_channel_name_key ON public.transaction_channel USING btree (channel_name) |
| transaction_channel | transaction_channel_pkey | CREATE UNIQUE INDEX transaction_channel_pkey ON public.transaction_channel USING btree (channel_id) |
| transaction_reversal | transaction_reversal_original_transaction_id_key | CREATE UNIQUE INDEX transaction_reversal_original_transaction_id_key ON public.transaction_reversal USING btree (original_transaction_id) |
| transaction_reversal | transaction_reversal_pkey | CREATE UNIQUE INDEX transaction_reversal_pkey ON public.transaction_reversal USING btree (reversal_id) |
| transaction_reversal | transaction_reversal_reversal_transaction_id_key | CREATE UNIQUE INDEX transaction_reversal_reversal_transaction_id_key ON public.transaction_reversal USING btree (reversal_transaction_id) |
| transaction_reversal | ux_transaction_reversal_original | CREATE UNIQUE INDEX ux_transaction_reversal_original ON public.transaction_reversal USING btree (original_transaction_id) |
| user_session | user_session_pkey | CREATE UNIQUE INDEX user_session_pkey ON public.user_session USING btree (session_id) |
| user_session | user_session_token_hash_key | CREATE UNIQUE INDEX user_session_token_hash_key ON public.user_session USING btree (token_hash) |

## RLS policies

| Table | Policy | Command | USING | WITH CHECK |
| --- | --- | --- | --- | --- |
| account | account_insert_scope | INSERT | — | fn_rls_can_write(branch_id) |
| account | account_interest_worker_select | SELECT | ((fn_rls_role() = 'SYSTEM'::text) AND fn_fd_control_actor_is_current()) | — |
| account | account_interest_worker_update | UPDATE | ((fn_rls_role() = 'SYSTEM'::text) AND fn_fd_control_actor_is_current()) | ((fn_rls_role() = 'SYSTEM'::text) AND fn_fd_control_actor_is_current()) |
| account | account_select_customer_own | SELECT | ((fn_rls_role() = 'CUSTOMER'::text) AND (EXISTS ( SELECT 1    FROM (account_holder ah      JOIN customer c ON ((c.customer_id = ah.customer_id)))   WHERE ((ah.account_id = account.account_id) AND (c.app_user_id = fn_rls_user_id()))))) | — |
| account | account_select_scope | SELECT | (fn_rls_is_bank_wide() OR fn_rls_in_branch(branch_id)) | — |
| account | account_update_scope | UPDATE | fn_rls_can_write(branch_id) | fn_rls_can_write(branch_id) |
| customer | customer_insert_scope | INSERT | — | fn_rls_can_write(branch_id) |
| customer | customer_select_scope | SELECT | (fn_rls_is_bank_wide() OR fn_rls_in_branch(branch_id) OR ((fn_rls_role() = 'CUSTOMER'::text) AND (app_user_id IS NOT NULL) AND (app_user_id = fn_rls_user_id()))) | — |
| customer | customer_update_scope | UPDATE | fn_rls_can_write(branch_id) | fn_rls_can_write(branch_id) |
| customer_agent | customer_agent_insert_scope | INSERT | — | ((EXISTS ( SELECT 1    FROM customer c   WHERE ((c.customer_id = customer_agent.customer_id) AND fn_rls_in_branch(c.branch_id)))) AND ((fn_rls_role() = 'BRANCH_MANAGER'::text) OR (agent_id = fn_rls_user_id()))) |
| customer_agent | customer_agent_select_scope | SELECT | (EXISTS ( SELECT 1    FROM customer c   WHERE ((c.customer_id = customer_agent.customer_id) AND (fn_rls_is_bank_wide() OR fn_rls_in_branch(c.branch_id) OR ((fn_rls_role() = 'CUSTOMER'::text) AND (c.app_user_id = fn_rls_user_id())))))) | — |
| customer_document | customer_document_insert_scope | INSERT | — | ((EXISTS ( SELECT 1    FROM customer c   WHERE ((c.customer_id = customer_document.customer_id) AND fn_rls_in_branch(c.branch_id)))) AND (verified_by IS NULL) AND (verified_date IS NULL)) |
| customer_document | customer_document_select_scope | SELECT | (EXISTS ( SELECT 1    FROM customer c   WHERE ((c.customer_id = customer_document.customer_id) AND (fn_rls_is_bank_wide() OR fn_rls_in_branch(c.branch_id) OR ((fn_rls_role() = 'CUSTOMER'::text) AND (c.app_user_id = fn_rls_user_id())))))) | — |
| fd_maturity_receipt | maturity_read | SELECT | (EXISTS ( SELECT 1    FROM fixed_deposit f   WHERE (f.fd_id = fd_maturity_receipt.fd_id))) | — |
| fd_opening_request | fd_opening_request_insert | INSERT | — | ((actor_user_id = fn_rls_user_id()) AND (fn_rls_role() = ANY (ARRAY['AGENT'::text, 'BRANCH_MANAGER'::text, 'CENTRAL_OPS'::text]))) |
| fd_opening_request | fd_opening_request_read | SELECT | (actor_user_id = fn_rls_user_id()) | — |
| fixed_deposit | fixed_deposit_control_select | SELECT | fn_fd_control_actor_is_current() | — |
| fixed_deposit | fixed_deposit_customer_listing_actor_guard | SELECT | (fn_customer_fd_actor_is_current() OR fn_fd_control_actor_is_current()) | — |
| fixed_deposit | fixed_deposit_customer_listing_select | SELECT | ((fn_rls_role() = ANY (ARRAY['AGENT'::text, 'BRANCH_MANAGER'::text, 'CENTRAL_OPS'::text, 'AUDITOR'::text, 'CUSTOMER'::text])) AND (EXISTS ( SELECT 1    FROM ((account a      JOIN account_holder ah ON ((ah.account_id = a.account_id)))      JOIN customer c ON ((c.customer_id = ah.customer_id)))   WHERE ((a.account_id = fixed_deposit.account_id) AND ((fn_rls_role() = ANY (ARRAY['CENTRAL_OPS'::text, 'AUDITOR'::text])) OR (fn_rls_in_branch(a.branch_id) AND fn_rls_in_branch(c.branch_id) AND ((fn_rls_role() = 'BRANCH_MANAGER'::text) OR (EXISTS ( SELECT 1            FROM customer_agent ca           WHERE ((ca.customer_id = c.customer_id) AND (ca.agent_id = fn_rls_user_id()) AND ca.is_active))))) OR ((fn_rls_role() = 'CUSTOMER'::text) AND (c.app_user_id = fn_rls_user_id()))))))) | — |
| fixed_deposit | fixed_deposit_insert_scope | INSERT | — | ((fn_fd_control_actor_is_current() OR (fn_customer_fd_actor_is_current() AND (fn_rls_role() = ANY (ARRAY['AGENT'::text, 'BRANCH_MANAGER'::text])))) AND (EXISTS ( SELECT 1    FROM account a   WHERE (a.account_id = fixed_deposit.account_id)))) |
| fixed_deposit | fixed_deposit_update_control | UPDATE | fn_fd_control_actor_is_current() | fn_fd_control_actor_is_current() |
| interest_payout | interest_payout_insert | INSERT | — | (fn_fd_control_actor_is_current() AND (EXISTS ( SELECT 1    FROM account a   WHERE (a.account_id = interest_payout.account_id)))) |
| interest_payout | interest_payout_read | SELECT | (EXISTS ( SELECT 1    FROM account a   WHERE (a.account_id = interest_payout.account_id))) | — |
| interest_run | interest_run_insert | INSERT | — | fn_fd_control_actor_is_current() |
| interest_run | interest_run_read | SELECT | (fn_fd_control_actor_is_current() OR (fn_rls_role() = 'AUDITOR'::text)) | — |
| interest_run | interest_run_update | UPDATE | fn_fd_control_actor_is_current() | fn_fd_control_actor_is_current() |
| transaction | transaction_insert_scope | INSERT | — | (COALESCE((fn_rls_role() = ANY (ARRAY['ADMIN'::text, 'CENTRAL_OPS'::text, 'BRANCH_MANAGER'::text, 'AGENT'::text, 'CUSTOMER'::text])), false) AND (EXISTS ( SELECT 1    FROM account a   WHERE (a.account_id = transaction.account_id)))) |
| transaction | transaction_interest_worker_insert | INSERT | — | ((fn_rls_role() = 'SYSTEM'::text) AND fn_fd_control_actor_is_current() AND ((transaction_type)::text = 'INTEREST_CREDIT'::text) AND (EXISTS ( SELECT 1    FROM account a   WHERE (a.account_id = transaction.account_id)))) |
| transaction | transaction_select_scope | SELECT | (EXISTS ( SELECT 1    FROM account a   WHERE (a.account_id = transaction.account_id))) | — |
| transaction_reversal | reversal_insert | INSERT | — | (fn_reversal_actor_is_current() AND (reversed_by_user_id = fn_rls_user_id()) AND (EXISTS ( SELECT 1    FROM (transaction o      JOIN transaction c ON ((c.account_id = o.account_id)))   WHERE ((o.transaction_id = transaction_reversal.original_transaction_id) AND (c.transaction_id = transaction_reversal.reversal_transaction_id) AND ((c.transaction_type)::text = 'REVERSAL'::text) AND (c.initiated_by_user_id = fn_rls_user_id()))))) |
| transaction_reversal | reversal_read | SELECT | (EXISTS ( SELECT 1    FROM transaction t   WHERE (t.transaction_id = transaction_reversal.original_transaction_id))) | — |

## Triggers

| Table | Name | Events | Timing | Function |
| --- | --- | --- | --- | --- |
| account | trg_account_close_guard | UPDATE | BEFORE | EXECUTE FUNCTION fn_account_close_guard() |
| account | trg_account_prevent_branch_change | UPDATE | BEFORE | EXECUTE FUNCTION fn_prevent_account_branch_change() |
| account | trg_account_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| account | trg_audit_account | INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| account_holder | trg_audit_account_holder | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| account_holder | trg_validate_joint_mandate | INSERT | AFTER | EXECUTE FUNCTION fn_trg_account_holder_inserted() |
| account_holder | trg_validate_joint_mandate_update | UPDATE | AFTER | EXECUTE FUNCTION fn_trg_account_holder_updated() |
| agent | trg_agent_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| agent | trg_audit_agent | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| agent | trg_validate_agent_active_branch | INSERT, UPDATE | BEFORE | EXECUTE FUNCTION fn_validate_agent_active_branch() |
| app_user | trg_audit_app_user | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| app_user | trg_invalidate_password_resets | UPDATE | AFTER | EXECUTE FUNCTION fn_invalidate_password_resets() |
| app_user | trg_last_administrator | UPDATE | BEFORE | EXECUTE FUNCTION fn_preserve_active_administrator() |
| audit_log | trg_audit_log_immutable | DELETE, UPDATE | BEFORE | EXECUTE FUNCTION fn_audit_log_immutable() |
| branch | trg_audit_branch | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| branch | trg_branch_prevent_deactivation_with_active_agents | UPDATE | BEFORE | EXECUTE FUNCTION fn_prevent_branch_deactivation_with_active_agents() |
| branch | trg_branch_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| customer | trg_audit_customer | INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| customer | trg_customer_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| customer_agent | trg_customer_agent_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| customer_document | trg_customer_document_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| interest_payout | trg_payout_account | INSERT | BEFORE | EXECUTE FUNCTION fn_payout_account() |
| joint_mandate | trg_joint_mandate_fit | INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_validate_joint_mandate_fit() |
| joint_mandate | trg_joint_mandate_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| role | trg_audit_role | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| savings_plan | trg_savings_plan_set_updated_at | UPDATE | BEFORE | EXECUTE FUNCTION set_updated_at() |
| system_parameter | trg_audit_system_parameter | DELETE, INSERT, UPDATE | AFTER | EXECUTE FUNCTION fn_audit_master_changes() |
| transaction | trg_financial_transaction_immutable | DELETE, UPDATE | BEFORE | EXECUTE FUNCTION trg_fn_financial_transaction_immutable() |
| transaction | trg_transfer_pair | INSERT | AFTER | EXECUTE FUNCTION fn_validate_transfer_pair() |
| transaction_reversal | trg_transfer_reversal_pair | INSERT | AFTER | EXECUTE FUNCTION fn_validate_transfer_reversal() |

## Migration ledger

- 0000_p00_shared_foundation.sql
- 0100_p01_m01_identity.sql
- 0104_p01_m01_parameters_audit.sql
- 0120_p01_m02_branch.sql
- 0121_p01_m02_agent.sql
- 0122_p01_m02_organization_audit.sql
- 0140_p01_m03_savings_plan.sql
- 0160_p01_m04_transaction_channel.sql
- 0180_p01_m05_fd_plan.sql
- 0200_p02_m01_audit_coverage.sql
- 0201_p02_m01_rls_policies.sql
- 0220_p02_m02_customer.sql
- 0221_p02_m02_customer_agent.sql
- 0222_p02_m02_customer_document.sql
- 0223_p02_m02_customer_child_access.sql
- 0240_p02_m03_account.sql
- 0241_p02_m03_account_holder.sql
- 0242_p02_m03_joint_mandate.sql
- 0243_p02_m03_sp_open_savings_account.sql
- 0244_p02_m03_account_opening_request.sql
- 0245_p02_m03_sp_add_account_holder.sql
- 0246_p02_m03_account_number_skip_existing.sql
- 0260_p02_m04_transaction.sql
- 0261_p02_m01_rls_audit_bind.sql
- 0300_p03_m01_business_rules_config.sql
- 0300_p03_m01_business_rules_helpers.sql
- 0320_p03_m02_transaction_attribution.sql
- 0360_p03_m04_transaction_reference_idempotency.sql
- 0361_p03_m04_sp_post_deposit.sql
- 0362_p03_m04_sp_post_withdrawal.sql
- 0363_p03_m04_transaction_reversal.sql
- 0363_p03_m04_withdrawal_contract_repair.sql
- 0401_p04_m01_cycle_config.sql
- 0420_p04_m02_customer_fd_view.sql
- 0421_p04_m02_customer_fd_scope_guard.sql
- 0440_p04_m03_fn_check_account_fd_eligible.sql
- 0441_p04_m03_sp_close_account.sql
- 0460_p04_m04_sp_post_interest_credit.sql
- 0480_p04_m05_fixed_deposit.sql
- 0482_p04_m05_interest_run.sql
- 0483_p04_m05_interest_credit_fix.sql
- 0520_p05_m02_rpt01_view.sql
- 0521_p05_m02_rpt01_runtime.sql
- 0540_p05_m03_rpt02_view.sql
- 0541_p05_m03_sp_open_account_balance_after.sql
- 0542_p05_m03_transaction_ledger_seq.sql
- 0543_p05_m03_rpt02_view_v2.sql
- 0560_p05_m04_rpt05_view.sql
- 0561_p05_m04_reconciliation_views.sql
- 0580_p05_m05_performance_indexes.sql
- 0620_p06_m02_interest_reference.sql
- 0621_p06_m02_transaction_rls.sql
- 0622_p06_m02_fd_runtime_control.sql
- 0623_p06_m02_fd_controlled_entry.sql
- 0624_p06_m02_agent_activity_guard.sql
- 0625_p06_m02_interest_account_status.sql
- 0626_p06_m02_controlled_reversal.sql
- 0627_p06_m02_customer_withdrawal_control.sql
- 0628_p06_m02_deposit_contract_repair.sql
- 0629_p06_m02_document_verification.sql
- 0630_p06_m02_reconciliation_order.sql
- 0631_p06_m02_staff_transfers.sql
- 0632_p06_m02_savings_interest_maturity.sql
- 0633_p06_m02_extended_reports.sql
- 0634_p06_m02_shared_debit_limit.sql
- 0635_p06_m02_fd_funding_link.sql
- 0636_p06_m02_lifecycle_reversal.sql
- 0637_p06_m02_last_admin_guard.sql
- 0638_p06_m02_password_reset.sql
- 0639_p06_m02_interest_closure_guard.sql
