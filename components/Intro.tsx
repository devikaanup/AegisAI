"use client";

import React from "react";
import CursorGrid from "./CursorGrid";

interface IntroProps {
  onStart: () => void;
}

export function Intro({ onStart }: IntroProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#070a12]/95 text-slate-100 backdrop-blur-md overflow-hidden">
      {/* Interactive Tactical Cursor Grid Background */}
      <div className="absolute inset-0 z-0">
        <CursorGrid
          cellSize={64}
          color="#38bdf8"
          radius={150}
          falloff="smooth"
          holdTime={400}
          fadeDuration={800}
          lineWidth={1.2}
          maxOpacity={0.85}
          fillOpacity={0.08}
          gridOpacity={0.07}
          cellRadius={3}
          clickPulse={true}
          pulseSpeed={650}
        />
      </div>

      {/* Hero Modal Content */}
      <div className="relative z-10 max-w-3xl w-full text-center flex flex-col items-center space-y-6 pointer-events-none">
        {/* Live status badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mission-Critical Evacuation Routing</span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white font-mono">
            SafePath AI
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl mx-auto">
            Inclusive evacuation routing for the people who cannot afford a standard route.
          </p>
        </div>

        {/* Core Thesis */}
        <blockquote className="p-4 border-l-2 border-emerald-500 bg-slate-900/70 rounded text-slate-300 text-base italic max-w-xl text-left backdrop-blur-sm">
          &ldquo;A route can be short but unsafe. The same street, the same flood, five different people, five different answers.&rdquo;
        </blockquote>

        <p className="text-sm text-slate-400 font-mono">
          One environment · Five accessibility profiles · Dynamic hazards · Capacity-aware shelters
        </p>

        {/* 3-item Why it Matters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left my-4">
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-sm">
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">01 / Blind Guidance</span>
            <p className="text-xs text-slate-300">
              Standard GPS apps assume 5 km/h walking, stairs, and high kerbs are universally passable.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-sm">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">02 / Dynamic Trap</span>
            <p className="text-xs text-slate-300">
              A 3-minute flood delay turns the shortest path into an impassable water barrier.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-sm">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">03 / Shelter Overflow</span>
            <p className="text-xs text-slate-300">
              As populations flee, shelters saturate. Routing must divert evacuees before they arrive.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onStart}
          className="pointer-events-auto px-8 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-base transition-all shadow-lg shadow-emerald-500/20 font-mono tracking-wide cursor-pointer"
        >
          START SIMULATION →
        </button>

        {/* Credits and Data statement */}
        <div className="pt-2 text-xs text-slate-500 space-y-1 font-mono">
          <div>Graph algorithms decide. AI explains.</div>
          <div className="text-slate-600">Simulation environment: seeded, fictionalized streets · Velachery–Pallikaranai, South Chennai</div>
        </div>
      </div>
    </div>
  );
}
