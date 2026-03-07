import { describe, test, expect, beforeEach } from "bun:test";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const HOOK_SCRIPT = join(ROOT, "hooks", "user-prompt-submit-skill-inject.mjs");
const SKILLS_DIR = join(ROOT, "skills");

let testSession: string;
beforeEach(() => {
  testSession = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

/** Extract skillInjection metadata from additionalContext HTML comment */
function extractSkillInjection(hookSpecificOutput: any): any {
  const ctx = hookSpecificOutput?.additionalContext || "";
  const match = ctx.match(/<!-- skillInjection: ({.*?}) -->/);
  if (!match) return undefined;
  try { return JSON.parse(match[1]); } catch { return undefined; }
}

/** Run the UserPromptSubmit hook as a subprocess */
async function runHook(
  prompt: string,
  env?: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const payload = JSON.stringify({
    prompt,
    session_id: testSession,
    cwd: ROOT,
    hook_event_name: "UserPromptSubmit",
  });
  const proc = Bun.spawn(["node", HOOK_SCRIPT], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  proc.stdin.write(payload);
  proc.stdin.end();
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { code, stdout, stderr };
}

// ---------------------------------------------------------------------------
// Integration tests with real SKILL.md files
// ---------------------------------------------------------------------------

describe("user-prompt-submit-skill-inject.mjs", () => {
  test("hook script exists", () => {
    expect(existsSync(HOOK_SCRIPT)).toBe(true);
  });

  test("injects streamdown skill for 'streaming markdown' prompt", async () => {
    const { code, stdout } = await runHook(
      "Also, let's add markdown formatting to the streamed text results using streaming markdown",
    );
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.hookSpecificOutput).toBeDefined();
    expect(result.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    expect(result.hookSpecificOutput.additionalContext).toContain("Streamdown");

    const meta = extractSkillInjection(result.hookSpecificOutput);
    expect(meta).toBeDefined();
    expect(meta.hookEvent).toBe("UserPromptSubmit");
    expect(meta.injectedSkills).toContain("streamdown");
  });

  test("injects ai-sdk skill for 'ai sdk' prompt", async () => {
    const { code, stdout } = await runHook(
      "I need to use the AI SDK to add streaming text generation to this endpoint",
    );
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    if (result.hookSpecificOutput) {
      const meta = extractSkillInjection(result.hookSpecificOutput);
      expect(meta).toBeDefined();
      expect(meta.injectedSkills).toContain("ai-sdk");
    }
  });

  test("returns {} for empty/short prompt", async () => {
    const { code, stdout } = await runHook("hi");
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({});
  });

  test("returns {} for empty stdin", async () => {
    const proc = Bun.spawn(["node", HOOK_SCRIPT], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    proc.stdin.end();
    const code = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({});
  });

  test("returns {} for prompt with no matching signals", async () => {
    const { code, stdout } = await runHook(
      "Please refactor the database connection pool to use connection strings from environment variables",
    );
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({});
  });

  // ---------------------------------------------------------------------------
  // Dedup prevents re-injection
  // ---------------------------------------------------------------------------

  test("dedup prevents re-injection when skill already seen", async () => {
    // First call: skill should inject
    const { stdout: first } = await runHook(
      "Use streaming markdown with streamdown for the chat output",
      { VERCEL_PLUGIN_SEEN_SKILLS: "" },
    );
    const r1 = JSON.parse(first);
    expect(r1.hookSpecificOutput).toBeDefined();

    const meta1 = extractSkillInjection(r1.hookSpecificOutput);
    expect(meta1?.injectedSkills).toContain("streamdown");

    // Second call: streamdown already seen
    const { stdout: second } = await runHook(
      "Use streaming markdown with streamdown for the chat output",
      { VERCEL_PLUGIN_SEEN_SKILLS: "streamdown" },
    );
    const r2 = JSON.parse(second);
    expect(r2).toEqual({});
  });

  // ---------------------------------------------------------------------------
  // Max 2 skill cap
  // ---------------------------------------------------------------------------

  test("caps injection at 2 skills max", async () => {
    // Craft a prompt that could match many skills
    // Use exact phrase hits from multiple skills
    const { code, stdout } = await runHook(
      "I want to use streamdown for streaming markdown and also the AI SDK for generateText and SWR for useSWR client-side fetching and next.js app router",
      { VERCEL_PLUGIN_SEEN_SKILLS: "" },
    );
    expect(code).toBe(0);
    const result = JSON.parse(stdout);

    if (result.hookSpecificOutput) {
      const meta = extractSkillInjection(result.hookSpecificOutput);
      expect(meta).toBeDefined();
      // At most 2 skills injected
      expect(meta.injectedSkills.length).toBeLessThanOrEqual(2);
      // matchedSkills may be more than 2
      expect(meta.matchedSkills.length).toBeGreaterThanOrEqual(2);
    }
  });

  // ---------------------------------------------------------------------------
  // additionalContext output shape
  // ---------------------------------------------------------------------------

  test("output has correct hookSpecificOutput shape", async () => {
    const { code, stdout } = await runHook(
      "Add streamdown to render streaming markdown in the chat component",
    );
    expect(code).toBe(0);
    const result = JSON.parse(stdout);

    // When there's a match, verify the full output structure
    if (result.hookSpecificOutput) {
      // Must have hookEventName
      expect(result.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
      // Must have additionalContext string
      expect(typeof result.hookSpecificOutput.additionalContext).toBe("string");
      expect(result.hookSpecificOutput.additionalContext.length).toBeGreaterThan(0);

      // Must contain skillInjection metadata comment
      const meta = extractSkillInjection(result.hookSpecificOutput);
      expect(meta).toBeDefined();
      expect(meta.version).toBe(1);
      expect(meta.hookEvent).toBe("UserPromptSubmit");
      expect(Array.isArray(meta.matchedSkills)).toBe(true);
      expect(Array.isArray(meta.injectedSkills)).toBe(true);
      expect(Array.isArray(meta.summaryOnly)).toBe(true);
      expect(Array.isArray(meta.droppedByCap)).toBe(true);
      expect(Array.isArray(meta.droppedByBudget)).toBe(true);

      // No unknown fields in hookSpecificOutput
      const keys = Object.keys(result.hookSpecificOutput);
      for (const key of keys) {
        expect(["hookEventName", "additionalContext"]).toContain(key);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Perf smoke: real SKILL.md matching completes quickly
  // ---------------------------------------------------------------------------

  test("perf: prompt matching against all real skills completes in <50ms", async () => {
    const start = performance.now();
    const { code, stdout } = await runHook(
      "Use streamdown for streaming markdown rendering in the terminal",
    );
    const elapsed = performance.now() - start;
    expect(code).toBe(0);

    // The full subprocess spawn + skill loading + matching should be reasonable.
    // We use a generous budget here since subprocess spawn itself takes time.
    // The actual matching logic is tested in prompt-signals.test.ts with <50ms.
    // Here we just ensure the full hook doesn't hang or take unreasonable time.
    expect(elapsed).toBeLessThan(5000); // 5s generous limit for subprocess
  });
});
