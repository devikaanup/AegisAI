"use client";

import React from "react";

interface NoSafeEvacuationOverlayProps {
  isVisible: boolean;
  reason: string;
  onDismiss?: () => void;
}

export function NoSafeEvacuationOverlay({
  isVisible,
  reason,
  onDismiss,
}: NoSafeEvacuationOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute top-14 left-0 right-0 z-45 bg-rose-950/95 border-y-2 border-rose-500 p-4 shadow-2xl backdrop-blur-md flex items-center justify-between px-8 text-white select-none transition-all">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-full bg-rose-600 border border-rose-400 flex items-center justify-center text-xl font-bold font-mono animate-pulse">
          ⚠
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono font-black text-lg tracking-wider text-rose-200">
              NO SAFE EVACUATION ROUTE
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-900 border border-rose-400 text-rose-200 text-xs font-mono font-bold">
              CRITICAL ALARM
            </span>
          </div>
          <p className="text-sm font-mono text-rose-100 mt-0.5">
            {reason}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="text-xs font-mono text-rose-300 text-right hidden md:block">
          <div>Drag timeline back or change profile</div>
          <div className="text-rose-400 font-semibold">Controls remain fully interactive</div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded bg-rose-800 hover:bg-rose-700 border border-rose-400 text-xs font-mono font-bold"
          >
            ACKNOWLEDGE
          </button>
        )}
      </div>
    </div>
  );
}
