import { describe, expect, it } from "vitest";
import { normalizeSupportingDocument, parseDateValue, parseImportAmount, parsePeriod } from "../shared/import-utils";

describe("import utilities", () => {
  it("normalizes Arabic and slash-separated periods", () => {
    expect(parsePeriod("2026/7")).toBe("2026-07");
    expect(parsePeriod("الفترة غير معروفة", "2026-08")).toBe("2026-08");
  });
  it("parses formatted amounts and dates safely", () => {
    expect(parseImportAmount("12,500.75")).toBe(12500.75);
    expect(parseDateValue("2026/07/14", "2026-07")).toBe("2026-07-14");
    expect(parseDateValue("", "2026-07")).toBe("2026-07-01");
  });
  it("maps Arabic supporting document status", () => {
    expect(normalizeSupportingDocument("قيد المراجعة")).toBe("Pending Review");
    expect(normalizeSupportingDocument("متاح")).toBe("Available");
  });
});
