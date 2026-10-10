import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
globalThis.React=React;
const {FdList}=await import('../../app/fixed-deposits/fd-list.tsx');
const {InterestConsole}=await import('../../app/interest-runs/interest-console.tsx');
const {FdReport}=await import('../../app/reports/fd-report.tsx');
const output={
  customer:renderToStaticMarkup(React.createElement(FdList,{canOpen:false})),
  staff:renderToStaticMarkup(React.createElement(FdList,{canOpen:true})),
  auditor:renderToStaticMarkup(React.createElement(InterestConsole,{canRun:false})),
  controller:renderToStaticMarkup(React.createElement(InterestConsole,{canRun:true})),
  report:renderToStaticMarkup(React.createElement(FdReport,{scopeLabel:'Colombo branch'})),
};
process.stdout.write(JSON.stringify(output));
