// Next.js's `output: "standalone"` build does not copy `public/` or
// `.next/static` into `.next/standalone` on its own (by design, since a
// typical deployment serves those via a CDN instead). Electron has no CDN,
// so this script performs the copy documented at
// https://nextjs.org/docs/app/api-reference/config/next-config-js/output
// before electron-builder packages `.next/standalone` as a resource.
import { cp, lstat, readdir, readFile, realpath, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const require = createRequire(import.meta.url);

if (!existsSync(standaloneDir)) {
  throw new Error(
    '.next/standalone was not found. Run "next build" with output: "standalone" set before this script.',
  );
}

async function copyInto(from, to) {
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true, dereference: true });
}

// Some packages (e.g. next's own "baseline-browser-mapping" dependency)
// restrict their own package.json via an "exports" map, so
// require.resolve(`${pkg}/package.json`) throws ERR_PACKAGE_PATH_NOT_EXPORTED
// for them even though the package itself resolves fine. Resolve the
// package's real entry file instead (which exports maps do allow) and walk
// up to the nearest package.json.
function resolvePackageDir(packageName, fromFile) {
  const entryFile = require.resolve(packageName, { paths: [fromFile] });
  let dir = path.dirname(entryFile);
  while (!existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate a package.json above ${entryFile}`);
    }
    dir = parent;
  }
  return dir;
}

await copyInto(path.join(projectRoot, "public"), path.join(standaloneDir, "public"));
await copyInto(
  path.join(projectRoot, ".next", "static"),
  path.join(standaloneDir, ".next", "static"),
);

/**
 * Under pnpm, Next's tracer reconstructs node_modules as a mirror of pnpm's
 * own layout — including a nested node_modules/.pnpm/<pkg>/node_modules/...
 * store — but leaves the actual package directories as symlinks pointing
 * back to *this dev machine's* absolute node_modules path, at every depth
 * (not just the top level). That's fine for running the standalone server
 * in place, but useless once electron-builder copies .next/standalone
 * somewhere else for packaging: the symlink targets won't exist on an end
 * user's machine, and electron-builder's resource copy doesn't reliably
 * preserve symlinks anyway. Recursively walk the whole tree and replace
 * every symlink with a real, dereferenced copy so the packaged output is
 * fully self-contained.
 */
async function dereferenceSymlinkedPackages(dir) {
  const entries = await readdir(dir);

  for (const entry of entries) {
    const entryPath = path.join(dir, entry);
    const info = await lstat(entryPath);

    if (info.isSymbolicLink()) {
      const parentName = path.basename(dir);
      const packageName = parentName.startsWith("@") ? `${parentName}/${entry}` : entry;
      await dereferenceOneSymlink(entryPath, packageName);
      continue;
    }

    if (info.isDirectory()) {
      await dereferenceSymlinkedPackages(entryPath);
    }
  }
}

/**
 * Confirmed by a real CI failure (a fresh `pnpm install` on Linux, unlike
 * this project's Windows dev machine): pnpm's own internal
 * node_modules/.pnpm/node_modules/<pkg> "virtual store" compatibility
 * symlinks — not any specific package's real install location, just pnpm's
 * own flat-resolution convenience layer — can be dangling depending on the
 * pnpm store's state, throwing ENOENT from realpath(). Node's real module
 * resolution for anything that matters walks the actual
 * node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg> chain, not this
 * compatibility layer, so a broken link here isn't necessarily fatal — but
 * rather than silently drop it, try resolving the same package name from
 * this project's own node_modules first, and only give up and drop the
 * link (with a clear warning) if that also fails.
 */
async function dereferenceOneSymlink(entryPath, packageName) {
  let sourceDir;
  try {
    sourceDir = await realpath(entryPath);
  } catch {
    try {
      sourceDir = resolvePackageDir(packageName, path.join(projectRoot, "package.json"));
    } catch (resolveError) {
      console.warn(
        `Warning: could not resolve "${packageName}" for ${entryPath} (${resolveError.message}) — dropping the broken symlink.`,
      );
      await rm(entryPath, { recursive: true, force: true });
      return;
    }
  }

  await copyInto(sourceDir, entryPath);
}

await dereferenceSymlinkedPackages(path.join(standaloneDir, "node_modules"));

/**
 * Turbopack (Next 16's default bundler) externalizes packages it can't/won't
 * inline — argon2, jsdom, pg, pino, @prisma/client here — into their own
 * proxy directories under .next/node_modules, *separate* from the top-level
 * node_modules this script already dereferences above. Those proxies are
 * themselves symlinks straight to this dev machine's absolute pnpm store
 * path (confirmed by inspecting a real build), which is exactly the same
 * "works here, dangling everywhere else" bug already fixed for top-level
 * node_modules — just missed here because it's a second, separate
 * node_modules tree. This is the actual root cause of a real installed
 * Windows build failing every request with "Cannot find module
 * '.prisma/client/default'": the pg/argon2/pino symlinks were equally
 * broken, not just Prisma's.
 */
if (existsSync(path.join(standaloneDir, ".next", "node_modules"))) {
  await dereferenceSymlinkedPackages(path.join(standaloneDir, ".next", "node_modules"));
}

/**
 * Next's own output file tracer has gaps beyond what outputFileTracingIncludes
 * can reach: under pnpm, `next`'s own runtime dependencies (@swc/helpers,
 * @next/env, ...) live only in next's own nested node_modules, and the
 * tracer doesn't always follow that. Found by actually launching a packaged
 * build end-to-end and hitting "Cannot find module '@swc/helpers/...'", then
 * "Cannot find module '@next/env'" once that one was patched — rather than
 * patch these one at a time as each surfaces, ensure every dependency next's
 * own package.json declares is present, resolved the same way Node would
 * resolve it at runtime.
 */
/**
 * Recursively ensures every dependency a package declares in its own
 * package.json is present in ITS OWN nested node_modules, however deep.
 * Under pnpm, a package's dependencies are colocated in the pnpm store next
 * to it, not hoisted to the project root — dereferenceSymlinkedPackages
 * above only copies the *named* top-level package (pg, pino, argon2,
 * @prisma/client, ...), not that package's own further dependencies, so a
 * real installed app crashed with "Cannot find module 'pg-types'" /
 * 'pino-std-serializers' / '@prisma/client-runtime-utils' the moment any
 * of those packages actually ran. `visited` guards against dependency
 * cycles (real in this ecosystem, e.g. some packages depend on themselves
 * via peer chains).
 */
async function ensurePackageRuntimeDependencies(resolveFromPackageJson, destinationNodeModules, visited = new Set()) {
  if (visited.has(resolveFromPackageJson)) {
    return;
  }
  visited.add(resolveFromPackageJson);

  const packageJson = JSON.parse(await readFile(resolveFromPackageJson, "utf8"));
  const dependencyNames = Object.keys(packageJson.dependencies ?? {});

  for (const packageName of dependencyNames) {
    try {
      // Resolved from the REAL source location (which has full pnpm-store
      // context), never from the standalone copy — the copy has no
      // node_modules of its own yet to resolve anything from.
      const sourceDir = resolvePackageDir(packageName, resolveFromPackageJson);
      const destination = path.join(destinationNodeModules, ...packageName.split("/"));
      await copyInto(sourceDir, destination);
      await ensurePackageRuntimeDependencies(
        path.join(sourceDir, "package.json"),
        path.join(destination, "node_modules"),
        visited,
      );
    } catch (error) {
      // Not every declared "dependency" is actually require()-able —
      // @types/node and similar type-only packages have no JS entry point
      // to resolve at all. Skip rather than fail the whole build.
      console.warn(`Skipping runtime dependency "${packageName}": ${error.message}`);
    }
  }
}

const rootPackageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
for (const packageName of Object.keys(rootPackageJson.dependencies ?? {})) {
  const destination = path.join(standaloneDir, "node_modules", ...packageName.split("/"));
  // Browser-only deps (e.g. @base-ui/react) never make it into the
  // server-side standalone bundle at all — nothing to fix for those.
  if (!existsSync(path.join(destination, "package.json"))) {
    continue;
  }
  try {
    const realSourceDir = resolvePackageDir(packageName, path.join(projectRoot, "package.json"));
    const realPackageJsonPath = path.join(realSourceDir, "package.json");
    await ensurePackageRuntimeDependencies(realPackageJsonPath, path.join(destination, "node_modules"));
  } catch (error) {
    console.warn(`Skipping runtime dependency scan for "${packageName}": ${error.message}`);
  }
}

/**
 * Turbopack's .next/node_modules externals proxies (pg-<hash>, pino-<hash>,
 * argon2-<hash>, @prisma/client-<hash>, ...) were just dereferenced above
 * from their original symlink targets, but that only copies the named
 * package itself — not ITS OWN dependencies (pg needs pg-types, pino needs
 * pino-std-serializers, ...), which is exactly the gap
 * ensurePackageRuntimeDependencies just spent this whole script fixing for
 * the top-level node_modules copies. Rather than re-run that whole
 * resolution machinery a second time for a second tree, just replace each
 * proxy with a fresh copy of its now-fully-fixed top-level equivalent —
 * same content, guaranteed self-contained.
 */
async function replaceTurbopackExternalsWithFixedCopies() {
  const turbopackNodeModules = path.join(standaloneDir, ".next", "node_modules");
  const topLevelNodeModules = path.join(standaloneDir, "node_modules");
  if (!existsSync(turbopackNodeModules)) {
    return;
  }

  const hashSuffix = /^(.+)-[0-9a-f]{16}$/;

  async function replaceIn(dir, scopePrefix) {
    for (const entry of await readdir(dir)) {
      if (entry === ".prisma") {
        continue;
      }
      const entryPath = path.join(dir, entry);
      if (entry.startsWith("@") && (await lstat(entryPath)).isDirectory()) {
        await replaceIn(entryPath, entry);
        continue;
      }
      const match = entry.match(hashSuffix);
      if (!match) {
        continue;
      }
      const realName = scopePrefix ? `${scopePrefix}/${match[1]}` : match[1];
      const source = path.join(topLevelNodeModules, ...realName.split("/"));
      if (existsSync(source)) {
        // The top-level copy already had its own runtime dependencies
        // resolved by ensurePackageRuntimeDependencies below — reuse it
        // verbatim rather than re-running that resolution a second time.
        await copyInto(source, entryPath);
        continue;
      }

      // No top-level standalone/node_modules copy exists for this package
      // (confirmed by a real installed app: "jsdom" is only ever reachable
      // through this Turbopack externals proxy, never the top-level tree,
      // because Turbopack fully externalizes it out of the bundle graph —
      // the main dependency-fixing loop below skips packages like this
      // entirely, since it only walks the top-level tree). Fix this proxy's
      // OWN dependencies (whatwg-url, and transitively tr46) directly,
      // resolving from the real pnpm store the same way the top-level loop
      // does — resolving from entryPath itself would fail, since a copied
      // proxy directory sits outside the pnpm store's own node_modules
      // chain and can't see colocated sibling dependencies from there.
      try {
        const realSourceDir = resolvePackageDir(realName, path.join(projectRoot, "package.json"));
        await ensurePackageRuntimeDependencies(
          path.join(realSourceDir, "package.json"),
          path.join(entryPath, "node_modules"),
        );
      } catch (error) {
        console.warn(`Skipping runtime dependency scan for Turbopack external "${realName}": ${error.message}`);
      }
    }
  }

  await replaceIn(turbopackNodeModules, null);
}

await replaceTurbopackExternalsWithFixedCopies();

/**
 * Found by a real installed app crashing on the user's machine (every page
 * request failed, logging "Cannot find module '.prisma/client/default'",
 * which made the app quit ~15s after every launch since the health check
 * in electron/server.ts never got a non-500 response). Root cause: Turbopack
 * externalizes @prisma/client into its own proxy file at
 * .next/node_modules/@prisma/client-<hash>/default.js, whose content is
 * copied verbatim from the real @prisma/client/default.js — which does
 * `require('.prisma/client/default')`, resolving via a plain Node lookup
 * relative to *its own* directory. In the real pnpm store, that resolves
 * fine because prisma generate writes the actual generated client to
 * .prisma/client right next to @prisma/client itself (pnpm keeps them
 * colocated, not hoisted to the project root — confirmed by finding it at
 * node_modules/.pnpm/@prisma+client@<version>_.../node_modules/.prisma).
 * Turbopack's synthetic proxy directory has no such sibling, so the same
 * require that works from the real package's location fails from the
 * proxy's. Copy the real .prisma alongside Turbopack's proxy so the
 * resolution it depends on exists there too.
 */
async function fixPrismaDotPrismaSibling(destinationNodeModules) {
  if (!existsSync(destinationNodeModules)) {
    return;
  }

  const prismaClientDir = path.dirname(require.resolve("@prisma/client/package.json"));
  const prismaStoreNodeModules = path.dirname(path.dirname(prismaClientDir));
  const dotPrismaSource = path.join(prismaStoreNodeModules, ".prisma");

  if (!existsSync(dotPrismaSource)) {
    console.warn(
      `Warning: expected a .prisma directory next to @prisma/client at ${dotPrismaSource} but it wasn't there — skipping the .prisma sibling fix for ${destinationNodeModules}. If Prisma is still broken in the packaged app, this is why.`,
    );
    return;
  }

  await copyInto(dotPrismaSource, path.join(destinationNodeModules, ".prisma"));
}

