import pg from 'pg';

async function fix() {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("No DATABASE_MIGRATION_URL");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log("Connected");
  await client.query('DROP TRIGGER IF EXISTS trg_audit_role ON role;');
  await client.query('DROP TRIGGER IF EXISTS trg_audit_app_user ON app_user;');
  await client.query('DROP FUNCTION IF EXISTS fn_audit_master_changes CASCADE;');
  await client.query('DROP FUNCTION IF EXISTS fn_audit_log_immutable CASCADE;');
  await client.query('DROP FUNCTION IF EXISTS fn_is_business_hour CASCADE;');
  await client.query('DROP TABLE IF EXISTS audit_log CASCADE;');
  await client.query('DROP TABLE IF EXISTS system_parameter CASCADE;');
  await client.query('DROP TABLE IF EXISTS business_calendar CASCADE;');
  await client.query('DELETE FROM schema_migration WHERE filename = $1;', ['0104_p01_m01_parameters_audit.sql']);
  console.log("Dropped tables and schema_migration row");
  await client.end();
}

fix().catch(e => console.error(e));
