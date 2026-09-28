export function parsePeriod(value: unknown, fallback = "2026-07") {
  const s = String(value || "").trim();
  const match = s.match(/(20\d{2})[-/](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : fallback;
}

export function parseImportAmount(value: unknown) {
  return Number(String(value ?? "").replace(/,/g, "").trim());
}

export function parseDateValue(value: unknown, period: string) {
  const s = String(value || "").trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
    const p = s.split(/[T ]/)[0].split(/[/-]/);
    return `${p[0]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  }
  return `${period}-01`;
}

export function normalizeSupportingDocument(value: unknown): "Available" | "Pending Review" {
  const s = String(value || "").trim();
  return s === "Pending Review" || s.includes("مراج") ? "Pending Review" : "Available";
}
