// Renders the account fixed-deposit panel to static HTML for the markup tests.
// It runs in its own process because the test runner uses the "react-server" condition, which hides the
// DOM renderer; the classic JSX transform used here needs React in scope (tsconfig keeps "preserve" for Next).
// Input (stdin): { [name]: props }. Output (stdout): { [name]: html }.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.React = React;
const { AccountFixedDeposits } = await import("../../app/accounts/[id]/account-fixed-deposits.tsx");

let input = "";
for await (const chunk of process.stdin) input += chunk;
const cases = JSON.parse(input);
const output = {};
for (const [name, props] of Object.entries(cases)) output[name] = renderToStaticMarkup(React.createElement(AccountFixedDeposits, props));
process.stdout.write(JSON.stringify(output));
