#!/usr/bin/env bash
# One-time local database and role creation. See docs/10_local-setup.md.
set -euo pipefail

DB_NAME="${1:-mims_dev}"
PSQL_ADMIN="${PSQL_ADMIN:-postgres}"

read -rsp "Password for mims_owner: " OWNER_PW; echo
read -rsp "Password for mims_app:   " APP_PW; echo

psql -v ON_ERROR_STOP=1 -U "$PSQL_ADMIN" -d postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mims_owner') THEN
    CREATE ROLE mims_owner LOGIN PASSWORD '${OWNER_PW}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mims_app') THEN
    CREATE ROLE mims_app LOGIN PASSWORD '${APP_PW}';
  END IF;
END \$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER mims_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

echo "Created role mims_owner (schema owner) and mims_app (least-privilege app role)."
echo "Grants and RLS policies are applied from database/roles/ during db:rebuild."
echo "Now put the two connection strings in .env — see .env.example."
