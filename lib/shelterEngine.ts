import sheltersData from "@/data/shelters.json";
import { getGraph } from "./graph";
import { getProfile } from "./costFunctions";
import { runDijkstra } from "./dijkstra";

export interface ShelterState {
  id: string;
  name: string;
  junctionId: string;
  capacity: number;
  baselineOccupancy: number;
  currentOccupancy: number;
  isFull: boolean;
}

export interface BackgroundEvacuee {
  id: string;
  startJunction: string;
  profileId: string;
  slackMin?: number;
}

// Deterministic PRNG with seed 42
function seededPRNG(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateBackgroundEvacuees(count: number): BackgroundEvacuee[] {
  const rnd = seededPRNG(42);
  const evacuees: BackgroundEvacuee[] = [];

  const eligibleJunctions: string[] = [];
  for (let r = 0; r <= 2; r++) {
    for (let c = 0; c <= 5; c++) {
      const jId = `r${r}c${c}`;
      if (jId !== "r2c5") {
        // r2c5 is S3 shelter node
        eligibleJunctions.push(jId);
      }
    }
  }

  const profilePool = [
    { id: "wheelchair", weight: 0.15 },
    { id: "mobility_limited", weight: 0.25 },
    { id: "pregnant", weight: 0.20 },
    { id: "stroller_newborn", weight: 0.20 },
    { id: "cognitive", weight: 0.20 },
  ];

  for (let i = 0; i < count; i++) {
    const jIdx = Math.floor(rnd() * eligibleJunctions.length);
    const startJunction = eligibleJunctions[jIdx];

    const pRoll = rnd();
    let cumulative = 0;
    let chosenProfile = "mobility_limited";
    for (const p of profilePool) {
      cumulative += p.weight;
      if (pRoll <= cumulative) {
        chosenProfile = p.id;
        break;
      }
    }

    evacuees.push({
      id: `bg_${i + 1}`,
      startJunction,
      profileId: chosenProfile,
    });
  }

  return evacuees;
}

export interface ShelterEngineResult {
  shelters: Record<string, ShelterState>;
  unassignedCount: number;
}

export function computeShelterOccupancies(
  peopleEvacuating: number,
  simulationMinute: number
): ShelterEngineResult {
  const graph = getGraph();
  const departureSec = simulationMinute * 60;

  // Initialize shelters with baseline occupancy
  const shelters: Record<string, ShelterState> = {};
  for (const s of sheltersData) {
    shelters[s.id] = {
      id: s.id,
      name: s.name,
      junctionId: s.junctionId,
      capacity: s.capacity,
      baselineOccupancy: s.baselineOccupancy,
      currentOccupancy: s.baselineOccupancy,
      isFull: s.baselineOccupancy >= s.capacity,
    };
  }

  if (peopleEvacuating <= 0) {
    return { shelters, unassignedCount: 0 };
  }

  const backgroundEvacuees = generateBackgroundEvacuees(peopleEvacuating);

  // Approximate slack/urgency: distance from river (row 0 most urgent, row 2 least urgent)
  backgroundEvacuees.sort((a, b) => {
    const rowA = parseInt(a.startJunction[1], 10);
    const rowB = parseInt(b.startJunction[1], 10);
    return rowA - rowB; // Row 0 first
  });

  let unassignedCount = 0;

  for (const evacuee of backgroundEvacuees) {
    const profile = getProfile(evacuee.profileId);
    const dijkstraResults = runDijkstra(graph, {
      startNodeId: evacuee.startJunction,
      departureSec,
      profile,
    });

    // Find nearest reachable shelter with capacity
    let bestShelterId: string | null = null;
    let minArrivalSec = Infinity;

    for (const shelter of Object.values(shelters)) {
      if (shelter.currentOccupancy < shelter.capacity) {
        const destResult = dijkstraResults[shelter.junctionId];
        if (destResult && destResult.arrivalSec < minArrivalSec) {
          minArrivalSec = destResult.arrivalSec;
          bestShelterId = shelter.id;
        }
      }
    }

    if (bestShelterId) {
      shelters[bestShelterId].currentOccupancy++;
      if (shelters[bestShelterId].currentOccupancy >= shelters[bestShelterId].capacity) {
        shelters[bestShelterId].isFull = true;
      }
    } else {
      unassignedCount++;
    }
  }

  return {
    shelters,
    unassignedCount,
  };
}
