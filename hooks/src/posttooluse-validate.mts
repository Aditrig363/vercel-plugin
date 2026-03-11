#!/usr/bin/env node
/**
 * PostToolUse hook: validates files after Write/Edit operations against
 * skill-specific validation rules defined in SKILL.md frontmatter.
 *
 * Input: JSON on stdin with tool_name, tool_input, session_id, cwd
 * Output: JSON on stdout with { hookSpecificOutput: { additionalContext: "..." } } or {}
 *
 * Only fires for Write and Edit tool calls. Reads the written file,
 * matches it against skill import/path patterns, then runs validate:
 * regex rules from matched skills. Error-severity violations produce
 * additionalContext with fix instructions. Warn-severity only at debug level.
 *
 * Dedup: tracks validated file+hash pairs in VERCEL_PLUGIN_VALIDATED_FILES
 * env var to skip re-validation of unchanged files.
 *
 * Pipeline stages:
 *   parseInput → loadValidateRules → matchFileToSkills → runValidation → formatOutput
 */

import type { SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectPlatform, type HookPlatform } from "./compat.mjs";
import { pluginRoot as resolvePluginRoot, readSessionFile, safeReadFile, writeSessionFile } from "./hook-env.mjs";
import { buildSkillMap } from "./skill-map-frontmatter.mjs";
import type { SkillConfig, ValidationRule } from "./skill-map-frontmatter.mjs";
import {
  compileSkillPatterns,
  matchPathWithReason,
  matchImportWithReason,
  importPatternToRegex,
} from "./patterns.mjs";
import type { CompiledSkillEntry, CompiledPattern } from "./patterns.mjs";
import { createLogger, logCaughtError } from "./logger.mjs";
import type { Logger } from "./logger.mjs";

const PLUGIN_ROOT = resolvePluginRoot();
const SUPPORTED_TOOLS = ["Write", "Edit"];
const VALIDATED_FILES_ENV_KEY = "VERCEL_PLUGIN_VALIDATED_FILES";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedInput {
  toolName: string;
  filePath: string;
  sessionId: string | null;
  cwd: string;
  platform: HookPlatform;
}

function resolveSessionId(input: Record<string, unknown>): string | null {
  const sessionId = input.session_id ?? input.conversation_id;
  return typeof sessionId === "string" && sessionId.trim() !== "" ? sessionId : null;
}

function resolveHookCwd(input: Record<string, unknown>, env: NodeJS.ProcessEnv): string {
  const workspaceRoot = Array.isArray(input.workspace_roots) ? input.workspace_roots[0] : undefined;
  const candidate = input.cwd
    ?? workspaceRoot
    ?? env.CURSOR_PROJECT_DIR
    ?? env.CLAUDE_PROJECT_ROOT
    ?? process.cwd();

  return typeof candidate === "string" && candidate.trim() !== "" ? candidate : process.cwd();
}

function formatPlatformOutput(
  platform: HookPlatform,
  additionalContext?: string,
  env?: Record<string, string>,
): string {
  if (!additionalContext) {
    return "{}";
  }

  if (platform === "cursor") {
    const output: Record<string, unknown> = {
      additional_context: additionalContext,
    };
    if (env && Object.keys(env).length > 0) {
      output.env = env;
    }
    return JSON.stringify(output);
  }

  const output: SyncHookJSONOutput = {
    hookSpecificOutput: {
      hookEventName: "PostToolUse" as const,
      additionalContext,
    },
  };

  return JSON.stringify(output);
}

export interface SkillValidateRules {
  skill: string;
  rules: ValidationRule[];
}

export interface ValidationViolation {
  skill: string;
  line: number;
  message: string;
  severity: "error" | "recommended" | "warn";
  matchedText: string;
  upgradeToSkill?: string;
  upgradeWhy?: string;
  upgradeMode?: "hard" | "soft";
}

export interface ValidateResult {
  violations: ValidationViolation[];
  matchedSkills: string[];
  skippedDedup: boolean;
}

