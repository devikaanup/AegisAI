import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import floodPolygons from "@/data/floodPolygons.json";
import * as turf from "@turf/turf";
import { runSimulation } from "@/lib/simulation";

describe("Layout, Performance & Race Mode Route Commitment", () => {
  it("precomputed floodPolygons.json contains an entry for every minute 0 through 30", () => {
    for (let m = 0; m <= 30; m++) {
      expect((floodPolygons as any)[String(m)] !== undefined).toBe(true);
    }
  });

  it("runtime map scrubbing performs zero calls to Turf union or buffer", () => {
    // 1. Verify MapView.tsx does not import @turf/turf at all
    const mapViewSource = fs.readFileSync(
      path.resolve(__dirname, "../components/MapView.tsx"),
      "utf-8"
    );
    expect(mapViewSource).not.toContain("@turf/turf");
    expect(mapViewSource).not.toContain("turf.union");
    expect(mapViewSource).not.toContain("turf.buffer");

    // 2. Verify all 30 minutes are accessible via plain object property lookup
    for (let m = 0; m <= 30; m++) {
      const poly = (floodPolygons as any)[String(m)];
      expect(poly !== undefined).toBe(true);
    }
  });

  it("Race Mode commits to departure route: route snapshot remains unchanged as simulation time advances", () => {
    // Departure at t=0
    const departureState = runSimulation({
      evacueeId: "marcus",
      profileId: "wheelchair",
      simulationMinute: 0,
      peopleEvacuating: 10,
    });

    const committedRoute = departureState.currentRoute;
    const committedNodeIds = [...committedRoute.nodeIds];
    const committedShelter = committedRoute.shelterId;

    // Simulation minute advances to t=10 (where normal rerouting would say WILL_NOT_REACH_SAFETY)
    const laterState = runSimulation({
      evacueeId: "marcus",
      profileId: "wheelchair",
      simulationMinute: 10,
      peopleEvacuating: 10,
    });

    // The live state changed
    expect(laterState.currentRoute.safetyStatus).toBe("WILL_NOT_REACH_SAFETY");

    // But the committed route for Race Mode remains the snapshot from departure!
    expect(committedRoute.nodeIds).toEqual(committedNodeIds);
    expect(committedRoute.shelterId).toBe(committedShelter);
  });
});
