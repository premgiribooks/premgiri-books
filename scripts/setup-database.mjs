// Resolves DATABASE_URL (env -> local .env -> interactive prompt), persists it as a
// Windows *user* environment variable (`setx`, no elevation — writes HKCU\Environment),
// then applies pending Prisma migrations and runs the existing idempotent
// `prisma/seed.ts` bootstrap. See context/feature-specs/88-installer-database-setup.md.
//
// Deliberately never prints the resolved connection string (it embeds credentials) —
// only a redacted host/database summary, per code-standards.md's logging rule.
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

function redact(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\//, "") || "(default)";
    return `${url.hostname}:${url.port || "5432"}/${database}`;
  } catch {
    return "(unparsable connection string)";
  }
}

function isValidPostgresUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

async function promptForDatabaseUrl() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      "DATABASE_URL not found in the environment or .env — enter the PostgreSQL connection string: "
    );
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function resolveDatabaseUrl() {
  if (isValidPostgresUrl(process.env["DATABASE_URL"])) {
    return process.env["DATABASE_URL"];
  }

  const prompted = await promptForDatabaseUrl();
  if (!isValidPostgresUrl(prompted)) {
    throw new Error(
      "No valid DATABASE_URL was provided — expected a postgres:// or postgresql:// connection string."
    );
  }

  return prompted;
}

function persistAsUserEnvironmentVariable(databaseUrl) {
  if (process.platform !== "win32") {
    console.log(
      `Not running on Windows — add DATABASE_URL to your shell profile yourself (targeting ${redact(databaseUrl)}).`
    );
    return;
  }

  // `setx` (without /M) writes HKCU\Environment — a user-level variable, no admin
  // rights required. It only affects *future* processes; process.env is set separately
  // below so the migrate/seed steps in this same run see it immediately.
  execFileSync("setx", ["DATABASE_URL", databaseUrl], { stdio: "ignore" });
  console.log(`Persisted DATABASE_URL as a Windows user environment variable (${redact(databaseUrl)}).`);
}

function runPrismaStep(description, args, env) {
  console.log(`Running: ${description}...`);
  execFileSync("npx", ["prisma", ...args], { stdio: "inherit", env });
  console.log(`Done: ${description}.`);
}

async function main() {
  const databaseUrl = await resolveDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  process.env["DATABASE_URL"] = databaseUrl;

  persistAsUserEnvironmentVariable(databaseUrl);

  // Idempotent — applies only migrations not yet recorded in _prisma_migrations.
  runPrismaStep("prisma migrate deploy", ["migrate", "deploy"], env);

  // Idempotent — prisma.config.ts wires this to prisma/seed.ts, which only bootstraps
  // the "superadmin"/"admin" users and Default Company when they don't already exist.
  runPrismaStep("prisma db seed", ["db", "seed"], env);

  console.log("Database setup complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
