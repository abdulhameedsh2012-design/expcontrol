export type VariancePriority = "High" | "Medium" | "Low" | "Within";

export function classifyVariance(varianceAmount: number, variancePercent: number): VariancePriority {
  if (varianceAmount >= 10000 || variancePercent >= 25) return "High";
  if (varianceAmount >= 5000 || variancePercent >= 15) return "Medium";
  if (varianceAmount > 0) return "Low";
  return "Within";
}
