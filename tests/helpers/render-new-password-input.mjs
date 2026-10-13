import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
globalThis.React=React;
const {NewPasswordInput}=await import('../../components/mims/new-password-input.tsx');
process.stdout.write(JSON.stringify({
 required:renderToStaticMarkup(React.createElement(NewPasswordInput,{id:'agent-password',name:'password',required:true})),
 optional:renderToStaticMarkup(React.createElement(NewPasswordInput,{name:'password',required:false,'aria-describedby':'other-help'})),
}));
