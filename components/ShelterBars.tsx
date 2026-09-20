"use client";

import React from "react";
import { ShelterState } from "@/lib/shelterEngine";

interface ShelterBarsProps {
  shelters: Record<string, ShelterState>;
  selectedShelterId: string | null;
}

export function ShelterBars({ shelters, selectedShelterId }: ShelterBarsProps) {
  const shelterList = Object.values(shelters);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
        <span>Shelter Capacities</span>
        <span>Occ / Cap</span>
      </div>

      <div className="space-y-2.5">
        {shelterList.map((s) => {
          const pct = Math.min(100, Math.round((s.currentOccupancy / s.capacity) * 100));
          const isSelected = s.id === selectedShelterId;
          const isFull = s.currentOccupancy >= s.capacity;

          return (
            <div
              key={s.id}
              className={`p-2.5 rounded border transition-all ${
                isSelected
                  ? "bg-slate-800/80 border-cyan-500/50"
                  : "bg-slate-900/60 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSelected ? "bg-cyan-400" : isFull ? "bg-rose-500" : "bg-slate-500"
                    }`}
                  />
                  <span className={`font-semibold ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                    {s.name}
                  </span>
                  {isSelected && (
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 text-[10px] uppercase">
                      TARGET
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="tabular-nums font-mono text-slate-300">
                    {s.currentOccupancy}/{s.capacity}
                  </span>
                  {isFull && (
                    <span className="px-1.5 py-0.2 rounded bg-rose-950 border border-rose-500 text-rose-300 text-[10px] font-bold">
                      FULL
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isFull
                      ? "bg-rose-500"
                      : pct > 80
                      ? "bg-amber-400"
                      : isSelected
                      ? "bg-cyan-400"
                      : "bg-teal-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
