export const ANCHOR_LNGLAT: [number, number] = [79.152, 12.968]; // [lng, lat] SW corner, Katpadi, Vellore

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export const GEMINI_TIMEOUT_MS = 6000; // 6-second abort controller timeout

export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 20;

export const SIMULATION_MAX_MINUTES = 30;
export const FLOOD_RATE_CM_PER_MIN = 4;
