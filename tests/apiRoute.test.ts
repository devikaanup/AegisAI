import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only so Vitest unit runner can import the route
vi.mock("server-only", () => ({}));

import { POST, GET } from "@/app/api/explain/route";
import { NextRequest } from "next/server";

describe("Explanation API Route (/app/api/explain/route.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const validPayload = {
    question: "Why this route?",
    inputs: {
      evacueeId: "marcus",
      profile: "wheelchair",
      minute: 0,
      peopleEvacuating: 10,
    },
  };

  it("GET returns status with hasKey and model name without exposing key", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.hasKey).toBe(false);
    expect(data.model).toBeDefined();
    expect(data.key).toBeUndefined();
  });

  it("returns 400 for malformed request body", async () => {
    const req = new NextRequest("http://localhost/api/explain", {
      method: "POST",
      body: JSON.stringify({ invalidField: "bad" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with source 'verified' when GEMINI_API_KEY is unset", async () => {
    delete process.env.GEMINI_API_KEY;

    const req = new NextRequest("http://localhost/api/explain", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("verified");
    expect(data.text).toBeDefined();
    expect(data.text.length).toBeGreaterThan(15);
  });

  it("returns 200 with source 'verified' on mocked network failure", async () => {
    process.env.GEMINI_API_KEY = "test_key";
    global.fetch = vi.fn().mockRejectedValue(new Error("Network connection failed"));

    const req = new NextRequest("http://localhost/api/explain", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("verified");
    expect(data.notice).toContain("AI explanation unavailable");
  });

  it("returns 200 with source 'verified' on mocked timeout", async () => {
    process.env.GEMINI_API_KEY = "test_key";
    const abortErr = new Error("Aborted");
    abortErr.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValue(abortErr);

    const req = new NextRequest("http://localhost/api/explain", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("verified");
  });

  it("returns 200 with source 'verified' on mocked Gemini 429 rate limit", async () => {
    process.env.GEMINI_API_KEY = "test_key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({ error: { message: "Quota exceeded" } }),
    });

    const req = new NextRequest("http://localhost/api/explain", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("verified");
  });

  it("returns 200 with source 'verified' when Gemini returns ungrounded numbers", async () => {
    process.env.GEMINI_API_KEY = "test_key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Marcus must travel 88888m which will take 999.9 min." }],
            },
          },
        ],
      }),
    });

    const req = new NextRequest("http://localhost/api/explain", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("verified");
    expect(data.notice).toContain("failed grounding verification");
  });

  it("returns 200 with source 'gemini' when response is valid and grounded", async () => {
    process.env.GEMINI_API_KEY = "test_key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Marcus is routed 700m to Govt School with an arrival time of 9.7 min. The standard path fails due to Temple Steps.",
                },
              ],
            },
          },
        ],
      }),
    });

    const req = new NextRequest("http://localhost/api/explain", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("gemini");
    expect(data.text).toContain("Govt School");
  });
});
