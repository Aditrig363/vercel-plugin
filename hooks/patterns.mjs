/**
 * Shared pattern utilities for converting glob patterns to RegExp.
 * Used by the PreToolUse hook and the validation script.
 */
import { readFileSync, appendFileSync } from "node:fs";

/**
 * Convert a simple glob pattern to a regex.
 * Supports *, **, and ? wildcards.
 * Double-star-slash requires slash boundaries — matches zero or more path segments.
 */
export function globToRegex(pattern) {
  if (typeof pattern !== "string") {
    throw new TypeError(`globToRegex: expected string, got ${typeof pattern}`);
  }
  if (pattern === "") {
    throw new Error("globToRegex: pattern must not be empty");
  }
  let re = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        // ** matches zero or more path segments with slash boundaries
        i += 2;
        if (pattern[i] === "/") {
          // **/ → zero or more complete path segments (each ending in /)
          re += "(?:[^/]+/)*";
          i++;
        } else {
          // trailing ** (no slash after) → match rest of path
          re += ".*";
        }
        continue;
      }
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else if (".()+[]{}|^$\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
    i++;
  }
  re += "$";
  return new RegExp(re);
}

/**
 * Parse newline-delimited seen-skill slugs into an ordered set.
 */
export function parseSeenSkillsFile(contents) {
  if (typeof contents !== "string") {
    throw new TypeError(`parseSeenSkillsFile: expected string, got ${typeof contents}`);
  }

  const seen = new Set();
  for (const line of contents.split(/\r?\n/)) {
    const skill = line.trim();
    if (skill !== "") {
      seen.add(skill);
    }
  }
  return seen;
}

/**
 * Read and parse seen-skill state from disk.
 */
export function readSeenSkillsFile(filePath) {
  const pathValue = typeof filePath === "string" ? filePath : "";
  if (pathValue.trim() === "") {
    return new Set();
  }

  try {
    const contents = readFileSync(pathValue, "utf8");
    return parseSeenSkillsFile(contents);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

/**
 * Append one seen-skill slug as newline-delimited plain text.
 */
export function appendSeenSkill(filePath, skill) {
  const pathValue = typeof filePath === "string" ? filePath : "";
  const skillValue = typeof skill === "string" ? skill : "";

  if (pathValue.trim() === "" || skillValue.trim() === "") {
    return;
  }

  appendFileSync(pathValue, `${skillValue}\n`, "utf8");
}
