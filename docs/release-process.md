# Desktop release process

## How production is served

The app uses Server Actions and a live Postgres connection, so it can't be
statically exported. Instead, `next.config.ts` builds with
`output: "standalone"`, and `electron/server.ts` spawns the generated
`.next/standalone/server.js` as a local child process on a free port, then
loads that URL in the `BrowserWindow`. `scripts/prepare-standalone.mjs` (run
by `pnpm build`) copies `public/` and `.next/static` into the standalone
folder, since Next doesn't do that on its own.

## Cutting a release

1. Bump `version` in `package.json` and commit.
2. Tag it and push the tag: `git tag v1.2.0 && git push origin v1.2.0`.
3. `.github/workflows/release.yml` builds Windows/macOS/Linux installers on
   their native runners and publishes them to GitHub Releases via
   `electron-builder --publish always`. No manual step needed beyond the tag
   push.

To test a packaged build locally without publishing, run `pnpm dist:dir`
(unpacked, fastest) or `pnpm dist` (full installer for your current OS).

## Known limitations

- **Unsigned.** No code-signing certificate is configured. Windows will show
  a SmartScreen "unknown publisher" warning on first run; macOS builds are
  unsigned and unnotarized. Add signing later via electron-builder's
  `win.certificateFile`/`CSC_LINK` and Apple notarization options — this
  intentionally isn't set up yet.
- **Auto-update reliability by platform.** `electron-updater` is wired up on
  all three platforms, but Squirrel.Mac-based auto-update is only reliable
  for a signed and notarized app. Until macOS builds are signed, treat
  Windows (NSIS) as the platform where in-place auto-update is fully
  supported; macOS/Linux users may need to reinstall from a new GitHub
  Release instead of updating silently.
- **Runtime environment variables aren't bundled — deliberately stripped.**
  `next build` with `output: "standalone"` actually copies whichever `.env`
  exists on the build machine into `.next/standalone/.env` on its own (so
  the standalone `server.js` can replicate `next start`'s env loading) —
  confirmed by building and inspecting the output. Since `.env` is
  gitignored and would otherwise mean every installer embeds whatever
  secrets happen to be in the machine's `.env` at build time,
  `scripts/prepare-standalone.mjs` deletes it again before packaging, and
  `package.json`'s `build.extraResources` filter excludes it a second time
  as a backstop. `DATABASE_URL` and friends must instead be set as real OS
  environment variables on the machine running the installed app. A
  first-run configuration screen for this is a separate, not-yet-built
  feature.
- **Private repo + electron-updater.** If `premgiribooks/premgiri-books` is
  (or becomes) a private repository, `electron-updater`'s runtime update
  check needs a GitHub token to read releases — embedding one in a shipped
  app is a real credential-exposure risk, so this hasn't been done. Keeping
  releases on a public repo (or a separate public "releases" repo) avoids
  the problem entirely.
  - **This has already happened once** (see `progress-tracker.md`'s v1.0.5
    entry): the repo went private for a period and every installed app's
    update check failed with a 404 on `releases.atom`, logged as "Auto-update
    check failed." Verified public again as of this writing (2026-09-14) —
    `releases.atom` and `releases/latest/download/latest.yml` both resolve
    without auth.
  - `.github/workflows/release.yml`'s `create-release` job now has a
    "Verify releases repo is public" step that fails the whole release
    (before anything builds) if the repo is private at tag-push time — this
    can't prevent someone from flipping visibility private again *after* a
    release ships, but it does stop a new release from ever being published
    into that state.
  - `electron/updater.ts`'s `describeUpdateError()` recognizes this specific
    404 shape (an HttpError with `statusCode === 404`) and logs/reports a
    message naming the actual cause, instead of the raw HTTP error dump —
    check `main.log` for `"Auto-update check failed"` first if a user
    reports updates not working.
