"use client";
import { useEffect,useState } from 'react';
import ReportShell from '@/components/report/report-shell';
import type { ReportColumn } from '@/components/report/report-table';
import { accountRequest } from '@/app/accounts/account-client';
import type { ReportRequest,ReportResult } from '@/lib/report/report-handler';
import type { FdReportRow } from '@/services/report-service';

const fdColumns:ReportColumn<FdReportRow>[]=[{key:'account_number',label:'Account',kind:'text'},
  {key:'product_name',label:'Product',kind:'text'},{key:'principal_amount',label:'Principal',kind:'money'},
  {key:'next_interest_date',label:'Next payout',kind:'text'},
  {key:'estimated_next_payout',label:'Estimated payout',kind:'money'}];
const interestColumns:ReportColumn<FdReportRow>[]=[{key:'cycle_date',label:'Cycle',kind:'text'},
  {key:'savings_plan_name',label:'Savings plan',kind:'text'},{key:'fd_product_name',label:'FD product',kind:'text'},
  {key:'branch_name',label:'Branch',kind:'text'},{key:'distribution_count',label:'Distributions',kind:'count'},
  {key:'total_interest',label:'Interest',kind:'money'}];
export function FdReport({interest=false,scopeLabel}:{interest?:boolean;scopeLabel:string}){
  const [filters,setFilters]=useState<ReportRequest>({format:'json',page:1,pageSize:25});
  const [applied,setApplied]=useState(filters),[result,setResult]=useState<ReportResult<FdReportRow>|undefined>();
  const [error,setError]=useState(''),[loading,setLoading]=useState(true);
  const endpoint=interest?'/api/reports/interest-distribution':'/api/reports/active-fds';
  useEffect(()=>{
    const controller=new AbortController(),params=new URLSearchParams();
    for(const [key,value] of Object.entries(applied))if(value!==undefined && value!=='')params.set(key,String(value));
    setLoading(true);setError('');
    accountRequest<ReportResult<FdReportRow>>(endpoint+'?'+params,{signal:controller.signal}).then(response=>{
      if(response.ok)setResult(response.data);else{setResult(undefined);setError(response.error?.message ?? 'Unable to generate the report.');}
    }).catch(()=>{if(!controller.signal.aborted)setError('Unable to generate the report.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[applied,endpoint]);
  function page(value:number){const next={...applied,page:value};setFilters(next);setApplied(next);}
  return <div className="space-y-6">
    <ReportShell title={interest?'Monthly interest distribution':'Active fixed deposits'} filters={filters}
      onFilterChange={setFilters} onApply={()=>setApplied({...filters,page:1})} result={result} loading={loading}
      endpoint={endpoint} scopeLabel={scopeLabel} reportCode={interest?'RPT-04':'RPT-03'}
      columns={interest?interestColumns:fdColumns} emptyText="No matching rows in your permitted scope."
      caption={interest?'Scoped cycle, plan and branch subtotals':'Active fixed deposits and exact principal totals'}>
      {error && <p role="alert">{error}</p>}
    </ReportShell>
    {result && <div className="flex gap-4"><button className="btn btn-secondary" disabled={loading || (applied.page ?? 1)===1} onClick={()=>page((applied.page ?? 1)-1)}>Previous</button>
      <span>Page {applied.page ?? 1} · {result.totalRows} rows</span><button className="btn btn-secondary" disabled={loading || (applied.page ?? 1)*result.pageSize>=result.totalRows}
        onClick={()=>page((applied.page ?? 1)+1)}>Next</button></div>}
  </div>;
}
