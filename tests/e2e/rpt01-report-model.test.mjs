import { describe,test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRpt01Query } from '../../lib/validation/rpt01-report.ts';
import { reportMoney } from '../../components/report/report-format.ts';
import { csvRow,streamCsv } from '../../lib/report/csv-export.ts';
describe('RPT-01 strict filters, exact presentation and incremental shared CSV',()=>{
  test('one real date implies a single day and uppercase UUIDs normalize',()=>{
    const filters=parseRpt01Query(new URLSearchParams('from=2026-09-01&agentId=AAAAAAAA-AAAA-4AAA-AAAA-AAAAAAAAAAAA'));
    assert.equal(filters.to,'2026-09-01');assert.equal(filters.agentId,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
  });
  test('huge/negative money remains string-exact and unresolved net is explicit',()=>{
    assert.equal(reportMoney('9999999999999990.01'),'LKR 9,999,999,999,999,990.01');
    assert.equal(reportMoney('-1.00'),'−LKR 1.00');assert.equal(reportMoney(null),'Unresolved');
  });
  test('quotes, CR/LF and formula prefixes are escaped without corrupting signed decimals',()=>{
    assert.equal(csvRow(['=1+1','\t@SUM(A1)','a,"b"\r\nc','-1.00']),'"\'=1+1","\'\t@SUM(A1)","a,""b""\r\nc","-1.00"\r\n');
  });
  test('source is consumed by pulls and cancellation cleans up without consuming all rows',async()=>{
    let count=0,cleaned=0;
    async function* rows(){for(let index=0;index<1000;index++){count++;yield {name:String(index)};}}
    const response=streamCsv({reportName:'probe',rows:[],filters:{format:'csv'},generatedAt:'2026-10-08T00:00:00Z',requestedBy:'test',totalRows:1000,page:1,pageSize:25},
      {rows:rows(),columns:[{key:'name',label:'Name'}],cleanup:async()=>{cleaned++;}});
    const reader=response.body.getReader();await reader.read();await reader.cancel();
    assert.ok(count<1000);assert.equal(cleaned,1);
  });
});
