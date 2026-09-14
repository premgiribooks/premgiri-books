import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "dist-electron/**",
    // Puppeteer's downloaded Chromium (see .puppeteerrc.cjs) — a vendored
    // binary dependency, not project source. Its own bundled DevTools
    // frontend JS (e.g. resources/inspector_overlay/main.js) isn't written
    // to pass this project's lint rules and was never meant to be linted.
    // Only actually present after `pnpm install` downloads it, and its
    // exact packaged layout is platform-dependent (found the hard way: this
    // surfaced on Linux CI but not on a Windows dev machine, where the
    // downloaded package doesn't include the same loose resource files) —
    // ignored outright rather than relying on any one platform's layout.
    ".cache/**",
  ]),
]);

export default eslintConfig;