// Same "@prisma/client's own require('.prisma/client/default') needs a
// real .prisma sibling, and pnpm never hoists it to the project root" gap
// applies at BOTH the top-level standalone node_modules (where
// ensurePackageRuntimeDependencies above made @prisma/client a real,
// dereferenced copy) and Turbopack's separate .next/node_modules externals
// proxy — fix both locations.
await fixPrismaDotPrismaSibling(path.join(standaloneDir, "node_modules"));
await fixPrismaDotPrismaSibling(path.join(standaloneDir, ".next", "node_modules"));

/**
 * `next build` with output: "standalone" copies the project's own .env
 * (confirmed by actually building: it lands at .next/standalone/.env every
 * time) so the standalone server.js can replicate `next start`'s env
 * loading — but .env is gitignored and must never ship inside the installer
 * (see docs/release-process.md's "runtime environment variables aren't
 * bundled" limitation: DATABASE_URL and friends are meant to come from real
 * OS environment variables on the end user's machine, not a file baked into
 * the build). Whatever secrets happen to be in the machine's .env at build
 * time would otherwise be embedded in every installer built from it.
 */
async function removeLeakedEnvFiles() {
  const candidates = [path.join(standaloneDir, ".env"), path.join(standaloneDir, ".next", ".env")];

  for (const candidate of candidates) {
    await rm(candidate, { force: true });
  }
}

await removeLeakedEnvFiles();

console.log(
  "Copied public/ and .next/static, dereferenced pnpm symlinks, patched next's own runtime dependencies, fixed the Prisma Turbopack externals shim, and stripped any leaked .env into .next/standalone",
);
