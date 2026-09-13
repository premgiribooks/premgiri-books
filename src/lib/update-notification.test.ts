import { describe, expect, it } from "vitest";

import { describeUpdateToast } from "@/lib/update-notification";

describe("describeUpdateToast", () => {
  it("stays silent while checking, when there is nothing new, and on error", () => {
    expect(describeUpdateToast({ state: "checking" })).toBeNull();
    expect(describeUpdateToast({ state: "not-available" })).toBeNull();
    expect(describeUpdateToast({ state: "error", message: "network unreachable" })).toBeNull();
  });

  it("announces an available update as a non-persistent info toast", () => {
    const description = describeUpdateToast({ state: "available", version: "1.2.0" });

    expect(description).toEqual({
      tone: "info",
      message: "Update 1.2.0 available — downloading…",
      persistent: false,
    });
  });

  it("reports download progress as a non-persistent info toast", () => {
    const description = describeUpdateToast({ state: "downloading", percent: 42 });

    expect(description).toEqual({
      tone: "info",
      message: "Downloading update… 42%",
      persistent: false,
    });
  });

  it("marks a downloaded update as a persistent success toast", () => {
    const description = describeUpdateToast({ state: "downloaded", version: "1.2.0" });

    expect(description?.tone).toBe("success");
    expect(description?.persistent).toBe(true);
    expect(description?.message).toContain("1.2.0");
  });
});
