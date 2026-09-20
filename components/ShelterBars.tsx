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
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
        <span>SHELTER CAPACITY GAUGE</span>
        <span>OCC / CAP</span>
      </div>

      <div className="space-y-2">
        {shelterList.map((s) => {
          const pct = Math.min(100, Math.round((s.currentOccupancy / s.capacity) * 100));
          const isSelected = s.id === selectedShelterId;
          const isFull = s.currentOccupancy >= s.capacity;

          return (
            <div
              key={s.id}
              className={`p-2.5 rounded-lg border transition-all ${
                isSelected
                  ? "bg-cyan-950/40 border-cyan-500/60 shadow-sm shadow-cyan-900/30"
                  : isFull
                  ? "bg-rose-950/30 border-rose-900/50"
                  : "bg-[#070a0f]/80 border-[#1e293b]"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSelected ? "bg-cyan-400 animate-pulse" : isFull ? "bg-rose-500" : "bg-slate-500"
                    }`}
                  />
                  <span className={`font-bold ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                    {s.name}
                  </span>
                  {isSelected && (
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold uppercase tracking-wider">
                      ASSIGNED
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="tabular-nums font-mono text-xs text-slate-300 font-bold">
                    {s.currentOccupancy}/{s.capacity}
                  </span>
                  {isFull && (
                    <span className="px-1.5 py-0.2 rounded bg-rose-950 border border-rose-500 text-rose-300 text-[9px] font-extrabold tracking-wider">
                      FULL
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-[#162233] overflow-hidden border border-[#25354c]/60">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
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
