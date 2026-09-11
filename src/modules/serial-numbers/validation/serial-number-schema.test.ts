import { describe, expect, it } from "vitest";

import { createSerialNumberSchema } from "@/modules/serial-numbers/validation/serial-number-schema";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function validSerial(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_ID,
    serialValue: "IMEI-0001",
    ...overrides,
  };
}

describe("createSerialNumberSchema", () => {
  it("accepts a well-formed serial", () => {
    expect(createSerialNumberSchema.safeParse(validSerial()).success).toBe(true);
  });

  it("trims serialValue", () => {
    const result = createSerialNumberSchema.parse(validSerial({ serialValue: "  IMEI-0001  " }));
    expect(result.serialValue).toBe("IMEI-0001");
  });

  it("requires a valid productId", () => {
    expect(createSerialNumberSchema.safeParse(validSerial({ productId: "not-a-uuid" })).success).toBe(false);
  });

  it("rejects an empty serialValue", () => {
    expect(createSerialNumberSchema.safeParse(validSerial({ serialValue: "" })).success).toBe(false);
    expect(createSerialNumberSchema.safeParse(validSerial({ serialValue: "   " })).success).toBe(false);
  });

  it("rejects a serialValue over 100 characters", () => {
    expect(createSerialNumberSchema.safeParse(validSerial({ serialValue: "S".repeat(101) })).success).toBe(
      false
    );
  });

  it("accepts a serialValue at exactly 100 characters", () => {
    expect(createSerialNumberSchema.safeParse(validSerial({ serialValue: "S".repeat(100) })).success).toBe(
      true
    );
  });
});
