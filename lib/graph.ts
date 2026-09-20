import graphData from "@/data/graph.json";
import { GraphNode, GraphEdge } from "@/scripts/generate-data";

export interface GraphIndex {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  edgeById: Record<string, GraphEdge>;
  adj: Record<string, GraphEdge[]>;
  nodeDegree: Record<string, number>;
}

let cachedIndex: GraphIndex | null = null;

export function getGraph(): GraphIndex {
  if (cachedIndex) {
    return cachedIndex;
  }

  const nodes = graphData.nodes as Record<string, GraphNode>;
  const edges = graphData.edges as GraphEdge[];

  const edgeById: Record<string, GraphEdge> = {};
  const adj: Record<string, GraphEdge[]> = {};
  const nodeDegree: Record<string, number> = {};

  for (const nodeId of Object.keys(nodes)) {
    adj[nodeId] = [];
    nodeDegree[nodeId] = nodes[nodeId].degree;
  }

  for (const edge of edges) {
    edgeById[edge.id] = edge;
    if (!adj[edge.from]) {
      adj[edge.from] = [];
    }
    adj[edge.from].push(edge);
  }

  cachedIndex = {
    nodes,
    edges,
    edgeById,
    adj,
    nodeDegree,
  };

  return cachedIndex;
}
