// Bundles the Electron main process and preload script into single,
// dependency-free files with esbuild, instead of plain `tsc` emit. Plain
// `tsc` output still needs its runtime deps (electron-updater, pino, and
// their whole transitive tree) resolved from node_modules at packaging
// time — electron-builder's default dependency walker, combined with this
// project's pnpm-managed node_modules, was pulling in unrelated devDeps
// (babel, vitest, jsdom's own heavy deps) into the shipped app because
// those happen to be declared elsewhere in this single package.json.
// Bundling everything main.js/preload.js actually uses means the installer
// needs zero packaged node_modules for the Electron side (see the `!node_modules/**/*`
// exclusion in package.json's `build.files`) — verified by launching the
// packaged app after this change.
import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outdir: "dist-electron",
  external: ["electron"],
  sourcemap: false,
  logLevel: "info",
};

await build({ ...shared, entryPoints: ["electron/main.ts"] });
await build({ ...shared, entryPoints: ["electron/preload.ts"] });
