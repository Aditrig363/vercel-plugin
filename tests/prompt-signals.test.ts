import { describe, test, expect, beforeEach } from "bun:test";
import {
  normalizePromptText,
  compilePromptSignals,
  matchPromptWithReason,
} from "../hooks/prompt-patterns.mjs";
import type { CompiledPromptSignals } from "../hooks/prompt-patterns.mjs";

// ---------------------------------------------------------------------------
// normalizePromptText
// ---------------------------------------------------------------------------

describe("normalizePromptText", () => {
  test("lowercases and trims", () => {
    expect(normalizePromptText("  Hello World  ")).toBe("hello world");
  });

  test("collapses multiple whitespace to single space", () => {
    expect(normalizePromptText("a   b\t\tc\n\nd")).toBe("a b c d");
  });

  test("returns empty string for non-string input", () => {
    // @ts-expect-error - testing runtime behavior
    expect(normalizePromptText(undefined)).toBe("");
    // @ts-expect-error
    expect(normalizePromptText(null)).toBe("");
    // @ts-expect-error
    expect(normalizePromptText(42)).toBe("");
  });

  test("returns empty string for empty/whitespace-only input", () => {
    expect(normalizePromptText("")).toBe("");
    expect(normalizePromptText("   ")).toBe("");
    expect(normalizePromptText("\t\n")).toBe("");
  });

  test("preserves non-ASCII characters", () => {
    expect(normalizePromptText("Ünïcödé Têxt")).toBe("ünïcödé têxt");
  });
});

// ---------------------------------------------------------------------------
// compilePromptSignals
// ---------------------------------------------------------------------------

