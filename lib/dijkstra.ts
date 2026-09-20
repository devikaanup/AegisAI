import { GraphIndex } from "./graph";
import { GraphEdge } from "@/scripts/generate-data";
import { computeEdgeCost, ProfileDefinition } from "./costFunctions";
import { isEdgePassableAtTime, getEdgeImpassableMin } from "./hazardEngine";

interface HeapItem {
  nodeId: string;
  arrivalSec: number;
}

export class BinaryHeap {
  private data: HeapItem[] = [];

  push(item: HeapItem) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapItem | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.data[index].arrivalSec < this.data[parentIdx].arrivalSec) {
        const tmp = this.data[index];
        this.data[index] = this.data[parentIdx];
        this.data[parentIdx] = tmp;
        index = parentIdx;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number) {
    const len = this.data.length;
    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left < len && this.data[left].arrivalSec < this.data[smallest].arrivalSec) {
        smallest = left;
      }
      if (right < len && this.data[right].arrivalSec < this.data[smallest].arrivalSec) {
        smallest = right;
      }
      if (smallest !== index) {
        const tmp = this.data[index];
        this.data[index] = this.data[smallest];
        this.data[smallest] = tmp;
        index = smallest;
      } else {
        break;
      }
    }
  }
}

export interface DijkstraResultNode {
  nodeId: string;
  arrivalSec: number;
  prevNodeId: string | null;
  prevEdgeId: string | null;
}

export interface SearchOptions {
  startNodeId: string;
  departureSec: number;
  profile: ProfileDefinition;
  ignoreHazards?: boolean;
  ignoreProfileConstraints?: boolean;
  distanceOnly?: boolean;
}

/**
 * Custom binary-heap time-dependent Dijkstra.
 * Earliest arrival is optimal because edge traversal costs are positive
 * expected seconds, and hazard impassability is monotonically non-decreasing (FIFO property holds).
 */
export function runDijkstra(
  graph: GraphIndex,
  options: SearchOptions
): Record<string, DijkstraResultNode> {
  const {
    startNodeId,
    departureSec,
    profile,
    ignoreHazards = false,
    ignoreProfileConstraints = false,
    distanceOnly = false,
  } = options;

  const results: Record<string, DijkstraResultNode> = {};
  const heap = new BinaryHeap();

  heap.push({ nodeId: startNodeId, arrivalSec: departureSec });
  results[startNodeId] = {
    nodeId: startNodeId,
    arrivalSec: departureSec,
    prevNodeId: null,
    prevEdgeId: null,
  };

  while (!heap.isEmpty()) {
    const current = heap.pop()!;
    const bestKnown = results[current.nodeId];

    // If popped arrival time is worse than already recorded best arrival, skip
    if (current.arrivalSec > bestKnown.arrivalSec) {
      continue;
    }

    const fromNode = graph.nodes[current.nodeId];
    if (!fromNode) continue;

    const outEdges = graph.adj[current.nodeId] || [];
    for (const edge of outEdges) {
      const toNode = graph.nodes[edge.to];
      if (!toNode) continue;

      // Check physical constraints
      let traversalSec = 0;
      if (distanceOnly) {
        // Generic walker 1.4 m/s, raw distance only
        traversalSec = edge.distance / 1.4;
      } else {
        const cost = computeEdgeCost(edge, fromNode, toNode, profile);
        if (!ignoreProfileConstraints && cost.blocked) {
          continue;
        }
        traversalSec = (edge.distance / profile.speed) * cost.slowdown;
      }

      // Check time-dependent hazard constraint
      const entryTimeSec = current.arrivalSec;
      const entryTimeMin = entryTimeSec / 60;
      if (!ignoreHazards) {
        if (!isEdgePassableAtTime(edge.id, entryTimeMin, profile.id)) {
          continue;
        }
      }

      const newArrivalSec = current.arrivalSec + traversalSec;
      const existing = results[edge.to];

      if (!existing || newArrivalSec < existing.arrivalSec) {
        results[edge.to] = {
          nodeId: edge.to,
          arrivalSec: newArrivalSec,
          prevNodeId: current.nodeId,
          prevEdgeId: edge.id,
        };
        heap.push({ nodeId: edge.to, arrivalSec: newArrivalSec });
      }
    }
  }

  return results;
}
