"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { SimulationInputs } from "@/lib/simulation";
import { ExplanationContext } from "@/lib/explainContext";
import { classifyIntent, composeFallbackExplanation } from "@/lib/fallbackExplanations";
import { aiVoice } from "@/lib/speech";

interface AskAegisProps {
  currentInputs: SimulationInputs;
  previousInputs: SimulationInputs | null;
  currentContext: ExplanationContext;
  externalQuery?: string | null;
  aiVoiceEnabled?: boolean;
}

interface AnswerState {
  question: string;
  text: string;
  source: "gemini" | "verified";
  notice?: string;
  intent: string;
  inputsSnapshot: SimulationInputs;
}

const CHIPS = [
  "Why this route?",
  "Why not the closest shelter?",
  "What changed?",
  "Will they reach safety?",
  "Why is this profile different?",
];

export function AskAegis({
  currentInputs,
  previousInputs,
  currentContext,
  externalQuery,
  aiVoiceEnabled = true,
}: AskAegisProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const prevInputsRef = useRef<SimulationInputs | null>(previousInputs);

  useEffect(() => {
    prevInputsRef.current = previousInputs;
  }, [previousInputs]);

  const handleAsk = useCallback(
    async (qText: string) => {
      if (!qText.trim()) return;
      const cleanQ = qText.trim();
      setIsLoading(true);

      // 1. Show instant deterministic fallback so user never waits with an empty box
      const intent = classifyIntent(cleanQ);
      const instantFallback = composeFallbackExplanation(intent, currentContext);

      setAnswer({
        question: cleanQ,
        text: instantFallback,
        source: "verified",
        intent,
        inputsSnapshot: { ...currentInputs },
      });

      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: cleanQ,
            inputs: {
              evacueeId: currentInputs.evacueeId,
              profile: currentInputs.profileId,
              minute: currentInputs.simulationMinute,
              peopleEvacuating: currentInputs.peopleEvacuating,
            },
            previousInputs: prevInputsRef.current
              ? {
                  evacueeId: prevInputsRef.current.evacueeId,
                  profile: prevInputsRef.current.profileId,
                  minute: prevInputsRef.current.simulationMinute,
                  peopleEvacuating: prevInputsRef.current.peopleEvacuating,
                }
              : undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            setAnswer({
              question: cleanQ,
              text: data.text,
              source: data.source || "verified",
              notice: data.notice,
              intent: data.intent || intent,
              inputsSnapshot: { ...currentInputs },
            });
          }
        }
      } catch {
        // Keep verified fallback already displayed
      } finally {
        setIsLoading(false);
        setQuestion("");
      }
    },
    [currentContext, currentInputs]
  );

  // Trigger from AutoDemo external question
  const lastProcessedExternalRef = useRef<string | null>(null);
  useEffect(() => {
    if (externalQuery && externalQuery !== lastProcessedExternalRef.current) {
      lastProcessedExternalRef.current = externalQuery;
      setIsExpanded(true);
      handleAsk(externalQuery);
    }
  }, [externalQuery, handleAsk]);

  const isStateOutdated =
    answer &&
    (answer.inputsSnapshot.simulationMinute !== currentInputs.simulationMinute ||
      answer.inputsSnapshot.profileId !== currentInputs.profileId ||
      answer.inputsSnapshot.evacueeId !== currentInputs.evacueeId ||
      answer.inputsSnapshot.peopleEvacuating !== currentInputs.peopleEvacuating);

  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0c121d] p-3 space-y-2.5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <h3 className="text-[11px] font-mono font-extrabold tracking-widest uppercase text-cyan-300">
              ASK AEGIS // INTEL EXPLAINER
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Explains the engine&apos;s decision. It never makes one.
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white font-mono text-xs p-1"
        >
          {isExpanded ? "▲" : "▼"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-2.5">
          {/* Suggestion Chips */}
          <div className="flex flex-wrap gap-1">
            {CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(chip)}
                className="px-2 py-0.5 rounded bg-[#141e2e] hover:bg-[#1b283d] border border-slate-700 text-[10px] text-slate-300 font-mono transition-all text-left"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Question Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(question);
            }}
            className="flex items-center space-x-1.5"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask route explanation..."
              maxLength={300}
              className="flex-1 bg-[#070a0f] border border-[#25354c] rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 active:scale-95 disabled:opacity-50 text-xs font-mono font-bold text-slate-950 transition-all tracking-wider"
            >
              {isLoading ? "..." : "QUERY"}
            </button>
          </form>

          {/* Answer Card */}
          {answer && (
            <div className="p-2.5 rounded-md bg-[#070a0f] border border-cyan-900/40 space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-slate-400 truncate max-w-[200px]">
                  &ldquo;{answer.question}&rdquo;
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded border ${
                    answer.source === "gemini"
                      ? "bg-cyan-950/60 border-cyan-500 text-cyan-300"
                      : "bg-emerald-950/60 border-emerald-500 text-emerald-300"
                  }`}
                >
                  {answer.source === "gemini"
                    ? "AI Grounded Analysis"
                    : "Verified System Analysis"}
                </span>
              </div>

              {answer.notice && (
                <div className="text-[10px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/40">
                  {answer.notice}
                </div>
              )}

              {isStateOutdated && (
                <div className="text-[10px] font-mono text-slate-400 italic">
                  * Note: This explanation was based on an earlier simulation state.
                </div>
              )}

              <p className="text-xs text-slate-200 leading-relaxed font-mono">
                {answer.text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
