import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildExplanationContext } from "@/lib/explainContext";
import { classifyIntent, composeFallbackExplanation } from "@/lib/fallbackExplanations";
import { explainSimulation, isGeminiKeyConfigured } from "@/lib/gemini";
import { isTextGrounded } from "@/lib/groundingCheck";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, GEMINI_MODEL } from "@/lib/config";

// In-memory rate limiting per IP
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

// Simple in-memory LRU cache for identical queries
interface CacheEntry {
  text: string;
  source: "gemini" | "verified";
  notice?: string;
  intent: string;
  timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 100;

const simulationInputSchema = z
  .object({
    evacueeId: z.string().min(1).max(50),
    profile: z.enum([
      "wheelchair",
      "mobility_limited",
      "pregnant",
      "stroller_newborn",
      "cognitive",
      "standard",
    ]),
    minute: z.number().min(0).max(30),
    peopleEvacuating: z.number().min(0).max(150),
  })
  .strict();

const explainRequestSchema = z
  .object({
    question: z.string().min(1).max(300),
    inputs: simulationInputSchema,
    previousInputs: simulationInputSchema.optional(),
  })
  .strict();

export async function GET() {
  return NextResponse.json({
    hasKey: isGeminiKeyConfigured(),
    model: GEMINI_MODEL,
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const parseResult = explainRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parseResult.error },
      { status: 400 }
    );
  }

  const { question, inputs, previousInputs } = parseResult.data;

  // Rate Limiting check
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const now = Date.now();
  let rateLimit = ipRequestCounts.get(ip);
  if (!rateLimit || now > rateLimit.resetTime) {
    rateLimit = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    ipRequestCounts.set(ip, rateLimit);
  } else {
    rateLimit.count++;
  }

  // 1. Deterministic Context Rebuild on Server (Never trust client facts)
  const engineInputs = {
    evacueeId: inputs.evacueeId,
    profileId: inputs.profile,
    simulationMinute: inputs.minute,
    peopleEvacuating: inputs.peopleEvacuating,
  };

  const prevEngineInputs = previousInputs
    ? {
        evacueeId: previousInputs.evacueeId,
        profileId: previousInputs.profile,
        simulationMinute: previousInputs.minute,
        peopleEvacuating: previousInputs.peopleEvacuating,
      }
    : null;

  const context = buildExplanationContext(engineInputs, prevEngineInputs);
  const intent = classifyIntent(question);
  const fallbackText = composeFallbackExplanation(intent, context);

  // Check LRU Cache
  const cacheKey = `${question.trim().toLowerCase()}_${inputs.evacueeId}_${inputs.profile}_${inputs.minute}_${inputs.peopleEvacuating}`;
  const cached = queryCache.get(cacheKey);
  if (cached && now - cached.timestamp < 30000) {
    return NextResponse.json(cached);
  }

  // Rate limit exceeded: return deterministic fallback with notice
  if (rateLimit.count > RATE_LIMIT_MAX_REQUESTS) {
    return NextResponse.json({
      text: fallbackText,
      source: "verified",
      notice: "Rate limit reached — showing verified system explanation.",
      intent,
    });
  }

  // No API key configured: return deterministic fallback directly (no notice needed)
  if (!isGeminiKeyConfigured()) {
    return NextResponse.json({
      text: fallbackText,
      source: "verified",
      intent,
    });
  }

  // Call Gemini
  const geminiResult = await explainSimulation(question, context);

  if (!geminiResult.text || geminiResult.error) {
    // Gemini failed, return deterministic fallback
    return NextResponse.json({
      text: fallbackText,
      source: "verified",
      notice: "AI explanation unavailable — showing verified system explanation.",
      intent,
    });
  }

  // Grounding Verification
  const grounded = isTextGrounded(geminiResult.text, context);
  if (!grounded) {
    return NextResponse.json({
      text: fallbackText,
      source: "verified",
      notice: "AI response failed grounding verification — showing verified system explanation.",
      intent,
    });
  }

  // Success
  const responseData: CacheEntry = {
    text: geminiResult.text,
    source: "gemini",
    intent,
    timestamp: now,
  };

  // Cache response
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey) queryCache.delete(firstKey);
  }
  queryCache.set(cacheKey, responseData);

  return NextResponse.json(responseData);
}
