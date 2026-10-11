import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
globalThis.React=React;
const {FdList}=await import('../../app/fixed-deposits/fd-list.tsx');
const {InterestConsole}=await import('../../app/interest-runs/interest-console.tsx');
const {FdReport}=await import('../../app/reports/fd-report.tsx');
const {default:ReportMetadata}=await import('../../components/report/report-metadata.tsx');
const metadata=filters=>renderToStaticMarkup(React.createElement(ReportMetadata,{generatedAt:'2026-10-10T00:00:00Z',requestedBy:'Synthetic QA',filters:{format:'json',...filters}}));
const output={
  customer:renderToStaticMarkup(React.createElement(FdList,{canOpen:false})),
  staff:renderToStaticMarkup(React.createElement(FdList,{canOpen:true})),
  auditor:renderToStaticMarkup(React.createElement(InterestConsole,{canRun:false})),
  controller:renderToStaticMarkup(React.createElement(InterestConsole,{canRun:true})),
  report:renderToStaticMarkup(React.createElement(FdReport,{scopeLabel:'Colombo branch'})),
  allDates:metadata({}),
  fromDate:metadata({from:'2026-03-01'}),
  toDate:metadata({to:'2026-03-31'}),
  dateRange:metadata({from:'2026-03-01',to:'2026-03-31'}),
};
process.stdout.write(JSON.stringify(output));
