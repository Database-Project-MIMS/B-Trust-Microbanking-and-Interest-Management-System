import nextPlugin from "@next/eslint-plugin-next";
import typescriptParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    languageOptions: { parser: typescriptParser },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: nextPlugin.configs["core-web-vitals"].rules,
  },
  { ignores: [".next/**", "node_modules/**"] },
];
