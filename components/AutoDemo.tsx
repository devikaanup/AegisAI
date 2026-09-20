"use client";

import React, { useEffect, useState } from "react";

export interface DemoStep {
  caption: string;
  action: () => void;
  durationMs: number;
}

interface AutoDemoProps {
  isActive: boolean;
  onStop: () => void;
  onSelectEvacuee: (id: string) => void;
  onSelectProfile: (id: string) => void;
  onChangeMinute: (min: number) => void;
  onChangePeopleEvacuating: (n: number) => void;
  onTriggerAsk: (question: string) => void;
  onStartRaceMode: () => void;
}

export function AutoDemo({
  isActive,
  onStop,
  onSelectEvacuee,
  onSelectProfile,
  onChangeMinute,
  onChangePeopleEvacuating,
  onTriggerAsk,
  onStartRaceMode,
}: AutoDemoProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentCaption, setCurrentCaption] = useState("");

  useEffect(() => {
    if (!isActive) {
      setCurrentStepIndex(0);
      setCurrentCaption("");
      return;
    }

    const steps: DemoStep[] = [
      {
        caption:
          "Step 1: Meet Marcus (Wheelchair User). Standard GPS suggests a 240m route straight into impassable Temple Steps.",
        action: () => {
          onSelectEvacuee("marcus");
          onSelectProfile("wheelchair");
          onChangeMinute(0);
          onChangePeopleEvacuating(10);
        },
        durationMs: 7000,
      },
      {
        caption:
          "Step 2: Safe Accessible Route chosen to Govt School (700m, +9.7 min slack). Asking engine: 'Why this route?'",
        action: () => {
          onTriggerAsk("Why this route?");
        },
        durationMs: 9000,
      },
      {
        caption:
          "Step 3: Advancing departure time to T+8m. Flash flood spreads across Market St; slack tightens to 1.7 min (TIGHT).",
        action: () => {
          onChangeMinute(8);
        },
        durationMs: 8000,
      },
      {
        caption:
          "Step 4: At T+10m, the flood cuts off the access corridor. Asking engine: 'What changed?'",
        action: () => {
          onChangeMinute(10);
          onTriggerAsk("What changed?");
        },
        durationMs: 9000,
      },
      {
        caption:
          "Step 5: Resetting departure to T+0m, then surging background evacuees to 50 people. Govt School saturates (50/50 FULL).",
        action: () => {
          onChangeMinute(0);
          onChangePeopleEvacuating(50);
        },
        durationMs: 9000,
      },
      {
        caption:
          "Step 6: Govt School is FULL! Engine automatically reroutes Marcus to Community Hall. Asking: 'Why did the shelter change?'",
        action: () => {
          onTriggerAsk("Why did the shelter change?");
        },
        durationMs: 9000,
      },
      {
        caption:
          "Step 7: Profile Switch! Switch Marcus to Pregnant profile. Now stairs are passable with slowdown — route updates to 240m!",
        action: () => {
          onSelectProfile("pregnant");
          onChangePeopleEvacuating(10);
        },
        durationMs: 8000,
      },
      {
        caption:
          "Step 8: Finale — Triggering Live Race Mode! Watch citizen evacuate alongside the real-time flood front.",
        action: () => {
          onSelectProfile("wheelchair");
          onChangeMinute(0);
          onStartRaceMode();
        },
        durationMs: 12000,
      },
    ];

    let timeoutId: NodeJS.Timeout;

    const executeStep = (idx: number) => {
      if (idx >= steps.length) {
        onStop();
        return;
      }
      setCurrentStepIndex(idx);
      setCurrentCaption(steps[idx].caption);
      steps[idx].action();

      timeoutId = setTimeout(() => {
        executeStep(idx + 1);
      }, steps[idx].durationMs);
    };

    executeStep(0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    isActive,
    onStop,
    onSelectEvacuee,
    onSelectProfile,
    onChangeMinute,
    onChangePeopleEvacuating,
    onTriggerAsk,
    onStartRaceMode,
  ]);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-full px-4 pointer-events-auto select-none">
      <div className="p-4 rounded-xl border border-amber-500/80 bg-slate-950/95 backdrop-blur-md shadow-2xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
              AUTONOMOUS STAGE DEMO (STEP {currentStepIndex + 1}/8)
            </span>
          </div>
          <button
            onClick={onStop}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
          >
            EXIT DEMO [ESC]
          </button>
        </div>

        <p className="text-sm font-mono text-slate-100 leading-relaxed font-semibold">
          {currentCaption}
        </p>
      </div>
    </div>
  );
}
