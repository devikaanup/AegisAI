"use client";

import React, { useEffect, useState, useRef } from "react";
import { RouteResult } from "@/lib/routing";
import { getGraph } from "@/lib/graph";
import { ProfileDefinition } from "@/lib/costFunctions";
import { aiVoice } from "@/lib/speech";

interface RaceModeProps {
  isActive: boolean;
  onStop: () => void;
  committedRoute: RouteResult;
  profile: ProfileDefinition;
  departureMinute: number;
  onUpdateEvacueePosition: (pos: { lng: number; lat: number } | null) => void;
  onAdvanceSimulationMinute: (min: number) => void;
  aiVoiceEnabled?: boolean;
}

export function RaceMode({
  isActive,
  onStop,
  committedRoute,
  profile,
  departureMinute,
  onUpdateEvacueePosition,
  onAdvanceSimulationMinute,
  aiVoiceEnabled = true,
}: RaceModeProps) {
  const [elapsedRealSec, setElapsedRealSec] = useState(0);
  const [nextFloodWarning, setNextFloodWarning] = useState<string>("Analyzing hazard front...");
  const [progressPct, setProgressPct] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(15);

  const reqRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const departureMinuteRef = useRef<number>(departureMinute);

  const callbacksRef = useRef({
    onStop,
    onUpdateEvacueePosition,
    onAdvanceSimulationMinute,
    committedRoute,
    profile,
    aiVoiceEnabled,
  });

  useEffect(() => {
    callbacksRef.current = {
      onStop,
      onUpdateEvacueePosition,
      onAdvanceSimulationMinute,
      committedRoute,
      profile,
      aiVoiceEnabled,
    };
  });

  useEffect(() => {
    if (!isActive || !committedRoute || committedRoute.nodeIds.length === 0) {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      callbacksRef.current.onUpdateEvacueePosition(null);
      setElapsedRealSec(0);
      setProgressPct(0);
      setIsCompleted(false);
      startTimeRef.current = null;
      return;
    }

    // Freeze departure minute at start of race
    departureMinuteRef.current = departureMinute;

    const graph = getGraph();
    const routeCoords: [number, number][] = committedRoute.nodeIds
      .map((id) => {
        const n = graph.nodes[id];
        return n ? ([n.lng, n.lat] as [number, number]) : null;
      })
      .filter((c): c is [number, number] => c !== null);

    if (routeCoords.length === 0) return;

    const totalDistM = committedRoute.distanceM;
    const walkSpeed = profile.speed; // m/s
    const totalWalkDurationSec = totalDistM / walkSpeed;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const realElapsedSec = (timestamp - startTimeRef.current) / 1000;
      const simSecWalked = realElapsedSec * speedMultiplier;
      const simMinute = departureMinuteRef.current + simSecWalked / 60;

      callbacksRef.current.onAdvanceSimulationMinute(Math.min(30, simMinute));
      setElapsedRealSec(Math.round(realElapsedSec));

      const fraction = Math.min(1, simSecWalked / totalWalkDurationSec);
      setProgressPct(Math.round(fraction * 100));

      // Calculate current position along the coordinates array
      const totalPoints = routeCoords.length;
      if (totalPoints > 1) {
        const currentIdxFloat = fraction * (totalPoints - 1);
        const currentIdx = Math.floor(currentIdxFloat);
        const nextIdx = Math.min(totalPoints - 1, currentIdx + 1);
        const subFrac = currentIdxFloat - currentIdx;

        const lng =
          routeCoords[currentIdx][0] +
          subFrac * (routeCoords[nextIdx][0] - routeCoords[currentIdx][0]);
        const lat =
          routeCoords[currentIdx][1] +
          subFrac * (routeCoords[nextIdx][1] - routeCoords[currentIdx][1]);

        callbacksRef.current.onUpdateEvacueePosition({ lng, lat });
      }

      // Live flood countdown calculation
      const edgeCount = callbacksRef.current.committedRoute.edgeAnnotations.length;
      if (edgeCount > 0) {
        const currentEdgeIdx = Math.min(
          edgeCount - 1,
          Math.floor(fraction * edgeCount)
        );
        const upcomingEdge =
          callbacksRef.current.committedRoute.edgeAnnotations[
            Math.min(edgeCount - 1, currentEdgeIdx + 1)
          ] || callbacksRef.current.committedRoute.edgeAnnotations[currentEdgeIdx];

        if (upcomingEdge && upcomingEdge.floodArrivalMin !== null) {
          const remainingSimMin = upcomingEdge.floodArrivalMin - simMinute;
          if (remainingSimMin > 0) {
            const remainingSec = Math.round(remainingSimMin * 60);
            setNextFloodWarning(`Flood reaches ${upcomingEdge.name} in ${remainingSec}s`);
          } else {
            setNextFloodWarning(`Water active on ${upcomingEdge.name}`);
          }
        } else {
          setNextFloodWarning("High ground ahead — path currently clear of water");
        }
      }

      if (fraction >= 1) {
        setIsCompleted(true);
        if (callbacksRef.current.aiVoiceEnabled) {
          aiVoice?.speak(
            `Citizen has safely reached ${callbacksRef.current.committedRoute.shelterName || "shelter"} with time to spare!`
          );
        }
        return;
      }

      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      startTimeRef.current = null;
    };
  }, [isActive, speedMultiplier]);

  if (!isActive) return null;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-xl w-full px-4 select-none animate-in fade-in duration-200">
      <div className="p-4 rounded-xl border border-emerald-500/80 bg-slate-950/95 backdrop-blur-md shadow-2xl space-y-3">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
              LIVE EVACUATION RACE (COMMITTED ROUTE)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Speed Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-1 text-[10px] font-mono">
              <span className="text-slate-400 mr-1">Speed:</span>
              <button
                onClick={() => setSpeedMultiplier(10)}
                className={`px-1.5 py-0.5 rounded ${
                  speedMultiplier === 10 ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-300"
                }`}
              >
                10x
              </button>
              <button
                onClick={() => setSpeedMultiplier(15)}
                className={`px-1.5 py-0.5 rounded ${
                  speedMultiplier === 15 ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-300"
                }`}
              >
                15x
              </button>
              <button
                onClick={() => setSpeedMultiplier(25)}
                className={`px-1.5 py-0.5 rounded ${
                  speedMultiplier === 25 ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-300"
                }`}
              >
                25x
              </button>
            </div>

            <button
              onClick={onStop}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-colors"
            >
              EXIT RACE
            </button>
          </div>
        </div>

        {/* Live Warning / Countdown */}
        <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300 font-semibold">{nextFloodWarning}</span>
          </div>
          <span className="text-slate-400">
            {profile.name} ({profile.speed} m/s)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-slate-300">
            <span>Progress to {committedRoute.shelterName}</span>
            <span className="font-bold text-emerald-400 tabular-nums">
              {progressPct}% ({Math.round((progressPct / 100) * committedRoute.distanceM)}m / {committedRoute.distanceM}m)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-100 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {isCompleted && (
          <div className="p-2.5 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-mono font-bold text-center animate-in zoom-in-95">
            🎉 CITIZEN SAFELY REACHED {committedRoute.shelterName?.toUpperCase()}!
          </div>
        )}
      </div>
    </div>
  );
}
