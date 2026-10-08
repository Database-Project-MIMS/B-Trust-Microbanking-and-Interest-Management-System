// Renders report components to static HTML for the markup tests.
// It runs in its own process because the test runner uses the "react-server" condition, which hides the DOM
// renderer; the classic JSX transform needs React in scope (tsconfig keeps "preserve" for Next).
// Input (stdin): { [name]: { component: "shell" | "account-summary", props } }. Output (stdout): { [name]: html }.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.React = React;
const { default: ReportShell } = await import("../../components/report/report-shell.tsx");
const { AccountSummaryScreen } = await import("../../app/reports/account-summary/account-summary-screen.tsx");
const components = { shell: ReportShell, "account-summary": AccountSummaryScreen };

let input = "";
for await (const chunk of process.stdin) input += chunk;
const output = {};
for (const [name, { component, props }] of Object.entries(JSON.parse(input))) {
  output[name] = renderToStaticMarkup(React.createElement(components[component], props));
}
process.stdout.write(JSON.stringify(output));
