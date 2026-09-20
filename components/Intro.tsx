"use client";

import React, { useEffect, useRef } from "react";

interface IntroProps {
  onStart: () => void;
}

export function Intro({ onStart }: IntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      step += 0.02;
      ctx.fillStyle = "#0a0d12";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle tactical grid
      ctx.strokeStyle = "#141c28";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Animated flood waves in lower third
      const baseHeight = canvas.height * 0.72;
      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let x = 0; x <= canvas.width; x += 20) {
          const y =
            baseHeight +
            w * 25 +
            Math.sin(step + x * 0.005 + w) * 15 +
            Math.cos(step * 0.8 + x * 0.003) * 8;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        const alpha = 0.15 - w * 0.04;
        ctx.fillStyle = `rgba(30, 58, 138, ${alpha})`;
        ctx.fill();

        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#0a0d12]/95 text-slate-100 backdrop-blur-sm">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="relative z-10 max-w-3xl w-full text-center flex flex-col items-center space-y-6">
        {/* Live status badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mission-Critical Evacuation Routing</span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white font-mono">
            AEGIS AI
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl mx-auto">
            Inclusive evacuation routing for the people who cannot afford a standard route.
          </p>
        </div>

        {/* Core Thesis */}
        <blockquote className="p-4 border-l-2 border-emerald-500 bg-slate-900/60 rounded text-slate-300 text-base italic max-w-xl text-left">
          &ldquo;A route can be short but unsafe. The same street, the same flood, five different people, five different answers.&rdquo;
        </blockquote>

        <p className="text-sm text-slate-400 font-mono">
          One environment · Five accessibility profiles · Dynamic hazards · Capacity-aware shelters
        </p>

        {/* 3-item Why it Matters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left my-4">
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">01 / Blind Guidance</span>
            <p className="text-xs text-slate-300">
              Standard GPS apps assume 5 km/h walking, stairs, and high kerbs are universally passable.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">02 / Dynamic Trap</span>
            <p className="text-xs text-slate-300">
              A 3-minute flood delay turns the shortest path into an impassable water barrier.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">03 / Shelter Overflow</span>
            <p className="text-xs text-slate-300">
              As populations flee, shelters saturate. Routing must divert evacuees before they arrive.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onStart}
          className="px-8 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-base transition-all shadow-lg shadow-emerald-500/20 font-mono tracking-wide"
        >
          START SIMULATION →
        </button>

        {/* Credits and Data statement */}
        <div className="pt-2 text-xs text-slate-500 space-y-1 font-mono">
          <div>Graph algorithms decide. AI explains.</div>
          <div className="text-slate-600">Demo dataset: seeded, fictionalized streets · Katpadi, Vellore</div>
        </div>
      </div>
    </div>
  );
}
