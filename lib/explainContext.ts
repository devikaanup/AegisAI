import { runSimulation, SimulationInputs, SimulationState } from "./simulation";
import { getAllProfiles, getProfile } from "./costFunctions";
import { SafetyStatusType } from "./routing";

export interface ExplanationContext {
  evacuee: {
    name: string;
    profile: string;
  };
  simulation: {
    timeMinute: number;
    peopleEvacuating: number;
  };
  selectedRoute: {
    shelter: string | null;
    distanceM: number;
    etaMin: string;
    floodArrivalMin: number | null;
    safetyMarginMin: string;
    status: SafetyStatusType;
  };
  standardRoute: {
    distanceM: number;
    etaMin: string;
    failsAt: {
      edgeName: string;
      reasonCode: string;
    } | null;
    floodCutsAtMin: number | null;
  };
  rejectedShelters: Array<{
    shelter: string;
    reason: string;
    edge?: string;
    floodArrivalMin?: number;
    evacueeArrivalMin?: number;
    extraMin?: string;
    occupancy?: number;
    capacity?: number;
  }>;
  accessibility: {
    hardConstraints: string[];
  };
  shelters: Array<{
    name: string;
    occupancy: number;
    capacity: number;
    full: boolean;
  }>;
  profileComparison: Array<{
    profile: string;
    shelter: string | null;
    etaMin: string;
    status: SafetyStatusType;
    keyConstraint?: string;
  }>;
  timelinePreview: Array<{
    minute: number;
    shelter: string | null;
    status: SafetyStatusType;
    safetyMarginMin?: string;
  }>;
  changeSummary?: {
    changed: string[];
    oldShelter: string | null;
    newShelter: string | null;
    events: Array<{
      type: string;
      minute: number;
      detail?: string;
    }>;
  };
}

export function buildExplanationContext(
  inputs: SimulationInputs,
  previousInputs?: SimulationInputs | null
): ExplanationContext {
  const sim = runSimulation(inputs);

  // 1. Profile Comparison across all 5 main profiles for this evacuee at this minute
  const allProfiles = getAllProfiles().filter((p) => p.id !== "standard");
  const profileComparison = allProfiles.map((prof) => {
    const profSim = runSimulation({
      ...inputs,
      profileId: prof.id,
    });
    return {
      profile: prof.name,
      shelter: profSim.currentRoute.shelterName,
      etaMin: `${profSim.currentRoute.etaMin} min`,
      status: profSim.currentRoute.safetyStatus,
      keyConstraint: prof.hardConstraints[0] || undefined,
    };
  });

  // 2. Timeline Preview across minutes [0, 5, 10, 15, 20, 25, 30]
  const previewMinutes = [0, 5, 10, 15, 20, 25, 30];
  const timelinePreview = previewMinutes.map((min) => {
    const timeSim = runSimulation({
      ...inputs,
      simulationMinute: min,
    });
    return {
      minute: min,
      shelter: timeSim.currentRoute.shelterName,
      status: timeSim.currentRoute.safetyStatus,
      safetyMarginMin:
        timeSim.currentRoute.minFloodSlackMin === 999
          ? "No hazard"
          : `${timeSim.currentRoute.minFloodSlackMin} min`,
    };
  });

  // 3. Change Summary if previousInputs was provided
  let changeSummary: ExplanationContext["changeSummary"] = undefined;
  if (previousInputs) {
    const prevSim = runSimulation(previousInputs);
    const changed: string[] = [];
    if (previousInputs.profileId !== inputs.profileId) changed.push("profile");
    if (previousInputs.simulationMinute !== inputs.simulationMinute) changed.push("minute");
    if (previousInputs.peopleEvacuating !== inputs.peopleEvacuating) changed.push("people");
    if (previousInputs.evacueeId !== inputs.evacueeId) changed.push("evacuee");

    const events = sim.events.slice(-5).map((e) => ({
      type: e.type,
      minute: e.minute,
      detail: e.edgeName || e.shelter || e.reasonCode || e.cause,
    }));

    changeSummary = {
      changed,
      oldShelter: prevSim.currentRoute.shelterName,
      newShelter: sim.currentRoute.shelterName,
      events,
    };
  }

  // 4. Rejected Shelters formatted
  const rejectedShelters = sim.rejections.map((r) => ({
    shelter: r.shelterName,
    reason: r.code,
    edge: r.edgeName,
    floodArrivalMin: r.floodArrivalMin,
    evacueeArrivalMin: r.evacueeArrivalMin,
    extraMin: r.extraMin !== undefined ? `${r.extraMin} min` : undefined,
    occupancy: r.occupancy,
    capacity: r.capacity,
  }));

  const standardFailsAt = sim.standardComparison.failedAtEdgeName
    ? {
        edgeName: sim.standardComparison.failedAtEdgeName,
        reasonCode: sim.standardComparison.failedReasonCode || "BLOCKED",
      }
    : null;

  return {
    evacuee: {
      name: sim.evacuee.name,
      profile: sim.profile.name,
    },
    simulation: {
      timeMinute: sim.simulationMinute,
      peopleEvacuating: sim.peopleEvacuating,
    },
    selectedRoute: {
      shelter: sim.currentRoute.shelterName,
      distanceM: sim.currentRoute.distanceM,
      etaMin: `${sim.currentRoute.etaMin} min`,
      floodArrivalMin: sim.currentRoute.firstHazardEdge?.floodArrivalMin ?? null,
      safetyMarginMin:
        sim.currentRoute.minFloodSlackMin === 999
          ? "No hazard"
          : `${sim.currentRoute.minFloodSlackMin} min`,
      status: sim.currentRoute.safetyStatus,
    },
    standardRoute: {
      distanceM: sim.standardComparison.distanceM,
      etaMin: `${sim.standardComparison.etaMin} min`,
      failsAt: standardFailsAt,
      floodCutsAtMin: sim.standardComparison.floodCutsAtMin,
    },
    rejectedShelters,
    accessibility: {
      hardConstraints: sim.profile.hardConstraints,
    },
    shelters: Object.values(sim.shelters).map((s) => ({
      name: s.name,
      occupancy: s.currentOccupancy,
      capacity: s.capacity,
      full: s.isFull,
    })),
    profileComparison,
    timelinePreview,
    changeSummary,
  };
}
