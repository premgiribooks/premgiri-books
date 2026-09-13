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
async function ensureNextRuntimeDependencies() {
  const nextPackageJsonPath = require.resolve("next/package.json");
  const nextPackageJson = JSON.parse(await readFile(nextPackageJsonPath, "utf8"));
  const nextDependencyNames = Object.keys(nextPackageJson.dependencies ?? {});

  for (const packageName of nextDependencyNames) {
    const sourceDir = resolvePackageDir(packageName, nextPackageJsonPath);
    const destination = path.join(
      standaloneDir,
      "node_modules",
      "next",
      "node_modules",
      ...packageName.split("/"),
    );
    await copyInto(sourceDir, destination);
  }
}

await ensureNextRuntimeDependencies();

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
  "Copied public/ and .next/static, dereferenced pnpm symlinks, patched next's own runtime dependencies, and stripped any leaked .env into .next/standalone",
);
