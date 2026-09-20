import { describe, it, expect } from "vitest";
import {
  getEdgeFloodArrivalMin,
  getEdgeDepthCm,
  getEdgeImpassableMin,
  getEdgeHazardState,
  isEdgePassableAtTime,
} from "@/lib/hazardEngine";
import { getGraph } from "@/lib/graph";

describe("Hazard Model & Depth Calculations", () => {
  const graph = getGraph();

  it("calculates flood depth based on 4 cm/min arrival rate", () => {
    // Find an edge that floods at row 0 (arrival around 4 min)
    const row0Edge = graph.edges.find((e) => e.coarseId.startsWith("r0c0-r0c1"))!;
    expect(row0Edge).toBeDefined();
    const arr = getEdgeFloodArrivalMin(row0Edge!.id);
    expect(arr).toBe(4);

    // Before arrival: depth 0
    expect(getEdgeDepthCm(row0Edge!.id, 2)).toBe(0);
    // At arrival: depth 0
    expect(getEdgeDepthCm(row0Edge!.id, 4)).toBe(0);
    // 2 minutes after arrival: 2 * 4 = 8 cm
    expect(getEdgeDepthCm(row0Edge!.id, 6)).toBe(8);
  });

  it("yields different impassable times based on profile depth tolerance", () => {
    const row0Edge = graph.edges.find((e) => e.coarseId.startsWith("r0c0-r0c1"))!;
    // Wheelchair tolerance: 10 cm -> 4 + 10/4 = 6.5 min
    const wcImpassable = getEdgeImpassableMin(row0Edge.id, "wheelchair");
    expect(wcImpassable).toBeCloseTo(6.5, 1);

    // Mobility limited tolerance: 15 cm -> 4 + 15/4 = 7.75 min
    const mobImpassable = getEdgeImpassableMin(row0Edge.id, "mobility_limited");
    expect(mobImpassable).toBeCloseTo(7.75, 1);

    // Cognitive tolerance: 20 cm -> 4 + 20/4 = 9.0 min
    const cogImpassable = getEdgeImpassableMin(row0Edge.id, "cognitive");
    expect(cogImpassable).toBeCloseTo(9.0, 1);
  });

  it("rejects edge entered at or after impassable time; accepts edge entered just before", () => {
    const row0Edge = graph.edges.find((e) => e.coarseId.startsWith("r0c0-r0c1"))!;
    const impassableMin = getEdgeImpassableMin(row0Edge.id, "wheelchair")!;

    // Entered just before impassable time: passable
    expect(isEdgePassableAtTime(row0Edge.id, impassableMin - 0.1, "wheelchair")).toBe(true);

    // Entered at or after impassable time: impassable
    expect(isEdgePassableAtTime(row0Edge.id, impassableMin, "wheelchair")).toBe(false);
    expect(isEdgePassableAtTime(row0Edge.id, impassableMin + 0.5, "wheelchair")).toBe(false);
  });

  it("evaluates hazard state as safe, threatened, or impassable", () => {
    const row0Edge = graph.edges.find((e) => e.coarseId.startsWith("r0c0-r0c1"))!;

    // At minute 1: safe
    expect(getEdgeHazardState(row0Edge.id, 1, "wheelchair")).toBe("safe");

    // At minute 5: depth > 0 (4cm) but under tolerance (10cm) -> threatened
    expect(getEdgeHazardState(row0Edge.id, 5, "wheelchair")).toBe("threatened");

    // At minute 7: impassable
    expect(getEdgeHazardState(row0Edge.id, 7, "wheelchair")).toBe("impassable");
  });
});