function escapeShellEnvValue(value: string): string {
  return value.replace(/(["\\$`])/g, "\\$1");
}

function persistValidatedFilesEnv(value: string, logger?: Logger): void {
  const l = logger || log;
  const envFile = process.env.CLAUDE_ENV_FILE;
  if (typeof envFile !== "string" || envFile.trim() === "") {
    return;
  }

  try {
    appendFileSync(
      envFile,
      `export ${VALIDATED_FILES_ENV_KEY}="${escapeShellEnvValue(value)}"\n`,
      "utf-8",
    );
  } catch (error) {
    logCaughtError(l, "posttooluse-validate-env-write-failed", error, {
      attempted: "append_validated_files_export",
      envFile,
      envKey: VALIDATED_FILES_ENV_KEY,
      state: "validation_completed",
    });
  }
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log: Logger = createLogger();

// ---------------------------------------------------------------------------
// Pipeline stage 1: parseInput
// ---------------------------------------------------------------------------

/**
 * Parse raw stdin JSON into a normalized input descriptor.
 * Returns null if input is irrelevant (wrong tool, no file path, etc.).
 */
export function parseInput(
  raw: string,
  logger?: Logger,
  env: NodeJS.ProcessEnv = process.env,
): ParsedInput | null {
  const l = logger || log;
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    l.debug("posttooluse-validate-skip", { reason: "stdin_empty" });
    return null;
  }

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(trimmed);
  } catch {
    l.debug("posttooluse-validate-skip", { reason: "stdin_parse_fail" });
    return null;
  }

  const toolName = (input.tool_name as string) || "";
  if (!SUPPORTED_TOOLS.includes(toolName)) {
    l.debug("posttooluse-validate-skip", { reason: "unsupported_tool", toolName });
    return null;
  }

  const toolInput = (input.tool_input as Record<string, unknown>) || {};
  const filePath = (toolInput.file_path as string) || "";
  if (!filePath) {
    l.debug("posttooluse-validate-skip", { reason: "no_file_path", toolName });
    return null;
  }

  const sessionId = resolveSessionId(input);
  const cwd = resolveHookCwd(input, env);
  const platform = detectPlatform(input);

  l.debug("posttooluse-validate-input", {
    toolName,
    filePath,
    sessionId: sessionId as string,
    cwd,
    platform,
  });
  return { toolName, filePath, sessionId, cwd, platform };
}

// ---------------------------------------------------------------------------
// Pipeline stage 2: loadValidateRules
// ---------------------------------------------------------------------------

export interface LoadedValidateData {
  skillMap: Record<string, SkillConfig>;
  compiledSkills: CompiledSkillEntry[];
  rulesMap: Map<string, ValidationRule[]>;
}

/**
 * Load skills that have validate: rules. Returns null if no rules exist.
 */
export function loadValidateRules(pluginRoot: string, logger?: Logger): LoadedValidateData | null {
  const l = logger || log;
  const skillsDir = join(pluginRoot, "skills");
  const { skills: skillMap } = buildSkillMap(skillsDir);

  // Filter to skills that have validate rules
  const rulesMap = new Map<string, ValidationRule[]>();
  for (const [slug, config] of Object.entries(skillMap)) {
    if (config.validate && config.validate.length > 0) {
      rulesMap.set(slug, config.validate);
    }
  }

  if (rulesMap.size === 0) {
    l.debug("posttooluse-validate-skip", { reason: "no_validate_rules" });
    return null;
  }

  const compiledSkills = compileSkillPatterns(skillMap);
  l.debug("posttooluse-validate-loaded", {
    totalSkills: Object.keys(skillMap).length,
    skillsWithRules: rulesMap.size,
  });

  return { skillMap, compiledSkills, rulesMap };
}

// ---------------------------------------------------------------------------
// Pipeline stage 3: matchFileToSkills
// ---------------------------------------------------------------------------

/**
 * Match a file path and its content against skill patterns to find
 * which skills' validate rules should apply.
 */
export function matchFileToSkills(
  filePath: string,
  fileContent: string,
  compiledSkills: CompiledSkillEntry[],
  rulesMap: Map<string, ValidationRule[]>,
  logger?: Logger,
): string[] {
  const l = logger || log;
  const matched: string[] = [];

  for (const entry of compiledSkills) {
    // Only check skills that have validate rules
    if (!rulesMap.has(entry.skill)) continue;

    // Match by path
    const pathMatch = matchPathWithReason(filePath, entry.compiledPaths);
    if (pathMatch) {
      matched.push(entry.skill);
      l.trace("posttooluse-validate-match", {
        skill: entry.skill,
        matchType: "path",
        pattern: pathMatch.pattern,
      });
      continue;
    }

    // Match by import patterns in file content
    const importMatch = matchImportWithReason(fileContent, entry.compiledImports);
    if (importMatch) {
      matched.push(entry.skill);
      l.trace("posttooluse-validate-match", {
        skill: entry.skill,
        matchType: "import",
        pattern: importMatch.pattern,
      });
    }
  }

  l.debug("posttooluse-validate-matched", { matchedSkills: matched });
  return matched;
}

// ---------------------------------------------------------------------------
// Pipeline stage 4: runValidation
// ---------------------------------------------------------------------------

/**
 * Run validation rules against file content. Returns violations found.
 */
export function runValidation(
  fileContent: string,
  matchedSkills: string[],
  rulesMap: Map<string, ValidationRule[]>,
  logger?: Logger,
): ValidationViolation[] {
  const l = logger || log;
  const violations: ValidationViolation[] = [];
  const lines = fileContent.split("\n");

  for (const skill of matchedSkills) {
    const rules = rulesMap.get(skill);
    if (!rules) continue;

    for (const rule of rules) {
      // Skip rule if file matches the skip condition
      if (rule.skipIfFileContains) {
        try {
          if (new RegExp(rule.skipIfFileContains, "m").test(fileContent)) {
            l.trace("posttooluse-validate-rule-skip", {
              skill,
              pattern: rule.pattern,
              reason: "skipIfFileContains matched",
            });
            continue;
          }
        } catch {
          // Invalid skip regex — proceed with rule anyway
        }
      }

      let regex: RegExp;
      try {
        regex = new RegExp(rule.pattern, "g");
      } catch {
        l.debug("posttooluse-validate-regex-fail", {
          skill,
          pattern: rule.pattern,
        });
        continue;
      }

      // Check each line for matches
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        const match = regex.exec(lines[i]);
        if (match) {
          violations.push({
            skill,
            line: i + 1,
            message: rule.message,
            severity: rule.severity,
            matchedText: match[0].slice(0, 80),
            upgradeToSkill: rule.upgradeToSkill,
            upgradeWhy: rule.upgradeWhy,
            upgradeMode: rule.upgradeMode ?? (rule.upgradeToSkill ? "soft" : undefined),
          });
        }
      }
    }
  }

  l.debug("posttooluse-validate-violations", {
    total: violations.length,
    errors: violations.filter((v) => v.severity === "error").length,
    recommended: violations.filter((v) => v.severity === "recommended").length,
    warns: violations.filter((v) => v.severity === "warn").length,
  });

  return violations;
}

// ---------------------------------------------------------------------------
// Dedup: file+hash tracking via env var
// ---------------------------------------------------------------------------

/**
 * Compute a fast content hash for dedup tracking.
 */
export function contentHash(content: string): string {
  return createHash("md5").update(content).digest("hex").slice(0, 12);
}

/**
 * Parse VERCEL_PLUGIN_VALIDATED_FILES env var into a Set of "path:hash" pairs.
 */
export function parseValidatedFiles(envValue: string | undefined): Set<string> {
  if (typeof envValue !== "string" || envValue.trim() === "") {
    return new Set();
  }
  const set = new Set<string>();
  for (const part of envValue.split(",")) {
    const trimmed = part.trim();
    if (trimmed !== "") set.add(trimmed);
  }
  return set;
}

/**
 * Append a validated file entry to the env var value.
 */
export function appendValidatedFile(envValue: string | undefined, entry: string): string {
  const current = typeof envValue === "string" ? envValue.trim() : "";
  return current === "" ? entry : `${current},${entry}`;
}

/**
 * Check if a file+hash has already been validated this session.
 */
export function isAlreadyValidated(filePath: string, hash: string, sessionId?: string | null): boolean {
  const entry = `${filePath}:${hash}`;
  const validated = parseValidatedFiles(process.env.VERCEL_PLUGIN_VALIDATED_FILES);
  if (validated.has(entry)) {
    return true;
  }

  if (!sessionId) {
    return false;
  }

  const persisted = parseValidatedFiles(readSessionFile(sessionId, "validated-files"));
  return persisted.has(entry);
}

/**
 * Mark a file+hash as validated in the env var.
 */
export function markValidated(
  filePath: string,
  hash: string,
  sessionId?: string | null,
  logger?: Logger,
): string {
  const entry = `${filePath}:${hash}`;
  const persistedState = sessionId ? readSessionFile(sessionId, "validated-files") : "";
  const current = process.env[VALIDATED_FILES_ENV_KEY] || persistedState;
  const next = appendValidatedFile(current, entry);
  process.env[VALIDATED_FILES_ENV_KEY] = next;
  if (sessionId) {
    writeSessionFile(sessionId, "validated-files", next);
  }
  persistValidatedFilesEnv(next, logger);
  return next;
}

// ---------------------------------------------------------------------------
// Pipeline stage 5: formatOutput
// ---------------------------------------------------------------------------

/**
 * Format validation violations into the hook output JSON.
 * Error-severity violations produce mandatory fix instructions.
 * Recommended-severity violations produce imperative best-practice instructions.
 * Warn-severity violations produce soft-fix suggestions at all log levels.
 */
export function formatOutput(
  violations: ValidationViolation[],
  matchedSkills: string[],
  filePath: string,
  logger?: Logger,
  platform: HookPlatform = "claude-code",
  env?: Record<string, string>,
): string {
  const l = logger || log;

  if (violations.length === 0) {
    l.debug("posttooluse-validate-no-output", { reason: "no_actionable_violations" });
    return "{}";
  }

  const errors = violations.filter((v) => v.severity === "error");
  const recommended = violations.filter((v) => v.severity === "recommended");
  const warns = violations.filter((v) => v.severity === "warn");
  const hasErrors = errors.length > 0;
  const hasRecommended = recommended.length > 0;
  const hasWarns = warns.length > 0;

  // Group by skill for clear output
  const bySkill = new Map<string, ValidationViolation[]>();
  for (const v of violations) {
    if (!bySkill.has(v.skill)) bySkill.set(v.skill, []);
    bySkill.get(v.skill)!.push(v);
  }

  const emittedUpgradeSkills = new Set<string>();

  const formatViolationLine = (
    violation: ValidationViolation,
    label: "ERROR" | "RECOMMENDED" | "SUGGESTION",
  ): string => {
    const lines = [`- Line ${violation.line} [${label}]: ${violation.message}`];
    if (violation.upgradeToSkill && !emittedUpgradeSkills.has(violation.upgradeToSkill)) {
      emittedUpgradeSkills.add(violation.upgradeToSkill);
      const reason = violation.upgradeWhy ? ` Reason: ${violation.upgradeWhy}` : "";
      const prefix = violation.upgradeMode === "hard" ? "REQUIRED: " : "";
      lines.push("");
      lines.push(`${prefix}Use the Skill tool now to load ${violation.upgradeToSkill}.${reason}`);
      lines.push(
        `<!-- skillUpgrade: ${JSON.stringify({
          from: violation.skill,
          to: violation.upgradeToSkill,
          line: violation.line,
        })} -->`,
      );
    }
    return lines.join("\n");
  };

  const parts: string[] = [];
  for (const [skill, skillViolations] of bySkill) {
    const errorLines = skillViolations
      .filter((v) => v.severity === "error")
      .map((v) => formatViolationLine(v, "ERROR"));
    const recommendedLines = skillViolations
      .filter((v) => v.severity === "recommended")
      .map((v) => formatViolationLine(v, "RECOMMENDED"));
    const warnLines = skillViolations
      .filter((v) => v.severity === "warn")
      .map((v) => formatViolationLine(v, "SUGGESTION"));
    parts.push([...errorLines, ...recommendedLines, ...warnLines].join("\n"));
  }

  const skillList = [...bySkill.keys()].join(", ");

  const counts = [
    hasErrors ? `${errors.length} error${errors.length > 1 ? "s" : ""}` : "",
    hasRecommended ? `${recommended.length} recommendation${recommended.length > 1 ? "s" : ""}` : "",
    hasWarns ? `${warns.length} suggestion${warns.length > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(", ");

  // Errors demand fixes; recommended gets imperative language; warn-only gets a softer call to action
  const callToAction = hasErrors
    ? `Please fix these issues before proceeding.`
    : hasRecommended
      ? `Apply these recommendations before continuing — they reflect current best practices.`
      : `Consider applying these suggestions to follow best practices.`;

  const context = [
    `<!-- posttooluse-validate: ${skillList} -->`,
    `VALIDATION (${counts}) for \`${filePath}\`:`,
    ...parts,
    callToAction,
    `<!-- /posttooluse-validate -->`,
  ].join("\n");

  const metadata = {
    version: 1,
    hook: "posttooluse-validate",
    filePath,
    matchedSkills,
    errorCount: errors.length,
    recommendedCount: recommended.length,
    warnCount: warns.length,
  };
  const metaComment = `<!-- postValidation: ${JSON.stringify(metadata)} -->`;

  l.summary("posttooluse-validate-output", {
    filePath,
    matchedSkills,
    errorCount: errors.length,
    recommendedCount: recommended.length,
    warnCount: warns.length,
  });

  return formatPlatformOutput(platform, context + "\n" + metaComment, env);
}

// ---------------------------------------------------------------------------
// Orchestrator: run()
// ---------------------------------------------------------------------------

export function run(): string {
  const timing: Record<string, number> = {};
  const tStart = log.active ? log.now() : 0;

  // Stage 1: parseInput
  let raw: string;
  try {
    raw = readFileSync(0, "utf-8");
  } catch {
    return "{}";
  }
  const parsed = parseInput(raw, log);
  if (!parsed) return "{}";
  if (log.active) timing.parse = Math.round(log.now() - tStart);

  const { toolName, filePath, sessionId, cwd, platform } = parsed;

  // Read file content from disk
  const resolvedPath = cwd ? resolve(cwd, filePath) : filePath;
  const fileContent = safeReadFile(resolvedPath);
  if (!fileContent) {
    log.debug("posttooluse-validate-skip", { reason: "file_unreadable", filePath: resolvedPath });
    return "{}";
  }

  // Dedup check: skip if same file+hash already validated
  const hash = contentHash(fileContent);
  if (isAlreadyValidated(filePath, hash, sessionId)) {
    log.debug("posttooluse-validate-skip", { reason: "already_validated", filePath, hash });
    return "{}";
  }

  // Stage 2: loadValidateRules
  const tLoad = log.active ? log.now() : 0;
  const data = loadValidateRules(PLUGIN_ROOT, log);
  if (!data) return "{}";
  if (log.active) timing.load = Math.round(log.now() - tLoad);

  const { compiledSkills, rulesMap } = data;

  // Stage 3: matchFileToSkills
  const tMatch = log.active ? log.now() : 0;
  const matchedSkills = matchFileToSkills(filePath, fileContent, compiledSkills, rulesMap, log);
  if (log.active) timing.match = Math.round(log.now() - tMatch);

  if (matchedSkills.length === 0) {
    log.debug("posttooluse-validate-skip", { reason: "no_skill_match", filePath });
    markValidated(filePath, hash, sessionId, log);
    return "{}";
  }

  // Stage 4: runValidation
  const tValidate = log.active ? log.now() : 0;
  const violations = runValidation(fileContent, matchedSkills, rulesMap, log);
  if (log.active) timing.validate = Math.round(log.now() - tValidate);

  // Mark as validated regardless of result (content hasn't changed)
  const validatedFiles = markValidated(filePath, hash, sessionId, log);

  // Stage 5: formatOutput
  const cursorEnv = platform === "cursor" && violations.length > 0
    ? { [VALIDATED_FILES_ENV_KEY]: validatedFiles }
    : undefined;
  const result = formatOutput(violations, matchedSkills, filePath, log, platform, cursorEnv);

  log.complete("posttooluse-validate-done", {
    matchedCount: matchedSkills.length,
    injectedCount: violations.filter((v) => v.severity === "error").length,
  }, timing);

  return result;
}

// ---------------------------------------------------------------------------
// Execute (only when run directly)
// ---------------------------------------------------------------------------

function isMainModule(): boolean {
  try {
    const scriptPath = realpathSync(resolve(process.argv[1] || ""));
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return scriptPath === modulePath;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  try {
    const output = run();
    process.stdout.write(output);
  } catch (err) {
    const entry = [
      `[${new Date().toISOString()}] CRASH in posttooluse-validate.mts`,
      `  error: ${(err as Error)?.message || String(err)}`,
      `  stack: ${(err as Error)?.stack || "(no stack)"}`,
      `  PLUGIN_ROOT: ${PLUGIN_ROOT}`,
      "",
    ].join("\n");
    process.stderr.write(entry);
    process.stdout.write("{}");
  }
}
