import path from "node:path";

import { describe, expect, it, vi } from "vitest";

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: readFileMock,
}));

import { readCompanyLogoAsDataUri } from "@/modules/company/services/company-logo-service";

describe("readCompanyLogoAsDataUri", () => {
  it("returns null for a null path without touching the filesystem", async () => {
    const result = await readCompanyLogoAsDataUri(null);

    expect(result).toBeNull();
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("returns null for an unrecognized file extension", async () => {
    const result = await readCompanyLogoAsDataUri("/uploads/logos/some-file.exe");

    expect(result).toBeNull();
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("returns a base64 data URI for a successfully read PNG", async () => {
    readFileMock.mockResolvedValue(Buffer.from("fake-png-bytes"));

    const result = await readCompanyLogoAsDataUri("/uploads/logos/abc-123.png");

    expect(result).toBe(`data:image/png;base64,${Buffer.from("fake-png-bytes").toString("base64")}`);
  });

  it("returns null instead of throwing when the file can't be read (missing/corrupt logo must not break PDF generation)", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));

    const result = await readCompanyLogoAsDataUri("/uploads/logos/missing.png");

    expect(result).toBeNull();
  });

  it("only ever reads the basename joined onto the upload dir — a tampered stored path can't escape it", async () => {
    readFileMock.mockResolvedValue(Buffer.from("x"));

    await readCompanyLogoAsDataUri("../../../etc/passwd.png");

    expect(readFileMock).toHaveBeenCalledWith(
      path.join(process.cwd(), "public", "uploads", "logos", "passwd.png")
    );
  });
});
