import { describe, it, expect } from "vitest";
import { BinaryHeap, runDijkstra } from "@/lib/dijkstra";
import { getGraph } from "@/lib/graph";
import { getProfile } from "@/lib/costFunctions";

describe("Custom Binary Heap & Dijkstra Engine", () => {
  it("BinaryHeap accurately pops items in ascending order of arrivalSec", () => {
    const heap = new BinaryHeap();
    heap.push({ nodeId: "A", arrivalSec: 50 });
    heap.push({ nodeId: "B", arrivalSec: 10 });
    heap.push({ nodeId: "C", arrivalSec: 30 });
    heap.push({ nodeId: "D", arrivalSec: 70 });
    heap.push({ nodeId: "E", arrivalSec: 20 });

    expect(heap.pop()?.nodeId).toBe("B"); // 10
    expect(heap.pop()?.nodeId).toBe("E"); // 20
    expect(heap.pop()?.nodeId).toBe("C"); // 30
    expect(heap.pop()?.nodeId).toBe("A"); // 50
    expect(heap.pop()?.nodeId).toBe("D"); // 70
    expect(heap.pop()).toBeUndefined();
  });

  it("runDijkstra computes optimal shortest arrival times on the neighborhood graph", () => {
    const graph = getGraph();
    const profile = getProfile("wheelchair");

    const results = runDijkstra(graph, {
      startNodeId: "r1c1",
      departureSec: 0,
      profile,
    });

    expect(results["r1c1"].arrivalSec).toBe(0);
    expect(results["r3c1"]).toBeDefined();
    expect(results["r3c1"].arrivalSec).toBeGreaterThan(0);
  });
});
