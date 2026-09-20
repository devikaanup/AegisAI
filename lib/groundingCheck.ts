import { ExplanationContext } from "./explainContext";

/**
 * Extracts all numbers (integers and decimals) from text.
 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number);
}

/**
 * Recursively collects all numeric values from an object or array.
 */
export function collectContextNumbers(obj: any): Set<number> {
  const nums = new Set<number>();

  function walk(val: any) {
    if (typeof val === "number") {
      nums.add(val);
      nums.add(Math.round(val));
      nums.add(Number(val.toFixed(1)));
    } else if (typeof val === "string") {
      const parsed = extractNumbers(val);
      for (const p of parsed) {
        nums.add(p);
        nums.add(Math.round(p));
        nums.add(Number(p.toFixed(1)));
      }
    } else if (Array.isArray(val)) {
      for (const item of val) walk(item);
    } else if (val && typeof val === "object") {
      for (const key of Object.keys(val)) {
        walk(val[key]);
      }
    }
  }

  walk(obj);
  return nums;
}

/**
 * Verifies that every number mentioned in the generated text is grounded
 * in the provided structured context.
 * Numbers like 0 and 1 (or small ordinals) are common English words, so we can whitelist 0 and 1.
 */
export function isTextGrounded(text: string, context: ExplanationContext): boolean {
  const textNumbers = extractNumbers(text);
  if (textNumbers.length === 0) return true;

  const contextNumbers = collectContextNumbers(context);

  for (const num of textNumbers) {
    // 0 and 1 can occur naturally in grammar ("0 meters", "in 1 step")
    if (num === 0 || num === 1) continue;

    let match = false;
    // Check direct equality or near equality (rounding differences)
    for (const ctxNum of contextNumbers) {
      if (Math.abs(num - ctxNum) < 0.15) {
        match = true;
        break;
      }
    }

    if (!match) {
      return false;
    }
  }

  return true;
}
