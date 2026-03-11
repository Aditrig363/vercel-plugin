#!/usr/bin/env node
/**
 * SessionStart hook: initialize the seen-skills dedup state.
 *
 * On "clear" or "compact" events (Claude Code), wipes the claim dir and session
 * file so previously-injected skills can be re-injected into the fresh context.
 *
 * On "startup" or "resume", this is a no-op for Claude Code (claim dir starts
 * empty or retains valid state).
 *
 * Cursor always returns `{ env: { VERCEL_PLUGIN_SEEN_SKILLS: "" } }` on stdout.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatOutput,
  type HookPlatform,
} from "./compat.mjs";
import {
  dedupFilePath,
  removeSessionClaimDir,
} from "./hook-env.mjs";
import { unlinkSync } from "node:fs";

interface SessionStartSeenSkillsInput {
  session_id?: string;
  conversation_id?: string;
  cursor_version?: string;
  hook_event_name?: string;
  [key: string]: unknown;
}

/** Events where previously-injected skills are no longer in the context window. */
const CONTEXT_CLEARING_EVENTS = new Set(["clear", "compact"]);

export function parseSessionStartSeenSkillsInput(raw: string): SessionStartSeenSkillsInput | null {
  try {
    if (!raw.trim()) return null;
    return JSON.parse(raw) as SessionStartSeenSkillsInput;
  } catch {
    return null;
  }
}

export function detectSessionStartSeenSkillsPlatform(
  input: SessionStartSeenSkillsInput | null,
  _env: NodeJS.ProcessEnv = process.env,
): HookPlatform {
  if (input && ("conversation_id" in input || "cursor_version" in input)) {
    return "cursor";
  }

  return "claude-code";
}

export function formatSessionStartSeenSkillsCursorOutput(): string {
  return JSON.stringify(formatOutput("cursor", {
    env: {
      VERCEL_PLUGIN_SEEN_SKILLS: "",
    },
  }));
}

/**
 * On context-clearing events, wipe the file-based dedup state so skills can be
 * re-injected. Without this, the claim dir survives the clear and the injection
 * hooks treat every previously-seen skill as already present.
 */
export function resetDedupStateForSession(sessionId: string): void {
  removeSessionClaimDir(sessionId, "seen-skills");

  try {
    unlinkSync(dedupFilePath(sessionId, "seen-skills"));
  } catch {
    // File may not exist — that's fine.
  }
}

function main(): void {
  const input = parseSessionStartSeenSkillsInput(readFileSync(0, "utf8"));
  const platform = detectSessionStartSeenSkillsPlatform(input);

  if (platform === "cursor") {
    process.stdout.write(formatSessionStartSeenSkillsCursorOutput());
    return;
  }

  // Claude Code: reset dedup state on clear/compact so skills get re-injected.
  const hookEvent = input?.hook_event_name ?? "";
  const sessionId = input?.session_id ?? "";

  if (CONTEXT_CLEARING_EVENTS.has(hookEvent) && sessionId) {
    resetDedupStateForSession(sessionId);
  }
}

const SESSION_START_SEEN_SKILLS_ENTRYPOINT = fileURLToPath(import.meta.url);
const isSessionStartSeenSkillsEntrypoint = process.argv[1]
  ? resolve(process.argv[1]) === SESSION_START_SEEN_SKILLS_ENTRYPOINT
  : false;

if (isSessionStartSeenSkillsEntrypoint) {
  main();
}
