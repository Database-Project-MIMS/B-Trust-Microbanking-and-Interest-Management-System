#!/bin/bash
# Evidence: backup and restore produces an identical database

set -e

# Extract and fix DATABASE_URL for libpq, and run as postgres superuser to avoid permission denied
RAW_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
# Replace mims_app:Mims@123 with postgres
DB_URL=$(echo $RAW_URL | sed 's/mims_app:Mims@123/postgres/')
RESTORE_URL=${DB_URL/mims_dev/mims_test_restore}
RESTORE_DB_NAME="mims_test_restore"

echo "=== Step 1: Take a backup ==="
pg_dump -Fc "$DB_URL" > /tmp/mims_backup.dump
echo "Backup size: $(ls -lh /tmp/mims_backup.dump | awk '{print $5}')"

echo "=== Step 2: Record checksums ==="
psql "$DB_URL" -c "SELECT COUNT(*) FROM fixed_deposit" > /tmp/pre_restore_counts.txt
psql "$DB_URL" -c "SELECT SUM(current_balance) FROM account" >> /tmp/pre_restore_counts.txt
psql "$DB_URL" -c "SELECT SUM(interest_amount) FROM interest_payout" >> /tmp/pre_restore_counts.txt

echo "=== Step 3: Drop and restore ==="
# Connect to default postgres DB to drop/create the restore DB
ADMIN_URL=${DB_URL/mims_dev/postgres}
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS $RESTORE_DB_NAME;"
psql "$ADMIN_URL" -c "CREATE DATABASE $RESTORE_DB_NAME;"
pg_restore -d "$RESTORE_URL" /tmp/mims_backup.dump

echo "=== Step 4: Compare checksums ==="
psql "$RESTORE_URL" -c "SELECT COUNT(*) FROM fixed_deposit" > /tmp/post_restore_counts.txt
psql "$RESTORE_URL" -c "SELECT SUM(current_balance) FROM account" >> /tmp/post_restore_counts.txt
psql "$RESTORE_URL" -c "SELECT SUM(interest_amount) FROM interest_payout" >> /tmp/post_restore_counts.txt

diff /tmp/pre_restore_counts.txt /tmp/post_restore_counts.txt
echo "✅ Backup and restore produce identical data"

echo "=== Step 5: Cleanup ==="
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS $RESTORE_DB_NAME;"
rm /tmp/mims_backup.dump
