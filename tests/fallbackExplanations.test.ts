import { describe, it, expect } from "vitest";
import {
  classifyIntent,
  composeFallbackExplanation,
  composeFallbackForEvent,
  ExplanationIntent,
} from "@/lib/fallbackExplanations";
import { buildExplanationContext } from "@/lib/explainContext";
import { SimulationEvent } from "@/lib/simulation";

describe("Deterministic Fallback Explanations Engine", () => {
  const context = buildExplanationContext(
    {
      evacueeId: "marcus",
      profileId: "wheelchair",
      simulationMinute: 0,
      peopleEvacuating: 10,
    },
    {
      evacueeId: "marcus",
      profileId: "wheelchair",
      simulationMinute: 0,
      peopleEvacuating: 5,
    }
  );

  const intents: ExplanationIntent[] = [
    "why_route",
    "why_not_shelter",
    "what_changed",
    "will_reach_safety",
    "why_profile_different",
    "what_if_time",
    "why_shelter_changed",
    "generic_summary",
  ];

  it("covers every intent and produces non-empty explanatory text", () => {
    for (const intent of intents) {
      const text = composeFallbackExplanation(intent, context);
      expect(text).toBeDefined();
      expect(text.trim().length).toBeGreaterThan(15);
      expect(text).not.toContain("undefined");
      expect(text).not.toContain("NaN");
    }
  });

  it("what_if_time reads from timelinePreview", () => {
    const text = composeFallbackExplanation("what_if_time", context);
    expect(text).toContain("T+0m");
    expect(text.toLowerCase()).toContain("timeline");
  });

  it("why_profile_different reads from profileComparison", () => {
    const text = composeFallbackExplanation("why_profile_different", context);
    expect(text).toContain("Wheelchair User");
    expect(text).toContain("Pregnant");
  });

  it("what_changed reads from changeSummary", () => {
    const text = composeFallbackExplanation("what_changed", context);
    expect(text).toContain("people");
  });

  it("covers every simulation event type with authoritative human sentences", () => {
    const eventTypes: SimulationEvent["type"][] = [
      "ROUTE_RECALCULATED",
      "ROUTE_BLOCKED",
      "SHELTER_FULL",
      "SHELTER_CHANGED",
      "NO_SAFE_ROUTE",
    ];

    for (const type of eventTypes) {
      const ev: SimulationEvent = {
        id: `ev_${type}`,
        type,
        minute: 10,
        timestamp: Date.now(),
        edgeName: "Market St",
        floodArrivalMin: 10,
        oldShelter: "Govt School",
        newShelter: "Community Hall",
        shelter: "Govt School",
        occupancy: 50,
        capacity: 50,
        reasonCode: "All routes cut off by flood",
        cause: "time",
      };

      const sentence = composeFallbackForEvent(ev);
      expect(sentence).toBeDefined();
      expect(sentence.length).toBeGreaterThan(10);
      expect(sentence).not.toContain("undefined");
    }
  });

  it("intent classifier maps natural language queries to correct intents", () => {
    expect(classifyIntent("Why this route?")).toBe("why_route");
    expect(classifyIntent("Why not the closest shelter?")).toBe("why_not_shelter");
    expect(classifyIntent("What changed in the simulation?")).toBe("what_changed");
    expect(classifyIntent("Will they reach safety?")).toBe("will_reach_safety");
    expect(classifyIntent("Why is this profile taking a different route?")).toBe("why_profile_different");
    expect(classifyIntent("What if the flood reaches at minute 15?")).toBe("what_if_time");
    expect(classifyIntent("Why did the shelter change?")).toBe("why_shelter_changed");
  });
});
