#!/usr/bin/env bash
# Rebuild the database from empty, in the documented order (database/README.md).
# Destructive: drops and recreates the target database. Development only.
set -euo pipefail

DB_NAME="${1:-mims_dev}"
PSQL_ADMIN="${PSQL_ADMIN:-postgres}"

echo "==> Dropping and recreating database '$DB_NAME'"
psql -v ON_ERROR_STOP=1 -U "$PSQL_ADMIN" -d postgres \
  -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE);" \
  -c "CREATE DATABASE $DB_NAME;"

echo "==> 1/7 migrations"
node scripts/migrate.mjs up

apply_dir () {
  local dir="$1" label="$2"
  echo "==> $label"
  if compgen -G "$dir/*.sql" > /dev/null; then
    for f in "$dir"/*.sql; do
      echo "    $f"
      psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$f" -q
    done
  else
    echo "    (none yet)"
  fi
}

apply_dir database/routines "2/7 routines"
apply_dir database/triggers "3/7 triggers"
apply_dir database/views    "4/7 views"
apply_dir database/indexes  "5/7 indexes"
apply_dir database/roles    "6/7 roles and RLS"
apply_dir database/seed     "7/7 seed data"

echo "==> Rebuild complete. Verifying:"
node scripts/verify-setup.mjs
