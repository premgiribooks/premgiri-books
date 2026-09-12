import { describe, expect, it } from "vitest";
import type { LedgerGroup } from "@prisma/client";

import { buildLedgerGroupIndex, getRootGroup } from "@/engines/reporting/ledger-classification";

function group(overrides: Partial<LedgerGroup> & Pick<LedgerGroup, "id" | "name">): LedgerGroup {
  return {
    companyId: "company-1",
    parentGroupId: null,
    natureType: "ASSET",
    affectsGrossProfit: false,
    isSystemDefined: false,
    isActive: true,
    remarks: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildLedgerGroupIndex", () => {
  it("indexes every group and links each parent to its direct children only", () => {
    const root = group({ id: "root", name: "Fixed Assets" });
    const child = group({ id: "child", name: "Plant & Machinery", parentGroupId: "root" });
    const grandchild = group({ id: "grandchild", name: "Machinery - Unit A", parentGroupId: "child" });

    const index = buildLedgerGroupIndex([root, child, grandchild]);

    expect(index.size).toBe(3);
    expect(index.get("root")?.children).toEqual(["child"]);
    expect(index.get("child")?.children).toEqual(["grandchild"]);
    expect(index.get("grandchild")?.children).toEqual([]);
  });

  it("ignores a parentGroupId that isn't present in the given list", () => {
    const orphan = group({ id: "orphan", name: "Orphan Group", parentGroupId: "missing-parent" });

    const index = buildLedgerGroupIndex([orphan]);

    expect(index.get("orphan")?.children).toEqual([]);
  });
});

describe("getRootGroup", () => {
  it("resolves the correct top-level ancestor for a 3+-level-deep group", () => {
    const root = group({ id: "root", name: "Fixed Assets" });
    const child = group({ id: "child", name: "Plant & Machinery", parentGroupId: "root" });
    const grandchild = group({ id: "grandchild", name: "Machinery - Unit A", parentGroupId: "child" });
    const index = buildLedgerGroupIndex([root, child, grandchild]);

    const resolved = getRootGroup("grandchild", index);

    expect(resolved?.id).toBe("root");
  });

  it("returns the group itself when it has no parent", () => {
    const root = group({ id: "root", name: "Fixed Assets" });
    const index = buildLedgerGroupIndex([root]);

    expect(getRootGroup("root", index)?.id).toBe("root");
  });

  it("returns null when the group id isn't in the index", () => {
    const index = buildLedgerGroupIndex([]);

    expect(getRootGroup("missing", index)).toBeNull();
  });
});
