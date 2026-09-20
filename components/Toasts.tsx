"use client";

import React from "react";
import { SimulationEvent } from "@/lib/simulation";

export interface ToastItem {
  id: string;
  type: string;
  text: string;
  source: "verified" | "gemini";
  timestamp: number;
}

interface ToastsProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col space-y-2 max-w-md w-full pointer-events-none select-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3.5 rounded-lg border shadow-xl backdrop-blur-md flex items-start justify-between space-x-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === "NO_SAFE_ROUTE" || toast.type === "ROUTE_BLOCKED"
              ? "bg-rose-950/90 border-rose-500 text-rose-100"
              : toast.type === "SHELTER_FULL"
              ? "bg-amber-950/90 border-amber-500 text-amber-100"
              : "bg-slate-900/90 border-emerald-500/70 text-slate-100"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                {toast.type.replace(/_/g, " ")}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                  toast.source === "gemini"
                    ? "bg-purple-900/60 border-purple-400 text-purple-200"
                    : "bg-slate-800 border-slate-700 text-slate-300"
                }`}
              >
                {toast.source === "gemini" ? "AI Narration" : "Verified Event"}
              </span>
            </div>
            <p className="text-xs font-mono leading-relaxed">{toast.text}</p>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-white font-mono text-xs p-1"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
