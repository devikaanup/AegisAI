"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import roadsGeoJSON from "@/data/roads.json";
import floodPolygonsData from "@/data/floodPolygons.json";
import sheltersData from "@/data/shelters.json";
import { getGraph } from "@/lib/graph";
import { RouteResult, StandardRouteComparison } from "@/lib/routing";
import { ShelterState } from "@/lib/shelterEngine";
import { getEdgeHazardState } from "@/lib/hazardEngine";

interface MapViewProps {
  currentRoute: RouteResult;
  standardComparison: StandardRouteComparison;
  showStandardRoute: boolean;
  simulationMinute: number;
  profileId: string;
  evacueeStartJunction: string;
  shelters: Record<string, ShelterState>;
  raceProgress?: { lng: number; lat: number } | null;
}

export function MapView({
  currentRoute,
  standardComparison,
  showStandardRoute,
  simulationMinute,
  profileId,
  evacueeStartJunction,
  shelters,
  raceProgress,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const evacueeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const shelterMarkersRef = useRef<maplibregl.Marker[]>([]);
  const obstacleMarkersRef = useRef<maplibregl.Marker[]>([]);

  // 1. Initialize MapLibre with inline dark style and StrictMode safety
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let isMounted = true;

    const graph = getGraph();
    const startNode = graph.nodes[evacueeStartJunction] || Object.values(graph.nodes)[0];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0a0d12" },
          },
        ],
      },
      center: [startNode.lng, startNode.lat],
      zoom: 15.2,
      pitch: 15,
      attributionControl: false,
    });

    map.on("load", () => {
      if (!isMounted) return;

      // 1. Base Road Network Source
      map.addSource("roads-base", {
        type: "geojson",
        data: roadsGeoJSON as any,
      });

      map.addLayer({
        id: "roads-base-casing",
        type: "line",
        source: "roads-base",
        paint: {
          "line-color": "#141b26",
          "line-width": 6,
        },
      });

      map.addLayer({
        id: "roads-base-line",
        type: "line",
        source: "roads-base",
        paint: {
          "line-color": "#1e293b",
          "line-width": 3,
        },
      });

      // 2. Precomputed Flood Extent Source
      map.addSource("flood-extent", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "flood-extent-fill",
        type: "fill",
        source: "flood-extent",
        paint: {
          "fill-color": "#1e3a8a",
          "fill-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "flood-extent-stroke",
        type: "line",
        source: "flood-extent",
        paint: {
          "line-color": "#3b82f6",
          "line-width": 2.5,
          "line-blur": 1,
        },
      });

      // 3. Dynamic Hazard Overlay for Roads (Threatened / Impassable)
      map.addSource("roads-hazard", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "roads-hazard-line",
        type: "line",
        source: "roads-hazard",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3.5,
          "line-opacity": 0.85,
        },
      });

      // 4. Standard Route Source (Dashed Red)
      map.addSource("route-standard", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "route-standard-line",
        type: "line",
        source: "route-standard",
        paint: {
          "line-color": "#ef4444",
          "line-width": 4,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      });

      // 5. Accessible Safe Route Source (Glowing Emerald)
      map.addSource("route-accessible", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "route-accessible-glow",
        type: "line",
        source: "route-accessible",
        paint: {
          "line-color": "#10b981",
          "line-width": 12,
          "line-opacity": 0.25,
          "line-blur": 4,
        },
      });

      map.addLayer({
        id: "route-accessible-line",
        type: "line",
        source: "route-accessible",
        paint: {
          "line-color": "#10b981",
          "line-width": 5,
          "line-opacity": 0.95,
        },
      });

      // 6. Shelters as Custom Markers
      shelterMarkersRef.current = [];
      for (const s of sheltersData) {
        const jNode = graph.nodes[s.junctionId];
        if (!jNode) continue;

        const el = document.createElement("div");
        el.className = "shelter-marker select-none cursor-pointer";
        el.innerHTML = `
          <div class="px-2 py-1 rounded bg-slate-900/90 border border-cyan-500 shadow-lg text-[11px] font-mono text-cyan-300 flex items-center space-x-1.5 whitespace-nowrap">
            <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span class="font-bold">${s.name}</span>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([jNode.lng, jNode.lat])
          .addTo(map);

        shelterMarkersRef.current.push(marker);
      }

      // 7. Obstacle Badges
      obstacleMarkersRef.current = [];
      const obstacles = [
        { name: "Steps", lngLat: [graph.nodes["r1c1"]?.lng ?? 79.1538, (graph.nodes["r1c1"]?.lat ?? 12.9693) + 0.0006] },
        { name: "Kerb 15cm", lngLat: [(graph.nodes["r0c1"]?.lng ?? 79.1538) + 0.0009, graph.nodes["r0c1"]?.lat ?? 12.968] },
        { name: "Slope 9%", lngLat: [(graph.nodes["r2c3"]?.lng ?? 79.1575) - 0.0005, graph.nodes["r2c3"]?.lat ?? 12.9707] },
        { name: "Unsignalized 4-lane", lngLat: [(graph.nodes["r1c2"]?.lng ?? 79.1557) + 0.0009, graph.nodes["r1c2"]?.lat ?? 12.9693] },
        { name: "Rough: Gravel", lngLat: [(graph.nodes["r2c0"]?.lng ?? 79.152) + 0.0009, graph.nodes["r2c0"]?.lat ?? 12.9707] },
      ];

      for (const obs of obstacles) {
        const el = document.createElement("div");
        el.className = "px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-[9px] font-mono text-slate-300 shadow pointer-events-none";
        el.innerText = obs.name;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(obs.lngLat as [number, number])
          .addTo(map);
        obstacleMarkersRef.current.push(marker);
      }

      // 8. Evacuee Marker
      const evacueeEl = document.createElement("div");
      evacueeEl.className = "evacuee-marker select-none";
      evacueeEl.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="w-6 h-6 rounded-full bg-emerald-500/40 animate-ping absolute"></div>
          <div class="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-[10px] text-slate-950 font-bold">
            🚶
          </div>
        </div>
      `;

      evacueeMarkerRef.current = new maplibregl.Marker({ element: evacueeEl })
        .setLngLat([startNode.lng, startNode.lat])
        .addTo(map);

      // Fit bounds to neighborhood
      const allLngs = Object.values(graph.nodes).map((n) => n.lng);
      const allLats = Object.values(graph.nodes).map((n) => n.lat);
      const minLng = Math.min(...allLngs);
      const maxLng = Math.max(...allLngs);
      const minLat = Math.min(...allLats);
      const maxLat = Math.max(...allLats);

      map.fitBounds(
        [
          [minLng - 0.001, minLat - 0.001],
          [maxLng + 0.001, maxLat + 0.001],
        ],
        { padding: 40, duration: 0 }
      );

      setIsMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      isMounted = false;
      // Clean up markers
      shelterMarkersRef.current.forEach((m) => m.remove());
      shelterMarkersRef.current = [];
      obstacleMarkersRef.current.forEach((m) => m.remove());
      obstacleMarkersRef.current = [];
      if (evacueeMarkerRef.current) {
        evacueeMarkerRef.current.remove();
        evacueeMarkerRef.current = null;
      }

      try {
        map.remove();
      } catch {}
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, []);

  // 2. Smooth flyTo on evacuee change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const graph = getGraph();
    const startNode = graph.nodes[evacueeStartJunction];
    if (startNode) {
      map.flyTo({
        center: [startNode.lng, startNode.lat],
        speed: 1.2,
        curve: 1.1,
      });
    }
  }, [evacueeStartJunction, isMapLoaded]);

  // 3. Update Map Layers via .setData() ONLY
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !map.isStyleLoaded()) return;
    const graph = getGraph();

    // A. Update Precomputed Flood Polygon
    const minuteFloor = Math.max(0, Math.min(30, Math.floor(simulationMinute)));
    const poly = (floodPolygonsData as Record<string, any>)[String(minuteFloor)];
    const floodSrc = map.getSource("flood-extent") as maplibregl.GeoJSONSource | undefined;
    if (floodSrc && typeof floodSrc.setData === "function") {
      floodSrc.setData(poly || { type: "FeatureCollection", features: [] });
    }

    // B. Update Dynamic Road Hazard Colors (Threatened/Impassable)
    const hazardFeatures: any[] = [];
    for (const edge of graph.edges) {
      if (edge.from < edge.to) {
        const state = getEdgeHazardState(edge.id, simulationMinute, profileId);
        if (state === "threatened" || state === "impassable") {
          const fNode = graph.nodes[edge.from];
          const tNode = graph.nodes[edge.to];
          if (fNode && tNode) {
            hazardFeatures.push({
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [fNode.lng, fNode.lat],
                  [tNode.lng, tNode.lat],
                ],
              },
              properties: {
                color: state === "impassable" ? "#ef4444" : "#f59e0b",
              },
            });
          }
        }
      }
    }
    const hazardSrc = map.getSource("roads-hazard") as maplibregl.GeoJSONSource | undefined;
    if (hazardSrc && typeof hazardSrc.setData === "function") {
      hazardSrc.setData({ type: "FeatureCollection", features: hazardFeatures });
    }

    // C. Update Accessible Route Line
    const accessibleCoords: [number, number][] = currentRoute.nodeIds
      .map((nId) => {
        const n = graph.nodes[nId];
        return n ? ([n.lng, n.lat] as [number, number]) : null;
      })
      .filter((c): c is [number, number] => c !== null);

    const accSrc = map.getSource("route-accessible") as maplibregl.GeoJSONSource | undefined;
    if (accSrc && typeof accSrc.setData === "function") {
      accSrc.setData(
        accessibleCoords.length >= 2
          ? {
              type: "Feature",
              geometry: { type: "LineString", coordinates: accessibleCoords },
              properties: {},
            }
          : { type: "FeatureCollection", features: [] }
      );
    }

    // D. Update Standard Route Line
    const stdSrc = map.getSource("route-standard") as maplibregl.GeoJSONSource | undefined;
    if (stdSrc && typeof stdSrc.setData === "function") {
      if (showStandardRoute) {
        const stdCoords: [number, number][] = standardComparison.nodeIds
          .map((nId) => {
            const n = graph.nodes[nId];
            return n ? ([n.lng, n.lat] as [number, number]) : null;
          })
          .filter((c): c is [number, number] => c !== null);

        stdSrc.setData(
          stdCoords.length >= 2
            ? {
                type: "Feature",
                geometry: { type: "LineString", coordinates: stdCoords },
                properties: {},
              }
            : { type: "FeatureCollection", features: [] }
        );
      } else {
        stdSrc.setData({ type: "FeatureCollection", features: [] });
      }
    }

    // F. Update Shelter Marker status labels
    for (let i = 0; i < sheltersData.length; i++) {
      const s = sheltersData[i];
      const marker = shelterMarkersRef.current[i];
      const sState = shelters[s.id];
      if (marker && sState) {
        const el = marker.getElement();
        const isSelected = s.id === currentRoute.shelterId;
        const isFull = sState.isFull;

        el.innerHTML = `
          <div class="px-2 py-1 rounded border shadow-lg text-[11px] font-mono flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            isSelected
              ? "bg-cyan-950/90 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/30 scale-105"
              : isFull
              ? "bg-rose-950/90 border-rose-500 text-rose-300"
              : "bg-slate-900/90 border-slate-700 text-slate-300"
          }">
            <span class="w-2 h-2 rounded-full ${
              isSelected ? "bg-cyan-400 animate-pulse" : isFull ? "bg-rose-500" : "bg-slate-500"
            }"></span>
            <span class="font-bold">${s.name}</span>
            <span class="text-[10px] text-slate-400">(${sState.currentOccupancy}/${sState.capacity})</span>
            ${isFull ? '<span class="px-1 bg-rose-800 text-white text-[9px] rounded font-bold">FULL</span>' : ""}
          </div>
        `;
      }
    }
  }, [
    isMapLoaded,
    currentRoute,
    standardComparison,
    showStandardRoute,
    simulationMinute,
    profileId,
    shelters,
  ]);

  // 4. Dedicated lightweight effect for smooth 60fps evacuee marker movement
  useEffect(() => {
    if (!evacueeMarkerRef.current) return;
    if (raceProgress) {
      evacueeMarkerRef.current.setLngLat([raceProgress.lng, raceProgress.lat]);
    } else {
      const graph = getGraph();
      const startNode = graph.nodes[evacueeStartJunction];
      if (startNode) {
        evacueeMarkerRef.current.setLngLat([startNode.lng, startNode.lat]);
      }
    }
  }, [raceProgress, evacueeStartJunction]);

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    const graph = getGraph();
    const allLngs = Object.values(graph.nodes).map((n) => n.lng);
    const allLats = Object.values(graph.nodes).map((n) => n.lat);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);
    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);

    map.fitBounds(
      [
        [minLng - 0.001, minLat - 0.001],
        [maxLng + 0.001, maxLat + 0.001],
      ],
      { padding: 40, duration: 600 }
    );
  };

  return (
    <div className="relative w-full h-full bg-[#0a0d12] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Navigation Controls */}
      <div className="absolute top-3 left-3 z-20 flex items-center space-x-1.5 select-none">
        <button
          onClick={handleResetView}
          className="px-2.5 py-1 rounded-md bg-[#0c111a]/85 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-300 hover:text-white backdrop-blur-md shadow transition-colors flex items-center space-x-1"
          title="Reset map camera to whole neighborhood view"
        >
          <span>⤢</span>
          <span>Fit Neighborhood</span>
        </button>
      </div>
    </div>
  );
}
