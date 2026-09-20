"use client";

import React from "react";
import { getAllEvacuees } from "@/lib/simulation";
import { getAllProfiles, ProfileDefinition } from "@/lib/costFunctions";

interface ControlPanelProps {
  selectedEvacueeId: string;
  onSelectEvacuee: (id: string) => void;
  selectedProfileId: string;
  onSelectProfile: (id: string) => void;
  currentProfile: ProfileDefinition;
  peopleEvacuating: number;
  onChangePeopleEvacuating: (count: number) => void;
  unassignedCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ControlPanel({
  selectedEvacueeId,
  onSelectEvacuee,
  selectedProfileId,
  onSelectProfile,
  currentProfile,
  peopleEvacuating,
  onChangePeopleEvacuating,
  unassignedCount,
  isCollapsed,
  onToggleCollapse,
}: ControlPanelProps) {
  const evacuees = getAllEvacuees();
  const profiles = getAllProfiles().filter((p) => p.id !== "standard");

  if (isCollapsed) {
    return (
      <div className="w-11 border-r border-[#1e293b] bg-[#0c121d] flex flex-col items-center py-4 z-30 select-none">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded bg-[#162233] hover:bg-[#1e2d42] border border-[#25354c] text-slate-300 hover:text-white font-mono text-xs"
          title="Expand Mission Setup"
        >
          ▶
        </button>
        <span className="[writing-mode:vertical-lr] text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-6">
          MISSION SETUP //
        </span>
      </div>
    );
  }

  return (
    <aside className="w-[250px] flex-shrink-0 border-r border-[#1e293b] bg-[#0c121d] flex flex-col h-full z-30 overflow-y-auto select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <h2 className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-slate-200">
            MISSION SETUP
          </h2>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded bg-[#162233] hover:bg-[#1e2d42] border border-[#25354c] text-slate-400 hover:text-white font-mono text-xs"
          title="Collapse Sidebar"
        >
          ◀
        </button>
      </div>

      <div className="p-2.5 space-y-3">
        {/* 1. Evacuee Persona */}
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">
            Focus Citizen (Evacuee)
          </label>
          <select
            value={selectedEvacueeId}
            onChange={(e) => onSelectEvacuee(e.target.value)}
            className="w-full bg-[#070a0f] border border-[#25354c] text-slate-100 text-xs rounded-md px-2 py-1.5 font-mono focus:border-cyan-500 focus:outline-none"
          >
            {evacuees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.startJunction}, {e.profile})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Profile Dropdown (Independent) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Accessibility Profile
            </label>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {currentProfile.speed} m/s
            </span>
          </div>
          <select
            value={selectedProfileId}
            onChange={(e) => onSelectProfile(e.target.value)}
            className="w-full bg-[#070a0f] border border-[#25354c] text-slate-100 text-xs rounded-md px-2.5 py-2 font-mono focus:border-cyan-500 focus:outline-none"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Profile Needs & Constraints Checklist */}
        <div className="p-2.5 rounded-lg bg-[#070a0f]/80 border border-[#1e293b] space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
            Profile Constraints
          </span>
          <div className="space-y-1">
            {currentProfile.needs.map((need, idx) => (
              <div key={idx} className="flex items-center space-x-1.5 text-[11px] text-slate-300 font-mono">
                <span className="text-emerald-400">✓</span>
                <span>{need}</span>
              </div>
            ))}
          </div>

          {currentProfile.hardConstraints.length > 0 && (
            <div className="pt-2 border-t border-[#1e293b]">
              <span className="text-[9px] font-mono uppercase tracking-wider text-rose-400 block mb-1 font-bold">
                Impassable Barriers:
              </span>
              <div className="flex flex-wrap gap-1">
                {currentProfile.hardConstraints.map((c, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-800 text-[9px] font-mono text-rose-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Hazard Condition (Locked) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span>Dynamic Hazard</span>
            <span className="text-cyan-400 font-bold">4 cm / min</span>
          </div>
          <div className="p-2 rounded-md bg-[#070a0f]/80 border border-[#1e293b] flex items-center justify-between text-xs font-mono">
            <span className="text-slate-200">🌊 Flash Flood Front</span>
            <span className="text-slate-400 text-[10px]">Palar Riverbed</span>
          </div>
        </div>

        {/* 4. Population Evacuation Slider */}
        <div className="space-y-2 pt-2 border-t border-[#1e293b]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">
              Background Evacuees
            </span>
            <span className="text-sm font-extrabold text-amber-400 tabular-nums">
              {peopleEvacuating}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="150"
            step="5"
            value={peopleEvacuating}
            onChange={(e) => onChangePeopleEvacuating(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 bg-[#162233] cursor-pointer h-1.5 rounded-lg"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>0</span>
            <span>50 (S1 Full)</span>
            <span>100</span>
            <span>150</span>
          </div>

          {unassignedCount > 0 && (
            <div className="p-2 rounded bg-rose-950/40 border border-rose-500/50 text-rose-300 text-[11px] font-mono flex items-center space-x-1.5">
              <span>⚠</span>
              <span>{unassignedCount} evacuees have no safe shelter!</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
