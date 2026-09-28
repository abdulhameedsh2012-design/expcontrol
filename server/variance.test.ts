import { describe, expect, it } from "vitest";
import { classifyVariance } from "../shared/variance";

describe("classifyVariance", () => {
  it("marks a material percentage variance as high", () => {
    expect(classifyVariance(3200, 26)).toBe("High");
  });
  it("marks a moderate variance as medium", () => {
    expect(classifyVariance(5200, 8)).toBe("Medium");
  });
  it("does not create a positive priority for a small variance", () => {
    expect(classifyVariance(900, 7)).toBe("Low");
  });
  it("marks savings or under-budget lines as within", () => {
    expect(classifyVariance(-100, -2)).toBe("Within");
  });
});
