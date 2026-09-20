import { describe, it, expect } from "vitest";
import { computeEdgeCost, getProfile } from "@/lib/costFunctions";
import { GraphEdge, GraphNode } from "@/scripts/generate-data";

describe("Cost Functions & Profile Weights Engine", () => {
  const dummyFromNode: GraphNode = {
    id: "n1",
    lat: 12.968,
    lng: 79.152,
    elevation: 2,
    type: "junction",
    degree: 2,
    poiScore: 0,
  };

  const dummyToNode: GraphNode = {
    id: "n2",
    lat: 12.969,
    lng: 79.153,
    elevation: 4,
    type: "junction",
    degree: 2,
    poiScore: 0,
  };

  const baseEdge: GraphEdge = {
    id: "e1",
    from: "n1",
    to: "n2",
    distance: 100,
    slope: 2,
    surface: "asphalt",
    stairs: false,
    kerbCm: 0,
    crossing: "none",
    lanes: 2,
    name: "Main Rd",
    coarseId: "c1",
  };

  it("wheelchair blocks stairs, kerb > 5cm, slope > 8%, and rough surfaces", () => {
    const prof = getProfile("wheelchair");

    // Normal edge passes
    expect(computeEdgeCost(baseEdge, dummyFromNode, dummyToNode, prof).blocked).toBe(false);

    // Stairs block
    const stairsEdge = { ...baseEdge, stairs: true };
    const stairsRes = computeEdgeCost(stairsEdge, dummyFromNode, dummyToNode, prof);
    expect(stairsRes.blocked).toBe(true);
    expect(stairsRes.reasons).toContain("Steps");

    // Kerb > 5cm block
    const kerbEdge = { ...baseEdge, kerbCm: 15 };
    const kerbRes = computeEdgeCost(kerbEdge, dummyFromNode, dummyToNode, prof);
    expect(kerbRes.blocked).toBe(true);
    expect(kerbRes.reasons.some((r) => r.includes("Kerb"))).toBe(true);

    // Slope > 8% block
    const steepEdge = { ...baseEdge, slope: 9 };
    const slopeRes = computeEdgeCost(steepEdge, dummyFromNode, dummyToNode, prof);
    expect(slopeRes.blocked).toBe(true);
    expect(slopeRes.reasons.some((r) => r.includes("Slope"))).toBe(true);

    // Rough surface block
    for (const surf of ["gravel", "dirt", "cobble"] as const) {
      const roughEdge = { ...baseEdge, surface: surf };
      const surfRes = computeEdgeCost(roughEdge, dummyFromNode, dummyToNode, prof);
      expect(surfRes.blocked).toBe(true);
      expect(surfRes.reasons.some((r) => r.includes("Rough surface"))).toBe(true);
    }
  });

  it("stroller shares wheelchair blocks and penalizes unsignalized multi-lane crossings", () => {
    const prof = getProfile("stroller_newborn");

    // Stairs block
    expect(computeEdgeCost({ ...baseEdge, stairs: true }, dummyFromNode, dummyToNode, prof).blocked).toBe(true);

    // Unsignalized crossing penalty
    const unsignalizedEdge = { ...baseEdge, lanes: 4, crossing: "unsignalized" as const };
    const cost = computeEdgeCost(unsignalizedEdge, dummyFromNode, dummyToNode, prof);
    expect(cost.blocked).toBe(false);
    expect(cost.slowdown).toBeGreaterThan(1.0);
  });

  it("mobility_limited blocks stairs only, does not block slope or rough surface", () => {
    const prof = getProfile("mobility_limited");

    // Stairs block
    expect(computeEdgeCost({ ...baseEdge, stairs: true }, dummyFromNode, dummyToNode, prof).blocked).toBe(true);

    // Kerb > 5cm slows down but NOT blocked
    const kerbRes = computeEdgeCost({ ...baseEdge, kerbCm: 15 }, dummyFromNode, dummyToNode, prof);
    expect(kerbRes.blocked).toBe(false);
    expect(kerbRes.slowdown).toBeGreaterThan(1.0);

    // Gravel slows down but NOT blocked
    const gravelRes = computeEdgeCost({ ...baseEdge, surface: "gravel" }, dummyFromNode, dummyToNode, prof);
    expect(gravelRes.blocked).toBe(false);
    expect(gravelRes.slowdown).toBeGreaterThan(1.0);
  });

  it("pregnant profile has no hard blocks, but penalizes stairs and rough terrain", () => {
    const prof = getProfile("pregnant");

    const stairsRes = computeEdgeCost({ ...baseEdge, stairs: true }, dummyFromNode, dummyToNode, prof);
    expect(stairsRes.blocked).toBe(false);
    expect(stairsRes.slowdown).toBeGreaterThanOrEqual(2.5);

    const roughRes = computeEdgeCost({ ...baseEdge, surface: "cobble" }, dummyFromNode, dummyToNode, prof);
    expect(roughRes.blocked).toBe(false);
    expect(roughRes.slowdown).toBeGreaterThanOrEqual(2.0);
  });

  it("cognitive profile penalizes high-degree junctions and awards landmark bonuses", () => {
    const prof = getProfile("cognitive");

    // Complex junction deg >= 4
    const complexToNode = { ...dummyToNode, degree: 6 };
    const complexRes = computeEdgeCost(baseEdge, dummyFromNode, complexToNode, prof);
    expect(complexRes.slowdown).toBeGreaterThan(1.0);

    // Landmark bonus
    const landmarkToNode = { ...dummyToNode, poiScore: 2 };
    const landmarkRes = computeEdgeCost(baseEdge, dummyFromNode, landmarkToNode, prof);
    expect(landmarkRes.slowdown).toBeLessThan(1.0);
  });
});
