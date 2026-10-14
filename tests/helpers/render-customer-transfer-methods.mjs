import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
globalThis.React=React;
const {CustomerTransferScreen}=await import('../../app/transactions/transfer/customer-transfer-screen.tsx');
const {PostingScreen}=await import('../../app/transactions/posting-screen.tsx');
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const ownAccounts=[{accountId:'11111111-1111-4111-8111-111111111111',accountNumber:'OWN-00000001',currentBalance:'1234.56'}];
const methods=[{method:'CASH',label:'Cash'},{method:'CHEQUE',label:'Cheque'}];
process.stdout.write(JSON.stringify({customer:render(CustomerTransferScreen,{ownAccounts}),empty:render(CustomerTransferScreen,{ownAccounts:[]}),
  deposit:render(PostingScreen,{kind:'deposit',methods}),withdraw:render(PostingScreen,{kind:'withdraw',methods})}));
