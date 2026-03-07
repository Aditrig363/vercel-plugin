function normalizePromptText(text) {
  if (typeof text !== "string") return "";
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function compilePromptSignals(signals) {
  return {
    phrases: (signals.phrases || []).map((p) => p.toLowerCase()),
    allOf: (signals.allOf || []).map(
      (group) => group.map((t) => t.toLowerCase())
    ),
    anyOf: (signals.anyOf || []).map((t) => t.toLowerCase()),
    noneOf: (signals.noneOf || []).map((t) => t.toLowerCase()),
    minScore: typeof signals.minScore === "number" && !Number.isNaN(signals.minScore) ? signals.minScore : 6
  };
}
function matchPromptWithReason(normalizedPrompt, compiled) {
  if (!normalizedPrompt) {
    return { matched: false, score: 0, reason: "empty prompt" };
  }
  for (const term of compiled.noneOf) {
    if (normalizedPrompt.includes(term)) {
      return {
        matched: false,
        score: -Infinity,
        reason: `suppressed by noneOf "${term}"`
      };
    }
  }
  let score = 0;
  const reasons = [];
  let phraseHits = 0;
  for (const phrase of compiled.phrases) {
    if (normalizedPrompt.includes(phrase)) {
      score += 6;
      phraseHits += 1;
      reasons.push(`phrase "${phrase}" +6`);
    }
  }
  for (const group of compiled.allOf) {
    const allMatch = group.every((term) => normalizedPrompt.includes(term));
    if (allMatch) {
      score += 4;
      reasons.push(`allOf [${group.join(", ")}] +4`);
    }
  }
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
  const meetsScore = score >= compiled.minScore;
  const hasPhraseHit = phraseHits > 0;
  const matched = meetsScore && hasPhraseHit;
  if (!matched) {
    const parts = [];
    if (!hasPhraseHit) parts.push("no phrase hit");
    if (!meetsScore) parts.push(`score ${score} < ${compiled.minScore}`);
    const detail = reasons.length > 0 ? ` (${reasons.join("; ")})` : "";
    return {
      matched: false,
      score,
      reason: `below threshold: ${parts.join(", ")}${detail}`
    };
  }
  return {
    matched: true,
    score,
    reason: reasons.join("; ")
  };
}
export {
  compilePromptSignals,
  matchPromptWithReason,
  normalizePromptText
};
