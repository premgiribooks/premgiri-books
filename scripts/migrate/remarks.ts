// Collects every judgment call / gap encountered during the migration and
// writes them to MIGRATION-REMARKS.md at the end — the "keep it unfilled and
// record a remark" requirement.
import { writeFile } from "node:fs/promises";

export class Remarks {
  private readonly items: string[] = [];

  add(text: string): void {
    this.items.push(text);
  }

  async write(filePath: string): Promise<void> {
    const lines = [
      "# Legacy Migration Remarks",
      "",
      `Generated ${new Date().toISOString()} by scripts/migrate-legacy-data.ts.`,
      "",
      "Items below are gaps, defaults, or judgment calls made while importing the legacy",
      "SQLite database (`prod.db`) into this Postgres schema. Review each and configure",
      "the corresponding setting/master before relying on the migrated data.",
      "",
      ...this.items.map((item, i) => `${i + 1}. ${item}`),
      "",
    ];
    await writeFile(filePath, lines.join("\n"), "utf8");
  }
}
