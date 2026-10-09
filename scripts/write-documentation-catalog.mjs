import { writeFileSync } from 'node:fs';
import { createMigrationClient } from '../lib/db/migration-client.mjs';
import { roles,routes } from '../tests/helpers/security-routes.mjs';

if(process.env.MIMS_ISOLATED_TEST!=='1')throw new Error('Generate documentation only from the isolated rebuild.');
const client=createMigrationClient(process.env.DATABASE_MIGRATION_URL);await client.connect();
const cell=value=>String(value ?? '—').replaceAll('|','\\|').replaceAll('\n',' ');
function table(headers,rows){return [headers.join(' | '),headers.map(()=> '---').join(' | '),...rows.map(row=>row.map(cell).join(' | '))].map(row=>'| '+row+' |').join('\n')+'\n';}
try{
  if((await client.query('SELECT current_database() AS name')).rows[0].name!=='mims_test_closeout')throw new Error('Unexpected database.');
  const tables=(await client.query(`SELECT c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`)).rows;
  const migrations=(await client.query('SELECT filename FROM schema_migration ORDER BY filename')).rows;
  let text='# 18 — Implemented Database Catalog\n\nGenerated from the clean isolated rebuild; no customer rows or secrets are included.\n'+
    `\n${tables.length} public tables; ${migrations.length} immutable migration entries. `+
    'Historical ERD and proposals are distinguished in [docs/04](04_database-schema.md).\n';
  for(const item of tables){
    text+=`\n## ${item.relname}\n\nOwner: ${item.owner}. RLS: ${item.relrowsecurity?'enabled':'disabled'}.\n\n`;
    const columns=(await client.query(`SELECT a.attname,format_type(a.atttypid,a.atttypmod) AS type,
      a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a
      JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[item.relname])).rows;
    text+=table(['Column','PostgreSQL type','Not null','Default'],columns.map(row=>[row.attname,row.type,row.attnotnull?'yes':'no',row.default_value]));
    const constraints=(await client.query(`SELECT k.conname,pg_get_constraintdef(k.oid) AS definition
      FROM pg_constraint k WHERE k.conrelid=$1::regclass ORDER BY k.conname`,[item.relname])).rows;
    text+='\n'+table(['Constraint','Definition'],constraints.map(row=>[row.conname,row.definition]));
  }
  for(const [heading,sql,headers,keys] of [
    ['Routines',`SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
      CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END AS kind,
      CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind IN ('p','f') AND p.proname NOT LIKE 'pg_%' ORDER BY p.proname,arguments`,
      ['Name','Arguments','Kind','Security'],['name','arguments','kind','security']],
    ['Views',`SELECT viewname AS name FROM pg_views WHERE schemaname='public' ORDER BY viewname`,['Name'],['name']],
    ['Indexes',`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,['Table','Name','Definition'],['tablename','indexname','indexdef']],
    ['RLS policies',`SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`,['Table','Policy','Command','USING','WITH CHECK'],['tablename','policyname','cmd','qual','with_check']],
    ['Triggers',`SELECT event_object_table,trigger_name,string_agg(event_manipulation,', ' ORDER BY event_manipulation) AS events,action_timing,action_statement
      FROM information_schema.triggers WHERE trigger_schema='public'
      GROUP BY event_object_table,trigger_name,action_timing,action_statement ORDER BY event_object_table,trigger_name`,
      ['Table','Name','Events','Timing','Function'],['event_object_table','trigger_name','events','action_timing','action_statement']],
  ])text+=`\n## ${heading}\n\n`+table(headers,(await client.query(sql)).rows.map(row=>keys.map(key=>row[key])));
  text+='\n## Migration ledger\n\n'+migrations.map(row=>'- '+row.filename).join('\n')+'\n';
  writeFileSync('docs/18_implemented-database-catalog.md',text);
  writeFileSync('docs/19_implemented-api-matrix.md','# 19 — Implemented API Permission Matrix\n\n'+
    'Independent contract used by the security suite; a completeness guard compares every exported route handler.\n'+
    'Allowed means the role reaches validation/business processing; valid-operation tests separately prove success.\n'+
    'Unauthenticated requests are denied except login and CSRF-protected idempotent logout. Worker interest requests require their separate bearer credential.\n\n'+
    'Roles: '+roles.join(', ')+'. SYSTEM is internal, not a human QA role.\n\n'+
    table(['Method','Endpoint','Allowed roles','Input positions probed'],routes.map(row=>[row.method,'/api/'+row.path.replace('[id]','{id}').replace('[key]','{key}'),row.allowed.join(', '),row.fields.join(', ')]))+
    '\nRead [endpoint contracts](05_api-and-pages.md) for payloads and success/error semantics. Branch and holder scope still applies to allowed roles.\n');
  console.log(`DOCUMENTATION CATALOG: ${tables.length} tables, ${migrations.length} migrations, ${routes.length} handlers.`);
}finally{await client.end();}