describe("compilePromptSignals", () => {
  test("lowercases all signal terms", () => {
    const compiled = compilePromptSignals({
      phrases: ["AI Elements", "AI SDK"],
      allOf: [["Markdown", "Streamed"]],
      anyOf: ["React", "Vue"],
      noneOf: ["README"],
      minScore: 6,
    });
    expect(compiled.phrases).toEqual(["ai elements", "ai sdk"]);
    expect(compiled.allOf).toEqual([["markdown", "streamed"]]);
    expect(compiled.anyOf).toEqual(["react", "vue"]);
    expect(compiled.noneOf).toEqual(["readme"]);
  });

  test("defaults missing arrays to empty", () => {
    const compiled = compilePromptSignals({} as any);
    expect(compiled.phrases).toEqual([]);
    expect(compiled.allOf).toEqual([]);
    expect(compiled.anyOf).toEqual([]);
    expect(compiled.noneOf).toEqual([]);
  });

  test("defaults minScore to 6 when missing or NaN", () => {
    expect(compilePromptSignals({} as any).minScore).toBe(6);
    expect(
      compilePromptSignals({ minScore: NaN } as any).minScore,
    ).toBe(6);
  });

  test("preserves explicit minScore", () => {
    expect(
      compilePromptSignals({ minScore: 10 } as any).minScore,
    ).toBe(10);
    expect(
      compilePromptSignals({ minScore: 0 } as any).minScore,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// matchPromptWithReason — phrase matching
// ---------------------------------------------------------------------------

describe("matchPromptWithReason — phrases", () => {
  const compiled: CompiledPromptSignals = {
    phrases: ["streaming markdown", "ai elements"],
    allOf: [],
    anyOf: [],
    noneOf: [],
    minScore: 6,
  };

  test("single phrase hit scores +6 and matches", () => {
    const result = matchPromptWithReason(
      "add ai elements to the chat component",
      compiled,
    );
    expect(result.matched).toBe(true);
    expect(result.score).toBe(6);
    expect(result.reason).toContain('phrase "ai elements" +6');
  });

  test("two phrase hits score +12", () => {
    const result = matchPromptWithReason(
      "use ai elements for streaming markdown in the chat",
      compiled,
    );
    expect(result.matched).toBe(true);
    expect(result.score).toBe(12);
  });

  test("no phrase hit means no match even with high anyOf", () => {
    const withAnyOf: CompiledPromptSignals = {
      ...compiled,
      anyOf: ["render", "component", "text", "chat", "ui", "display", "format"],
      minScore: 2,
    };
    const result = matchPromptWithReason(
      "render the component text in the chat ui display format",
      withAnyOf,
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("no phrase hit");
  });
});

// ---------------------------------------------------------------------------
// matchPromptWithReason — allOf conjunction scoring
// ---------------------------------------------------------------------------

describe("matchPromptWithReason — allOf", () => {
  const compiled: CompiledPromptSignals = {
    phrases: ["ai elements"],
    allOf: [
      ["markdown", "streamed", "text"],
      ["terminal", "markdown", "rendering"],
    ],
    anyOf: [],
    noneOf: [],
    minScore: 6,
  };

  test("+4 when all terms in a group match", () => {
    const result = matchPromptWithReason(
      "use ai elements for markdown streamed text output",
      compiled,
    );
    expect(result.matched).toBe(true);
    // phrase(6) + allOf group1(4) = 10
    expect(result.score).toBe(10);
    expect(result.reason).toContain("allOf");
  });

  test("no score when only partial group matches", () => {
    // group1 needs "markdown" + "streamed" + "text" — "streamed" absent here
    const result = matchPromptWithReason(
      "use ai elements with markdown and some plain content",
      compiled,
    );
    // phrase(6) only, no allOf bonus
    expect(result.score).toBe(6);
  });

  test("partial group does not score when a term is truly absent", () => {
    const result = matchPromptWithReason(
      "use ai elements with markdown output",
      compiled,
    );
    // phrase(6), group1 needs "streamed" and "text" — "text" absent, "streamed" absent
    // group2 needs "terminal" — absent
    expect(result.score).toBe(6);
  });

  test("both allOf groups can score independently", () => {
    const result = matchPromptWithReason(
      "use ai elements for markdown streamed text in terminal rendering",
      compiled,
    );
    // phrase(6) + group1(4) + group2(4) = 14
    expect(result.matched).toBe(true);
    expect(result.score).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// matchPromptWithReason — anyOf capping
// ---------------------------------------------------------------------------

describe("matchPromptWithReason — anyOf capping", () => {
  const compiled: CompiledPromptSignals = {
    phrases: ["ai elements"],
    allOf: [],
    anyOf: ["react", "component", "render", "display", "chat"],
    noneOf: [],
    minScore: 6,
  };

  test("anyOf +1 per hit, capped at +2 total", () => {
    const result = matchPromptWithReason(
      "ai elements react component render display chat",
      compiled,
    );
    // phrase(6) + anyOf capped at 2 = 8
    expect(result.score).toBe(8);
  });

  test("single anyOf hit gives +1", () => {
    const result = matchPromptWithReason(
      "use ai elements with react",
      compiled,
    );
    // phrase(6) + anyOf(1) = 7
    expect(result.score).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// matchPromptWithReason — noneOf suppression
// ---------------------------------------------------------------------------

describe("matchPromptWithReason — noneOf", () => {
  const compiled: CompiledPromptSignals = {
    phrases: ["ai elements"],
    allOf: [],
    anyOf: [],
    noneOf: ["readme", "markdown file"],
    minScore: 6,
  };

  test("noneOf term suppresses match entirely", () => {
    const result = matchPromptWithReason(
      "use ai elements to render the readme",
      compiled,
    );
    expect(result.matched).toBe(false);
    expect(result.score).toBe(-Infinity);
    expect(result.reason).toContain("suppressed by noneOf");
  });

  test("multi-word noneOf term matches as substring", () => {
    const result = matchPromptWithReason(
      "use ai elements instead of editing the markdown file",
      compiled,
    );
    expect(result.matched).toBe(false);
    expect(result.score).toBe(-Infinity);
  });

  test("no suppression when noneOf terms are absent", () => {
    const result = matchPromptWithReason(
      "use ai elements for streaming markdown in chat",
      compiled,
    );
    expect(result.matched).toBe(true);
    expect(result.score).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// matchPromptWithReason — threshold boundary cases
// ---------------------------------------------------------------------------

describe("matchPromptWithReason — threshold boundaries", () => {
  test("score exactly at minScore matches (with phrase hit)", () => {
    const compiled: CompiledPromptSignals = {
      phrases: ["ai elements"],
      allOf: [],
      anyOf: [],
      noneOf: [],
      minScore: 6,
    };
    const result = matchPromptWithReason(
      "use ai elements here",
      compiled,
    );
    expect(result.matched).toBe(true);
    expect(result.score).toBe(6);
  });

  test("score one below minScore does not match", () => {
    const compiled: CompiledPromptSignals = {
      phrases: ["ai elements"],
      allOf: [],
      anyOf: [],
      noneOf: [],
      minScore: 7,
    };
    const result = matchPromptWithReason(
      "use ai elements here",
      compiled,
    );
    expect(result.matched).toBe(false);
    expect(result.score).toBe(6);
    expect(result.reason).toContain("score 6 < 7");
  });

  test("high allOf score but no phrase hit still fails", () => {
    const compiled: CompiledPromptSignals = {
      phrases: ["nonexistent-term"],
      allOf: [["markdown", "render"], ["text", "chat"]],
      anyOf: [],
      noneOf: [],
      minScore: 4,
    };
    const result = matchPromptWithReason(
      "render markdown text in chat",
      compiled,
    );
    expect(result.matched).toBe(false);
    expect(result.score).toBe(8); // 2 allOf groups × 4
    expect(result.reason).toContain("no phrase hit");
  });

  test("empty prompt returns early with score 0", () => {
    const compiled: CompiledPromptSignals = {
      phrases: ["anything"],
      allOf: [],
      anyOf: [],
      noneOf: [],
      minScore: 6,
    };
    const result = matchPromptWithReason("", compiled);
    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toBe("empty prompt");
  });

  test("minScore of 0 still requires a phrase hit", () => {
    const compiled: CompiledPromptSignals = {
      phrases: ["xyzzy"],
      allOf: [],
      anyOf: ["foo"],
      noneOf: [],
      minScore: 0,
    };
    // anyOf alone can't match without a phrase hit
    const result = matchPromptWithReason("foo bar baz", compiled);
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("no phrase hit");
  });
});

// ---------------------------------------------------------------------------
// Real-world scenario: ai-elements noneOf suppression
// ---------------------------------------------------------------------------

describe("matchPromptWithReason — real-world ai-elements signals", () => {
  // These mirror the actual ai-elements SKILL.md promptSignals
  const aiElementsSignals: CompiledPromptSignals = compilePromptSignals({
    phrases: ["streaming markdown", "markdown formatting", "ai elements", "streaming ui", "chat components", "chat ui", "chat interface", "streaming response"],
    allOf: [["markdown", "stream"], ["markdown", "render"], ["chat", "ui"], ["chat", "interface"], ["stream", "response"], ["ai", "component"]],
    anyOf: ["terminal", "chat ui", "react-markdown", "useChat", "streamText"],
    noneOf: ["readme", "markdown file", "changelog"],
    minScore: 6,
  });

  test("'write a readme in markdown' does NOT match (noneOf suppression)", () => {
    const result = matchPromptWithReason(
      "write a readme in markdown",
      aiElementsSignals,
    );
    expect(result.matched).toBe(false);
    expect(result.score).toBe(-Infinity);
    expect(result.reason).toContain("suppressed by noneOf");
  });

  test("'add markdown formatting to the streamed text results' DOES match", () => {
    const result = matchPromptWithReason(
      "Also, let's add markdown formatting to the streamed text results",
      aiElementsSignals,
    );
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  test("'update the changelog with markdown' does NOT match (noneOf)", () => {
    const result = matchPromptWithReason(
      "update the changelog with markdown",
      aiElementsSignals,
    );
    expect(result.matched).toBe(false);
    expect(result.score).toBe(-Infinity);
  });

  test("'create a markdown file for docs' does NOT match (noneOf)", () => {
    const result = matchPromptWithReason(
      "create a markdown file for the project docs",
      aiElementsSignals,
    );
    expect(result.matched).toBe(false);
    expect(result.score).toBe(-Infinity);
  });

  test("'build a chat ui with streaming' matches via allOf [chat, ui] + phrase", () => {
    const result = matchPromptWithReason(
      "build a chat ui with streaming",
      aiElementsSignals,
    );
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  test("anyOf alone (e.g. 'terminal') does NOT meet threshold without phrase", () => {
    const result = matchPromptWithReason(
      "open a terminal and run the build command",
      aiElementsSignals,
    );
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("no phrase hit");
  });
});

// ---------------------------------------------------------------------------
// Import-pattern co-firing: ai-elements patterns cover AI SDK imports
// ---------------------------------------------------------------------------

describe("import-pattern co-firing — ai-elements covers AI SDK imports", () => {
  let importPatternToRegex: (pattern: string) => RegExp;
  let matchImportWithReason: any;

  const aiElementsImportPatterns = ["ai", "@ai-sdk/*", "@ai-sdk/react", "@/components/ai-elements/*"];
  const aiSdkImportPatterns = ["ai", "@ai-sdk/*"];

  beforeEach(async () => {
    const mod = await import("../hooks/patterns.mjs");
    importPatternToRegex = mod.importPatternToRegex;
    matchImportWithReason = mod.matchImportWithReason;
  });

  function compilePatterns(patterns: string[]) {
    return patterns.map((p: string) => ({ pattern: p, regex: importPatternToRegex(p) }));
  }

  test("import from 'ai' triggers both ai-sdk and ai-elements", () => {
    const content = `import { streamText } from 'ai';\n`;
    const aiElemResult = matchImportWithReason(content, compilePatterns(aiElementsImportPatterns));
    const aiSdkResult = matchImportWithReason(content, compilePatterns(aiSdkImportPatterns));
    expect(aiElemResult).not.toBeNull();
    expect(aiSdkResult).not.toBeNull();
  });

  test("import from '@ai-sdk/openai' triggers both ai-sdk and ai-elements", () => {
    const content = `import { openai } from '@ai-sdk/openai';\n`;
    const aiElemResult = matchImportWithReason(content, compilePatterns(aiElementsImportPatterns));
    const aiSdkResult = matchImportWithReason(content, compilePatterns(aiSdkImportPatterns));
    expect(aiElemResult).not.toBeNull();
    expect(aiSdkResult).not.toBeNull();
  });

  test("import from '@ai-sdk/react' triggers both ai-sdk and ai-elements", () => {
    const content = `import { useChat } from '@ai-sdk/react';\n`;
    const aiElemResult = matchImportWithReason(content, compilePatterns(aiElementsImportPatterns));
    const aiSdkResult = matchImportWithReason(content, compilePatterns(aiSdkImportPatterns));
    expect(aiElemResult).not.toBeNull();
    expect(aiSdkResult).not.toBeNull();
  });

  test("import from '@ai-sdk/anthropic' triggers both via wildcard", () => {
    const content = `import { anthropic } from '@ai-sdk/anthropic';\n`;
    const aiElemResult = matchImportWithReason(content, compilePatterns(aiElementsImportPatterns));
    const aiSdkResult = matchImportWithReason(content, compilePatterns(aiSdkImportPatterns));
    expect(aiElemResult).not.toBeNull();
    expect(aiSdkResult).not.toBeNull();
  });

  test("require('ai') also triggers both", () => {
    const content = `const { generateText } = require('ai');\n`;
    const aiElemResult = matchImportWithReason(content, compilePatterns(aiElementsImportPatterns));
    const aiSdkResult = matchImportWithReason(content, compilePatterns(aiSdkImportPatterns));
    expect(aiElemResult).not.toBeNull();
    expect(aiSdkResult).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Perf smoke: 40-skill fixture matching completes in <50ms
// ---------------------------------------------------------------------------

describe("perf smoke", () => {
  test("matching against 40-skill fixture completes in <50ms", () => {
    // Build 40 compiled skill signal sets
    const skills: CompiledPromptSignals[] = [];
    for (let i = 0; i < 40; i++) {
      skills.push({
        phrases: [`skill${i}`, `phrase${i}-a`, `phrase${i}-b`],
        allOf: [
          [`term${i}-a`, `term${i}-b`, `term${i}-c`],
          [`group${i}-x`, `group${i}-y`],
        ],
        anyOf: [`any${i}-1`, `any${i}-2`, `any${i}-3`],
        noneOf: [`block${i}`],
        minScore: 6,
      });
    }

    const prompt = normalizePromptText(
      "I want to use skill5 and add streaming markdown to the chat. " +
      "Also add phrase12-a and term20-a term20-b term20-c for good measure.",
    );

    const start = performance.now();
    for (const compiled of skills) {
      matchPromptWithReason(prompt, compiled);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
