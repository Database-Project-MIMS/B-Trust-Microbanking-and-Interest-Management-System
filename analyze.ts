import { pool } from './lib/db/index.ts';

async function main() {
  const queries = [
    { name: 'RPT-01', sql: `EXPLAIN ANALYZE SELECT * FROM fn_rpt01_rows('2025-01-01', '2027-01-01', NULL, NULL)` },
    { name: 'RPT-02', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt02_account_summary` },
    { name: 'RPT-03', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt03_active_fds` },
    { name: 'RPT-04', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt04_interest_distribution` },
    { name: 'RPT-05', sql: `EXPLAIN ANALYZE SELECT * FROM vw_rpt05_customer_activity` }
  ];

  for (const q of queries) {
    console.log(`\n--- ${q.name} ---`);
    try {
      const res = await pool.query(q.sql);
      res.rows.forEach(r => console.log(r['QUERY PLAN']));
    } catch (e) {
      console.error(e.message);
    }
  }
  pool.end();
}

main();
