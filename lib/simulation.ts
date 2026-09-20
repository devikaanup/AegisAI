import profilesData from "@/data/profiles.json";
import { getProfile, ProfileDefinition } from "./costFunctions";
import { computeShelterOccupancies, ShelterState, ShelterEngineResult } from "./shelterEngine";
import {
  findBestShelter,
  standardRoute,
  replayForProfile,
  explainRejections,
  RouteResult,
  StandardRouteComparison,
  RejectionExplanation,
  SafetyStatusType,
} from "./routing";

export type EventCause = "profile" | "time" | "population" | "evacuee" | "capacity" | "flood";

export interface SimulationEvent {
  id: string;
  type: "ROUTE_RECALCULATED" | "ROUTE_BLOCKED" | "SHELTER_FULL" | "SHELTER_CHANGED" | "NO_SAFE_ROUTE";
  minute: number;
  timestamp: number;
  cause?: EventCause;
  edgeName?: string;
  floodArrivalMin?: number;
  oldShelter?: string | null;
  newShelter?: string | null;
  shelter?: string;
  occupancy?: number;
  capacity?: number;
  reasonCode?: string;
}

export interface SimulationInputs {
  evacueeId: string;
  profileId: string;
  simulationMinute: number;
  peopleEvacuating: number;
}

export interface SimulationState {
  inputs: SimulationInputs;
  evacuee: {
    id: string;
    name: string;
    startJunction: string;
    profile: string;
    displaySpeed: number;
  };
  profile: ProfileDefinition;
  simulationMinute: number;
  peopleEvacuating: number;
  shelters: Record<string, ShelterState>;
  unassignedCount: number;
  currentRoute: RouteResult;
  standardComparison: StandardRouteComparison;
  rejections: RejectionExplanation[];
  events: SimulationEvent[];
  routeStatus: SafetyStatusType;
}

export function getEvacuee(evacueeId: string) {
  const evacuees = profilesData.evacuees as Array<{
    id: string;
    name: string;
    startJunction: string;
    profile: string;
    displaySpeed: number;
  }>;
  return evacuees.find((e) => e.id === evacueeId) || evacuees[0];
}

export function getAllEvacuees() {
  return profilesData.evacuees;
}

/**
 * Recomputes full simulation state and diffs against previous state to emit events.
 */
