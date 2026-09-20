import { ExplanationContext } from "./explainContext";
import { SimulationEvent } from "./simulation";

export type ExplanationIntent =
  | "why_route"
  | "why_not_shelter"
  | "what_changed"
  | "will_reach_safety"
  | "why_profile_different"
  | "what_if_time"
  | "why_shelter_changed"
  | "generic_summary";

export function classifyIntent(question: string): ExplanationIntent {
  const q = question.toLowerCase();

  if (q.includes("why this route") || q.includes("why route") || q.includes("why take")) {
    return "why_route";
  }
  if (
    q.includes("why not") ||
    q.includes("closest shelter") ||
    q.includes("alternative") ||
    q.includes("nearest")
  ) {
    return "why_not_shelter";
  }
  if (q.includes("what changed") || q.includes("difference") || q.includes("what happened")) {
    return "what_changed";
  }
  if (
    q.includes("reach safety") ||
    q.includes("will they reach") ||
    q.includes("safe") ||
    q.includes("slack") ||
    q.includes("danger")
  ) {
    return "will_reach_safety";
  }
  if (
    q.includes("profile") ||
    q.includes("different") ||
    q.includes("pregnant") ||
    q.includes("wheelchair") ||
    q.includes("stroller")
  ) {
    return "why_profile_different";
  }
  if (
    q.includes("what if") ||
    q.includes("at minute") ||
    q.includes("reaches") ||
    q.includes("timeline") ||
    q.includes("later")
  ) {
    return "what_if_time";
  }
  if (
    (q.includes("shelter") && (q.includes("change") || q.includes("changed"))) ||
    q.includes("why shelter")
  ) {
    return "why_shelter_changed";
  }

  return "generic_summary";
}

export function composeFallbackForEvent(event: SimulationEvent): string {
  switch (event.type) {
    case "ROUTE_BLOCKED":
      return `Route changed because flooding reached ${event.edgeName || "the access street"} at minute ${event.floodArrivalMin ?? event.minute}.`;
    case "SHELTER_FULL":
      return `${event.shelter || "The shelter"} is at capacity (${event.occupancy}/${event.capacity}) and cannot accept additional evacuees.`;
    case "SHELTER_CHANGED":
      return `Target shelter changed from ${event.oldShelter || "previous shelter"} to ${event.newShelter || "new shelter"} due to ${event.cause || "safety constraints"}.`;
    case "NO_SAFE_ROUTE":
      return `No safe evacuation route available: ${event.reasonCode || "all paths cut off by flood or physical barriers"}.`;
    case "ROUTE_RECALCULATED":
      return `Route recalculated due to change in ${event.cause || "simulation conditions"}.`;
    default:
      return "Evacuation simulation updated.";
  }
}

