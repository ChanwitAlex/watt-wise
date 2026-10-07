import { describe, expect, it } from "vitest";
import { toRiskLevel } from "@/lib/analytics/risk";

describe("toRiskLevel", () => {
  it("แบ่งระดับตามเกณฑ์ 35% / 60%", () => {
    expect(toRiskLevel(0)).toBe("normal");
    expect(toRiskLevel(0.349)).toBe("normal");
    expect(toRiskLevel(0.35)).toBe("warning");
    expect(toRiskLevel(0.599)).toBe("warning");
    expect(toRiskLevel(0.6)).toBe("high");
    expect(toRiskLevel(1)).toBe("high");
  });
});