export function runSimulation(
  inputs: SimulationInputs,
  previousState?: SimulationState | null
): SimulationState {
  const evacuee = getEvacuee(inputs.evacueeId);
  const profile = getProfile(inputs.profileId);
  const minute = Math.max(0, Math.min(30, inputs.simulationMinute));
  const population = Math.max(0, Math.min(150, inputs.peopleEvacuating));

  // 1. Compute Shelter Occupancies for background evacuees
  const shelterResult: ShelterEngineResult = computeShelterOccupancies(population, minute);

  // 2. Find Best Accessible Route for focus evacuee
  const currentRoute = findBestShelter(
    evacuee.startJunction,
    profile,
    minute,
    shelterResult.shelters
  );

  // If a shelter was successfully assigned to focus evacuee, increment occupancy
  if (currentRoute.shelterId && shelterResult.shelters[currentRoute.shelterId]) {
    const s = shelterResult.shelters[currentRoute.shelterId];
    s.currentOccupancy++;
    if (s.currentOccupancy >= s.capacity) {
      s.isFull = true;
    }
  }

  // 3. Compute Standard Route & Profile Replay Comparison
  const stdRoute = standardRoute(evacuee.startJunction);
  const standardComparison = replayForProfile(stdRoute, profile, minute);

  // 4. Compute Diagnostic Rejections
  const rejections = explainRejections(
    evacuee.startJunction,
    profile,
    minute,
    currentRoute.shelterId,
    shelterResult.shelters,
    currentRoute.etaMin
  );

  // 5. Diff consecutive state to emit events
  const newEvents: SimulationEvent[] = [];
  const now = Date.now();

  if (previousState) {
    const prevInputs = previousState.inputs;
    let primaryCause: EventCause = "time";
    if (prevInputs.evacueeId !== inputs.evacueeId) primaryCause = "evacuee";
    else if (prevInputs.profileId !== inputs.profileId) primaryCause = "profile";
    else if (prevInputs.peopleEvacuating !== inputs.peopleEvacuating) primaryCause = "population";
    else if (prevInputs.simulationMinute !== inputs.simulationMinute) primaryCause = "time";

    // ROUTE_RECALCULATED
    if (
      prevInputs.evacueeId !== inputs.evacueeId ||
      prevInputs.profileId !== inputs.profileId ||
      prevInputs.simulationMinute !== inputs.simulationMinute ||
      prevInputs.peopleEvacuating !== inputs.peopleEvacuating
    ) {
      newEvents.push({
        id: `ev_recalc_${now}`,
        type: "ROUTE_RECALCULATED",
        minute,
        timestamp: now,
        cause: primaryCause,
      });
    }

    // SHELTER_FULL
    for (const [sId, s] of Object.entries(shelterResult.shelters)) {
      const prevS = previousState.shelters[sId];
      if (s.isFull && (!prevS || !prevS.isFull)) {
        newEvents.push({
          id: `ev_full_${sId}_${now}`,
          type: "SHELTER_FULL",
          minute,
          timestamp: now,
          shelter: s.name,
          occupancy: s.currentOccupancy,
          capacity: s.capacity,
        });
      }
    }

    // SHELTER_CHANGED
    if (
      previousState.currentRoute.shelterId &&
      currentRoute.shelterId &&
      previousState.currentRoute.shelterId !== currentRoute.shelterId
    ) {
      let changeCause: EventCause = primaryCause;
      const oldShelter = previousState.shelters[previousState.currentRoute.shelterId];
      if (oldShelter && oldShelter.isFull) {
        changeCause = "capacity";
      } else if (previousState.inputs.simulationMinute !== inputs.simulationMinute) {
        changeCause = "flood";
      }

      newEvents.push({
        id: `ev_shelter_chg_${now}`,
        type: "SHELTER_CHANGED",
        minute,
        timestamp: now,
        oldShelter: previousState.currentRoute.shelterName,
        newShelter: currentRoute.shelterName,
        cause: changeCause,
      });
    }

    // ROUTE_BLOCKED (flood cutoff on previous path)
    if (
      previousState.currentRoute.shelterId &&
      (!currentRoute.shelterId || currentRoute.shelterId !== previousState.currentRoute.shelterId) &&
      previousState.inputs.simulationMinute !== inputs.simulationMinute
    ) {
      const floodedEdge = currentRoute.firstHazardEdge?.name || "Access route";
      const floodArrival = currentRoute.firstHazardEdge?.floodArrivalMin ?? minute;
      newEvents.push({
        id: `ev_blocked_${now}`,
        type: "ROUTE_BLOCKED",
        minute,
        timestamp: now,
        edgeName: floodedEdge,
        floodArrivalMin: floodArrival,
        oldShelter: previousState.currentRoute.shelterName,
        newShelter: currentRoute.shelterName,
      });
    }

    // NO_SAFE_ROUTE
    if (currentRoute.safetyStatus === "WILL_NOT_REACH_SAFETY" && previousState.currentRoute.safetyStatus !== "WILL_NOT_REACH_SAFETY") {
      newEvents.push({
        id: `ev_nosafe_${now}`,
        type: "NO_SAFE_ROUTE",
        minute,
        timestamp: now,
        reasonCode: currentRoute.unreachableReason || "All routes impassable",
      });
    }
  }

  // Combine events, retaining most recent 20 events
  const allEvents = [...(previousState?.events || []), ...newEvents].slice(-20);

  return {
    inputs: { ...inputs },
    evacuee,
    profile,
    simulationMinute: minute,
    peopleEvacuating: population,
    shelters: shelterResult.shelters,
    unassignedCount: shelterResult.unassignedCount,
    currentRoute,
    standardComparison,
    rejections,
    events: allEvents,
    routeStatus: currentRoute.safetyStatus,
  };
}
