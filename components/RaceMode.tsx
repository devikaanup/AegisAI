"use client";

import React, { useEffect, useState, useRef } from "react";
import { RouteResult } from "@/lib/routing";
import { getGraph } from "@/lib/graph";
import { ProfileDefinition } from "@/lib/costFunctions";

interface RaceModeProps {
  isActive: boolean;
  onStop: () => void;
  committedRoute: RouteResult;
  profile: ProfileDefinition;
  departureMinute: number;
  onUpdateEvacueePosition: (pos: { lng: number; lat: number } | null) => void;
  onAdvanceSimulationMinute: (min: number) => void;
}

export function RaceMode({
  isActive,
  onStop,
  committedRoute,
  profile,
  departureMinute,
  onUpdateEvacueePosition,
  onAdvanceSimulationMinute,
}: RaceModeProps) {
  const [nextFloodWarning, setNextFloodWarning] = useState<string>("Analyzing hazard front...");
  const [progressPct, setProgressPct] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(15);

  const reqRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const departureMinuteRef = useRef<number>(departureMinute);

  const lastSimMinDispatchedRef = useRef<number>(-1);
  const lastWarningUpdateRef = useRef<number>(0);
  const lastProgressPctRef = useRef<number>(-1);

  const callbacksRef = useRef({
    onStop,
    onUpdateEvacueePosition,
    onAdvanceSimulationMinute,
    committedRoute,
    profile,
  });

  useEffect(() => {
    callbacksRef.current = {
      onStop,
      onUpdateEvacueePosition,
      onAdvanceSimulationMinute,
      committedRoute,
      profile,
    };
  });

  useEffect(() => {
    if (!isActive || !committedRoute || committedRoute.nodeIds.length === 0) {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      startTimeRef.current = null;
      setProgressPct(0);
      setIsCompleted(false);
      lastSimMinDispatchedRef.current = -1;
      lastWarningUpdateRef.current = 0;
      lastProgressPctRef.current = -1;
      return;
    }

    // Freeze departure minute at start of demo
    departureMinuteRef.current = departureMinute;
    setIsCompleted(false);
    setProgressPct(0);
    lastSimMinDispatchedRef.current = -1;
    lastWarningUpdateRef.current = 0;
    lastProgressPctRef.current = -1;

    // Precalculate polyline points along the committed route
    const graph = getGraph();
    const routeCoords: [number, number][] = committedRoute.nodeIds.map((nId) => {
      const n = graph.nodes[nId];
      return n ? [n.lng, n.lat] : [0, 0];
    });

    const segmentDistances: number[] = [];
    let totalDist = 0;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const p1 = routeCoords[i];
      const p2 = routeCoords[i + 1];
      const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 111320;
      segmentDistances.push(d);
      totalDist += d;
    }

    const totalDurationSeconds = (committedRoute.totalTimeMin * 60) / speedMultiplier;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsedSeconds = (timestamp - startTimeRef.current) / 1000;
      const fraction = Math.min(1, elapsedSeconds / Math.max(1, totalDurationSeconds));

      const currentDist = fraction * totalDist;
      let accum = 0;
      let lng = routeCoords[0][0];
      let lat = routeCoords[0][1];

      for (let i = 0; i < segmentDistances.length; i++) {
        const segDist = segmentDistances[i];
        if (accum + segDist >= currentDist || i === segmentDistances.length - 1) {
          const segFraction = segDist > 0 ? (currentDist - accum) / segDist : 0;
          const p1 = routeCoords[i];
          const p2 = routeCoords[i + 1];
          lng = p1[0] + (p2[0] - p1[0]) * segFraction;
          lat = p1[1] + (p2[1] - p1[1]) * segFraction;
          break;
        }
        accum += segDist;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("aegis:evacuee-pos", { detail: { lng, lat } })
        );
      }

      const simMinuteElapsed = fraction * committedRoute.totalTimeMin;
      const currentSimMin = Math.min(30, departureMinuteRef.current + simMinuteElapsed);

      if (Math.abs(currentSimMin - lastSimMinDispatchedRef.current) >= 0.1) {
        lastSimMinDispatchedRef.current = currentSimMin;
        callbacksRef.current.onAdvanceSimulationMinute(
          Math.round(currentSimMin * 10) / 10
        );
      }

      const pct = Math.round(fraction * 100);
      if (pct !== lastProgressPctRef.current) {
        lastProgressPctRef.current = pct;
        setProgressPct(pct);
      }

      if (timestamp - lastWarningUpdateRef.current > 600) {
        lastWarningUpdateRef.current = timestamp;
        if (callbacksRef.current.committedRoute.edgeAnnotations) {
          const remainingEdges = callbacksRef.current.committedRoute.edgeAnnotations.filter(
            (ann) => ann.floodArrivalMin != null && ann.floodArrivalMin > currentSimMin
          );
          if (remainingEdges.length > 0) {
            const nearest = remainingEdges[0];
            const timeUntilFlood = (nearest.floodArrivalMin! - currentSimMin).toFixed(1);
            setNextFloodWarning(
              `Flood front reaches ${nearest.name} in ~${timeUntilFlood} min`
            );
          } else {
            setNextFloodWarning("High ground ahead — path currently clear of water");
          }
        }
      }

      if (fraction >= 1) {
        setIsCompleted(true);
        return;
      }

      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      startTimeRef.current = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aegis:evacuee-reset"));
      }
    };
  }, [isActive, speedMultiplier]);

  if (!isActive) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[calc(100%-2rem)] select-none animate-in fade-in duration-200">
      <div className="p-3 rounded-xl border border-emerald-500/70 bg-[#0c121d]/95 backdrop-blur-md shadow-2xl space-y-2 text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-mono font-extrabold text-emerald-300 uppercase tracking-wider truncate">
              DEMO // {profile.name} → {committedRoute.shelterName}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Speed Toggle */}
            <div className="flex items-center bg-[#070a0f] border border-slate-700/80 rounded px-1 text-[10px] font-mono">
              <span className="text-slate-400 mr-1">Pace:</span>
              {[10, 15, 25].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeedMultiplier(spd)}
                  className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                    speedMultiplier === spd
                      ? "bg-emerald-500 text-slate-950 font-extrabold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              onClick={onStop}
              className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-[10px] font-mono font-bold text-rose-200 transition-colors cursor-pointer"
            >
              EXIT ✕
            </button>
          </div>
        </div>

        {/* Hazard Countdown & Metrics Strip */}
        <div className="px-2.5 py-1.5 rounded-lg bg-[#070a0f]/80 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center space-x-2 truncate mr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="text-amber-300 font-semibold truncate">{nextFloodWarning}</span>
          </div>
          <span className="text-slate-400 shrink-0 tabular-nums">
            {Math.round((progressPct / 100) * committedRoute.distanceM)}m / {committedRoute.distanceM}m ({progressPct}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-[#070a0f] border border-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-150 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {isCompleted && (
          <div className="py-1.5 px-2.5 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-mono font-bold flex items-center justify-between">
            <span className="truncate">🎉 REACHED {committedRoute.shelterName?.toUpperCase()} AHEAD OF FLOOD!</span>
            <button
              onClick={onStop}
              className="ml-2 px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-extrabold uppercase transition-all shrink-0 cursor-pointer"
              title="Reset departure time, water levels, and person location"
            >
              RESET ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