export function composeFallbackExplanation(
  intent: ExplanationIntent,
  ctx: ExplanationContext
): string {
  switch (intent) {
    case "why_route": {
      if (!ctx.selectedRoute.shelter) {
        return `No safe route could be found for ${ctx.evacuee.name} because flooding or physical obstacles block all accessible paths to shelters.`;
      }
      const failurePart = ctx.standardRoute.failsAt
        ? `The standard shortest route fails due to ${ctx.standardRoute.failsAt.reasonCode} on ${ctx.standardRoute.failsAt.edgeName}. `
        : "";
      return `${ctx.evacuee.name} was routed ${ctx.selectedRoute.distanceM}m to ${ctx.selectedRoute.shelter} (${ctx.selectedRoute.etaMin}). ${failurePart}This accessible route maintains a safety margin of ${ctx.selectedRoute.safetyMarginMin} before floodwaters reach impassable levels.`;
    }

    case "why_not_shelter": {
      if (ctx.rejectedShelters.length === 0) {
        return `All other shelters are either further away or unavailable under current flood conditions.`;
      }
      const rejections = ctx.rejectedShelters
        .map((r) => {
          if (r.reason === "FULL") {
            return `${r.shelter} is full (${r.occupancy}/${r.capacity})`;
          }
          if (r.reason === "FLOOD_FIRST") {
            return `${r.shelter} is cut off by flood on ${r.edge || "access street"} at minute ${r.floodArrivalMin}`;
          }
          if (r.reason.includes("BLOCK")) {
            return `${r.shelter} is blocked by ${r.edge || "physical barriers"} inaccessible to ${ctx.evacuee.profile}`;
          }
          if (r.reason === "SLOWER") {
            return `${r.shelter} takes ${r.extraMin || "longer"}`;
          }
          return `${r.shelter} was excluded (${r.reason})`;
        })
        .join("; ");
      return `Alternative shelters were excluded: ${rejections}.`;
    }

    case "what_changed": {
      if (!ctx.changeSummary) {
        return `The evacuation simulation is operating at minute ${ctx.simulation.timeMinute} with ${ctx.simulation.peopleEvacuating} evacuees assigned.`;
      }
      const changes = ctx.changeSummary.changed.join(", ");
      const shelterTransition =
        ctx.changeSummary.oldShelter !== ctx.changeSummary.newShelter
          ? ` Destination shifted from ${ctx.changeSummary.oldShelter || "none"} to ${ctx.changeSummary.newShelter || "none"}.`
          : "";
      const lastEvent = ctx.changeSummary.events[ctx.changeSummary.events.length - 1];
      const eventDetail = lastEvent ? ` (${lastEvent.type} at minute ${lastEvent.minute})` : "";
      return `Simulation adjusted based on updated ${changes}.${shelterTransition}${eventDetail}`;
    }

    case "will_reach_safety": {
      if (ctx.selectedRoute.status === "WILL_NOT_REACH_SAFETY" || !ctx.selectedRoute.shelter) {
        return `WARNING: ${ctx.evacuee.name} will NOT reach safety under current departure timing. Floodwaters or obstacles prevent reaching any designated shelter.`;
      }
      if (ctx.selectedRoute.status === "TIGHT") {
        return `CAUTION: ${ctx.evacuee.name} has a tight safety margin of only ${ctx.selectedRoute.safetyMarginMin} to reach ${ctx.selectedRoute.shelter} (${ctx.selectedRoute.etaMin} arrival). Immediate departure required.`;
      }
      return `CONFIRMED SAFE: ${ctx.evacuee.name} will reach ${ctx.selectedRoute.shelter} in ${ctx.selectedRoute.etaMin} with a comfortable safety margin of ${ctx.selectedRoute.safetyMarginMin}.`;
    }

    case "why_profile_different": {
      // Required wiring: reads directly from profileComparison
      const comparisonList = ctx.profileComparison
        .map((p) => `${p.profile}: ${p.shelter || "No safe shelter"} (${p.etaMin}, ${p.status})`)
        .join("; ");
      return `Different accessibility profiles require different routes due to distinct physical tolerances. Comparison: ${comparisonList}.`;
    }

    case "what_if_time": {
      // Required wiring: reads directly from timelinePreview
      const previewSummary = ctx.timelinePreview
        .slice(0, 5)
        .map((t) => `T+${t.minute}m: ${t.shelter || "No route"} (${t.status})`)
        .join("; ");
      return `Timeline progression shows route availability over time: ${previewSummary}. As floodwaters rise, accessible paths progressively narrow.`;
    }

    case "why_shelter_changed": {
      const fullShelter = ctx.shelters.find((s) => s.full);
      if (fullShelter) {
        return `The selected shelter changed because ${fullShelter.name} reached maximum capacity (${fullShelter.occupancy}/${fullShelter.capacity}), redirecting evacuees to the next reachable facility.`;
      }
      if (ctx.selectedRoute.floodArrivalMin !== null) {
        return `The shelter changed because rising floodwaters blocked the corridor to the previous shelter, requiring rerouting to ${ctx.selectedRoute.shelter || "high ground"}.`;
      }
      return `Shelter selection updated based on optimized arrival time and remaining shelter capacity.`;
    }

    case "generic_summary":
    default: {
      return `${ctx.evacuee.name} (${ctx.evacuee.profile}) is currently routed to ${ctx.selectedRoute.shelter || "no safe shelter"} (${ctx.selectedRoute.distanceM}m, ${ctx.selectedRoute.etaMin}), with status ${ctx.selectedRoute.status} and safety margin ${ctx.selectedRoute.safetyMarginMin}.`;
    }
  }
}
