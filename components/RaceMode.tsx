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
  const [elapsedRealSec, setElapsedRealSec] = useState(0);
  const [nextFloodWarning, setNextFloodWarning] = useState<string>("Analyzing hazard front...");
  const [progressPct, setProgressPct] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const reqRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || committedRoute.nodeIds.length === 0) {
      onUpdateEvacueePosition(null);
      setElapsedRealSec(0);
      setProgressPct(0);
      setIsCompleted(false);
      return;
    }

    const graph = getGraph();
    const routeCoords: [number, number][] = committedRoute.nodeIds
      .map((id) => {
        const n = graph.nodes[id];
        return n ? [n.lng, n.lat] as [number, number] : null;
      })
      .filter((c): c is [number, number] => c !== null);

    const totalDistM = committedRoute.distanceM;
    const walkSpeed = profile.speed; // m/s
    const totalWalkDurationSec = totalDistM / walkSpeed;

    // Simulation speed factor for race demo: 15x real time (so a 10-min walk plays out in ~40 seconds)
    const SPEED_FACTOR = 15;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const realElapsedSec = (timestamp - startTimeRef.current) / 1000;
      const simSecWalked = realElapsedSec * SPEED_FACTOR;
      const simMinute = departureMinute + simSecWalked / 60;
      onAdvanceSimulationMinute(Math.min(30, simMinute));
      setElapsedRealSec(realElapsedSec);

      const fraction = Math.min(1, simSecWalked / totalWalkDurationSec);
      setProgressPct(Math.round(fraction * 100));

      // Calculate current position along the coordinates array
      const totalPoints = routeCoords.length;
      const currentIdxFloat = fraction * (totalPoints - 1);
      const currentIdx = Math.floor(currentIdxFloat);
      const nextIdx = Math.min(totalPoints - 1, currentIdx + 1);
      const subFrac = currentIdxFloat - currentIdx;

      if (routeCoords[currentIdx] && routeCoords[nextIdx]) {
        const lng =
          routeCoords[currentIdx][0] +
          subFrac * (routeCoords[nextIdx][0] - routeCoords[currentIdx][0]);
        const lat =
          routeCoords[currentIdx][1] +
          subFrac * (routeCoords[nextIdx][1] - routeCoords[currentIdx][1]);
        onUpdateEvacueePosition({ lng, lat });
      }

      // Live flood countdown calculation
      const currentEdgeIdx = Math.floor(fraction * committedRoute.edgeAnnotations.length);
      const upcomingEdge = committedRoute.edgeAnnotations[currentEdgeIdx + 1];
      if (upcomingEdge && upcomingEdge.floodArrivalMin !== null) {
        const remainingSimMin = upcomingEdge.floodArrivalMin - simMinute;
        if (remainingSimMin > 0) {
          const remainingSec = Math.round(remainingSimMin * 60);
          setNextFloodWarning(`Flood reaches ${upcomingEdge.name} in ${remainingSec}s`);
        } else {
          setNextFloodWarning(`Water is entering ${upcomingEdge.name} now!`);
        }
      } else {
        setNextFloodWarning("High ground ahead — path currently clear of water");
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
    };
  }, [
    isActive,
    committedRoute,
    profile,
    departureMinute,
    onUpdateEvacueePosition,
    onAdvanceSimulationMinute,
  ]);

  if (!isActive) return null;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-xl w-full px-4 select-none">
      <div className="p-4 rounded-xl border border-emerald-500/80 bg-slate-950/95 backdrop-blur-md shadow-2xl space-y-3">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
              LIVE EVACUATION RACE (COMMITTED ROUTE)
            </span>
          </div>
          <button
            onClick={onStop}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
          >
            EXIT RACE
          </button>
        </div>

        {/* Live Warning / Countdown */}
        <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-amber-400 font-semibold">{nextFloodWarning}</span>
          <span className="text-slate-400">
            Speed: {profile.speed} m/s
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono text-slate-300">
            <span>Progress to {committedRoute.shelterName}</span>
            <span className="font-bold text-emerald-400 tabular-nums">
              {progressPct}% ({Math.round((progressPct / 100) * committedRoute.distanceM)}m)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {isCompleted && (
          <div className="p-2.5 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-mono font-bold text-center">
            🎉 CITIZEN SAFELY REACHED {committedRoute.shelterName?.toUpperCase()}!
          </div>
        )}
      </div>
    </div>
  );
}
