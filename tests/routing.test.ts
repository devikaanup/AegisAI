import { describe, it, expect } from "vitest";
import {
  findBestShelter,
  standardRoute,
  replayForProfile,
  explainRejections,
} from "@/lib/routing";
import { computeShelterOccupancies } from "@/lib/shelterEngine";
import { getProfile } from "@/lib/costFunctions";

describe("Routing Engine, Multi-Sink Search & Rejection Diagnostics", () => {
  it("multi-sink search returns the earliest-arrival reachable shelter with available capacity", () => {
    const prof = getProfile("wheelchair");
    const { shelters } = computeShelterOccupancies(0, 0);

    const result = findBestShelter("r1c1", prof, 0, shelters);
    expect(result.reachesSafety).toBe(true);
    expect(result.shelterId).toBe("S1"); // Govt School at r3c1
    expect(result.distanceM).toBeGreaterThan(0);
    expect(result.etaSec).toBeGreaterThan(0);
  });

  it("FULL shelter is excluded and overflow reroutes to next reachable shelter", () => {
    const prof = getProfile("wheelchair");
    const { shelters } = computeShelterOccupancies(0, 0);

    // Force S1 to full
    shelters["S1"].currentOccupancy = shelters["S1"].capacity;
    shelters["S1"].isFull = true;

    const result = findBestShelter("r1c1", prof, 0, shelters);
    expect(result.reachesSafety).toBe(true);
    // Should reroute to S2
    expect(result.shelterId).toBe("S2");
  });

  it("safety-status is strictly one of SAFE, TIGHT, WILL_NOT_REACH_SAFETY", () => {
    const prof = getProfile("wheelchair");
    const { shelters } = computeShelterOccupancies(0, 0);

    // At minute 0: SAFE
    const res0 = findBestShelter("r1c1", prof, 0, shelters);
    expect(["SAFE", "TIGHT", "WILL_NOT_REACH_SAFETY"]).toContain(res0.safetyStatus);
    expect(res0.safetyStatus).toBe("SAFE");

    // At minute 8: TIGHT (slack < 2 min)
    const res8 = findBestShelter("r1c1", prof, 8, shelters);
    expect(["SAFE", "TIGHT", "WILL_NOT_REACH_SAFETY"]).toContain(res8.safetyStatus);
    expect(res8.safetyStatus).toBe("TIGHT");

    // At minute 12: WILL_NOT_REACH_SAFETY
    const res12 = findBestShelter("r1c1", prof, 12, shelters);
    expect(["SAFE", "TIGHT", "WILL_NOT_REACH_SAFETY"]).toContain(res12.safetyStatus);
    expect(res12.safetyStatus).toBe("WILL_NOT_REACH_SAFETY");
  });

  it("per-edge slack is used, not a single global disaster time", () => {
    const prof = getProfile("wheelchair");
    const { shelters } = computeShelterOccupancies(0, 0);
    const res = findBestShelter("r1c1", prof, 0, shelters);

    expect(res.edgeAnnotations.length).toBeGreaterThan(0);
    for (const ann of res.edgeAnnotations) {
      expect(ann.name).toBeDefined();
      expect(ann.distance).toBeGreaterThan(0);
      expect(ann.entryTimeMin).toBeLessThanOrEqual(ann.exitTimeMin);
    }
  });

  it("standard route accurately fails when replayed for wheelchair profile at Temple Steps", () => {
    const std = standardRoute("r1c1");
    const prof = getProfile("wheelchair");
    const comparison = replayForProfile(std, prof, 0);

    expect(comparison.reachesSafety).toBe(false);
    expect(comparison.failedAtEdgeName).toBe("Temple Steps");
    expect(comparison.failedReasonCode).toBe("Steps");
  });

  it("determinism: identical inputs give identical routes", () => {
    const prof = getProfile("wheelchair");
    const { shelters: s1 } = computeShelterOccupancies(10, 0);
    const { shelters: s2 } = computeShelterOccupancies(10, 0);

    const r1 = findBestShelter("r1c1", prof, 0, s1);
    const r2 = findBestShelter("r1c1", prof, 0, s2);

    expect(r1.distanceM).toBe(r2.distanceM);
    expect(r1.etaSec).toBe(r2.etaSec);
    expect(r1.nodeIds).toEqual(r2.nodeIds);
  });
});
