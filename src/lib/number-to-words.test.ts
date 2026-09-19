import { describe, expect, it } from "vitest";

import { amountToWords, integerToIndianWords } from "@/lib/number-to-words";

describe("integerToIndianWords", () => {
  it("returns 'Zero' for 0", () => {
    expect(integerToIndianWords(0)).toBe("Zero");
  });

  it("renders single and double digit numbers", () => {
    expect(integerToIndianWords(7)).toBe("Seven");
    expect(integerToIndianWords(19)).toBe("Nineteen");
    expect(integerToIndianWords(42)).toBe("Forty Two");
    expect(integerToIndianWords(90)).toBe("Ninety");
  });

  it("renders hundreds", () => {
    expect(integerToIndianWords(100)).toBe("One Hundred");
    expect(integerToIndianWords(130)).toBe("One Hundred Thirty");
    expect(integerToIndianWords(999)).toBe("Nine Hundred Ninety Nine");
  });

  it("renders thousands using the Indian grouping", () => {
    expect(integerToIndianWords(4130)).toBe("Four Thousand One Hundred Thirty");
    expect(integerToIndianWords(1000)).toBe("One Thousand");
  });

  it("renders lakhs and crores, not the Western million/billion grouping", () => {
    // 12,20,110 — Twelve Lakh Twenty Thousand One Hundred Ten (matches the
    // Indian digit-grouping convention: 2,3,2,3 from the right, not 3,3,3).
    expect(integerToIndianWords(1220110)).toBe("Twelve Lakh Twenty Thousand One Hundred Ten");
    expect(integerToIndianWords(10000000)).toBe("One Crore");
    expect(integerToIndianWords(41448847)).toBe("Four Crore Fourteen Lakh Forty Eight Thousand Eight Hundred Forty Seven");
  });
});

describe("amountToWords", () => {
  it("appends 'Only' with no paise clause for a whole-rupee amount", () => {
    expect(amountToWords(4130)).toBe("Indian Rupee Four Thousand One Hundred Thirty Only");
  });

  it("adds an 'and N Paise' clause for a fractional amount", () => {
    expect(amountToWords(1220110.5)).toBe("Indian Rupee Twelve Lakh Twenty Thousand One Hundred Ten and Fifty Paise Only");
  });

  it("rounds to the nearest paisa before converting", () => {
    expect(amountToWords(100.004)).toBe("Indian Rupee One Hundred Only");
    expect(amountToWords(100.006)).toBe("Indian Rupee One Hundred and One Paise Only");
  });

  it("uses the given currency label", () => {
    expect(amountToWords(500, "US Dollar")).toBe("US Dollar Five Hundred Only");
  });

  it("formats a negative amount using its absolute value", () => {
    expect(amountToWords(-100)).toBe("Indian Rupee One Hundred Only");
  });

  it("treats zero as a valid whole amount", () => {
    expect(amountToWords(0)).toBe("Indian Rupee Zero Only");
  });
});
