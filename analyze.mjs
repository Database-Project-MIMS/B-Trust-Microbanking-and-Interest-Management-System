import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const queries = [
    { name: 'RPT-01', sql: `EXPLAIN ANALYZE SELECT * FROM fn_rpt01_rows('2025-01-01', '2027-01-01', NULL, NULL)` },
    { name: 'RPT-02', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt02_account_summary` },
    { name: 'RPT-03', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt03_active_fds` },
    { name: 'RPT-04', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt04_interest_distribution` },
    { name: 'RPT-05', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt05_customer_activity` }
  ];

  let output = '';
  for (const q of queries) {
    output += `\n--- ${q.name} ---\n`;
    try {
      const res = await pool.query(q.sql);
      res.rows.forEach(r => output += r['QUERY PLAN'] + '\n');
    } catch (e) {
      output += `ERROR: ${e.message}\n`;
    }
  }
  pool.end();
  console.log(output);
}
main();
