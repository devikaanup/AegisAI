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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("aegis:evacuee-reset"));
      }
      setProgressPct(0);
      setIsCompleted(false);
      startTimeRef.current = null;
      lastSimMinDispatchedRef.current = -1;
      lastWarningUpdateRef.current = 0;
      lastProgressPctRef.current = -1;
      return;
    }

    // Freeze departure minute at start of race
    departureMinuteRef.current = departureMinute;
    lastSimMinDispatchedRef.current = departureMinute;

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
      const fraction = Math.min(1, simSecWalked / totalWalkDurationSec);

      // 1. Calculate and update 60 FPS marker position directly via DOM/CustomEvent without full React re-render
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("aegis:evacuee-pos", { detail: { lng, lat } })
          );
        }
      }

      // 2. Throttle simulation minute updates to 4Hz (every 0.25 min) to prevent CPU thrashing
      const roundedMin = Math.min(30, Number(simMinute.toFixed(1)));
      if (Math.abs(roundedMin - lastSimMinDispatchedRef.current) >= 0.25 || fraction >= 1) {
        lastSimMinDispatchedRef.current = roundedMin;
        callbacksRef.current.onAdvanceSimulationMinute(roundedMin);
      }

      // 3. Throttle progress percentage update (only on integer change)
      const currentPct = Math.round(fraction * 100);
      if (currentPct !== lastProgressPctRef.current) {
        lastProgressPctRef.current = currentPct;
        setProgressPct(currentPct);
      }

      // 4. Throttle hazard warning readout to 500ms
      if (timestamp - lastWarningUpdateRef.current > 500) {
        lastWarningUpdateRef.current = timestamp;
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
      }

      if (fraction >= 1) {
        setIsCompleted(true);
        if (callbacksRef.current.aiVoiceEnabled) {
          aiVoice?.speak(
            `Citizen has safely reached ${callbacksRef.current.committedRoute.shelterName || "designated safe shelter"}!`
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
              RACE // {profile.name} → {committedRoute.shelterName}
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
                  className={`px-1.5 py-0.5 rounded transition-all ${
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
              className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-[10px] font-mono font-bold text-rose-200 transition-colors"
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
              className="ml-2 px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-extrabold uppercase transition-all shrink-0"
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
