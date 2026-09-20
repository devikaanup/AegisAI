import { describe, it, expect } from "vitest";
import { buildExplanationContext } from "@/lib/explainContext";

describe("Explanation Context Builder & Size Budget", () => {
  it("contains only whitelisted compact fields, no raw node ids or graph arrays", () => {
    const ctx = buildExplanationContext(
      {
        evacueeId: "marcus",
        profileId: "wheelchair",
        simulationMinute: 0,
        peopleEvacuating: 10,
      },
      null
    );

    const jsonStr = JSON.stringify(ctx);

    // Assert absence of internal graph fields
    expect(jsonStr).not.toContain("coarseId");
    expect(jsonStr).not.toContain("adj");
    expect(jsonStr).not.toContain("nodeDegrees");
    expect(jsonStr).not.toContain("s_r"); // no shape node ids

    // Assert presence of required fields
    expect(ctx.evacuee).toBeDefined();
    expect(ctx.simulation).toBeDefined();
    expect(ctx.selectedRoute).toBeDefined();
    expect(ctx.standardRoute).toBeDefined();
    expect(ctx.rejectedShelters).toBeDefined();
    expect(ctx.profileComparison).toBeDefined();
    expect(ctx.timelinePreview).toBeDefined();

    // Size budget check (must be under 12KB)
    expect(jsonStr.length).toBeLessThan(12000);
  });

  it("renders all durations as 'X.X min' and distances as whole numbers", () => {
    const ctx = buildExplanationContext(
      {
        evacueeId: "marcus",
        profileId: "wheelchair",
        simulationMinute: 0,
        peopleEvacuating: 10,
      },
      null
    );

    expect(ctx.selectedRoute.etaMin).toMatch(/^\d+(\.\d+)? min$/);
    expect(ctx.standardRoute.etaMin).toMatch(/^\d+(\.\d+)? min$/);
    expect(typeof ctx.selectedRoute.distanceM).toBe("number");
    expect(Number.isInteger(ctx.selectedRoute.distanceM)).toBe(true);

    for (const p of ctx.profileComparison) {
      expect(p.etaMin).toMatch(/^\d+(\.\d+)? min$/);
    }
  });

  it("builds changeSummary when previousInputs are provided", () => {
    const ctx = buildExplanationContext(
      {
        evacueeId: "marcus",
        profileId: "wheelchair",
        simulationMinute: 8,
        peopleEvacuating: 10,
      },
      {
        evacueeId: "marcus",
        profileId: "wheelchair",
        simulationMinute: 0,
        peopleEvacuating: 10,
      }
    );

    expect(ctx.changeSummary).toBeDefined();
    expect(ctx.changeSummary?.changed).toContain("minute");
  });
});
