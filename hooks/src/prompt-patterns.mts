/**
 * Prompt signal matching engine for UserPromptSubmit hook.
 *
 * Scores user prompts against skill promptSignals frontmatter to determine
 * which skills to inject proactively before tool use.
 *
 * Scoring:
 *   - phrases:  +6 per phrase hit (exact substring, case-insensitive)
 *   - allOf:    +4 per conjunction group where ALL terms match
 *   - anyOf:    +1 per term hit, capped at +2
 *   - noneOf:   hard suppress (score → -Infinity, matched = false)
 *
 * Threshold: score >= minScore (default 6) with at least one phrase hit.
 */

import type { PromptSignals } from "./skill-map-frontmatter.mjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptMatchResult {
  matched: boolean;
  score: number;
  reason: string;
}

export interface CompiledPromptSignals {
  phrases: string[];
  allOf: string[][];
  anyOf: string[];
  noneOf: string[];
  minScore: number;
}

// ---------------------------------------------------------------------------
// normalizePromptText
// ---------------------------------------------------------------------------

/**
 * Normalize user prompt text for matching:
 * - lowercase
 * - collapse whitespace to single spaces
 * - trim
 */
export function normalizePromptText(text: string): string {
  if (typeof text !== "string") return "";
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// compilePromptSignals
// ---------------------------------------------------------------------------

/**
 * Compile a PromptSignals object into a form ready for matching.
 * Currently this is a pass-through that ensures defaults, but provides
 * an extension point for future pre-compilation (e.g., regex caching).
 */
export function compilePromptSignals(
  signals: PromptSignals,
): CompiledPromptSignals {
  return {
    phrases: (signals.phrases || []).map((p) => p.toLowerCase()),
    allOf: (signals.allOf || []).map((group) =>
      group.map((t) => t.toLowerCase()),
    ),
    anyOf: (signals.anyOf || []).map((t) => t.toLowerCase()),
    noneOf: (signals.noneOf || []).map((t) => t.toLowerCase()),
    minScore:
      typeof signals.minScore === "number" && !Number.isNaN(signals.minScore)
        ? signals.minScore
        : 6,
  };
}

// ---------------------------------------------------------------------------
// matchPromptWithReason
// ---------------------------------------------------------------------------

/**
 * Score a normalized prompt against compiled prompt signals.
 *
 * Returns { matched, score, reason } where:
 * - matched: true if score >= minScore AND at least one phrase hit
 * - score: weighted sum of signal matches
 * - reason: human-readable explanation of why/why not
 */
export function matchPromptWithReason(
  normalizedPrompt: string,
  compiled: CompiledPromptSignals,
): PromptMatchResult {
  if (!normalizedPrompt) {
    return { matched: false, score: 0, reason: "empty prompt" };
  }

  // --- noneOf: hard suppress ---
  for (const term of compiled.noneOf) {
    if (normalizedPrompt.includes(term)) {
      return {
        matched: false,
        score: -Infinity,
        reason: `suppressed by noneOf "${term}"`,
      };
    }
  }

  let score = 0;
  const reasons: string[] = [];
  let phraseHits = 0;

  // --- phrases: +6 each ---
  for (const phrase of compiled.phrases) {
    if (normalizedPrompt.includes(phrase)) {
      score += 6;
      phraseHits += 1;
      reasons.push(`phrase "${phrase}" +6`);
    }
  }

  // --- allOf: +4 per fully-matching group ---
  for (const group of compiled.allOf) {
    const allMatch = group.every((term) => normalizedPrompt.includes(term));
    if (allMatch) {
      score += 4;
      reasons.push(`allOf [${group.join(", ")}] +4`);
    }
  }

  // --- anyOf: +1 each, capped at +2 ---
  let anyOfScore = 0;
  for (const term of compiled.anyOf) {
    if (normalizedPrompt.includes(term)) {
      anyOfScore += 1;
      if (anyOfScore <= 2) {
        reasons.push(`anyOf "${term}" +1`);
      }
    }
  }
  const cappedAnyOf = Math.min(anyOfScore, 2);
  score += cappedAnyOf;

  // --- threshold check ---
  const meetsScore = score >= compiled.minScore;
  const hasPhraseHit = phraseHits > 0;
  const matched = meetsScore && hasPhraseHit;

  if (!matched) {
    const parts: string[] = [];
    if (!hasPhraseHit) parts.push("no phrase hit");
    if (!meetsScore) parts.push(`score ${score} < ${compiled.minScore}`);
    const detail = reasons.length > 0 ? ` (${reasons.join("; ")})` : "";
    return {
      matched: false,
      score,
      reason: `below threshold: ${parts.join(", ")}${detail}`,
    };
  }

  return {
    matched: true,
    score,
    reason: reasons.join("; "),
  };
}
