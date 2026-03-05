/**
 * Standalone module that parses SKILL.md frontmatter to produce
 * the skill map shape used by the hook. This is the canonical source of truth.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

/**
 * Extract YAML frontmatter and body from a markdown string.
 * Frontmatter must be delimited by --- on its own line at the very start.
 * @param {string} markdown
 * @returns {{ yaml: string, body: string }}
 */
export function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    return { yaml: "", body: markdown };
  }
  return { yaml: match[1], body: match[2] };
}

/**
 * Parse a YAML frontmatter string into a structured skill object.
 * Uses js-yaml with the DEFAULT_SCHEMA to avoid interpreting
 * backslash sequences in single-quoted strings.
 * @param {string} yamlStr
 * @returns {{ name: string, description: string, metadata: { priority?: number, filePattern?: string[], bashPattern?: string[] } }}
 */
export function parseSkillFrontmatter(yamlStr) {
  if (!yamlStr || !yamlStr.trim()) {
    return { name: "", description: "", metadata: {} };
  }
  const doc = yaml.load(yamlStr, { schema: yaml.DEFAULT_SCHEMA });
  return {
    name: doc?.name ?? "",
    description: doc?.description ?? "",
    metadata: doc?.metadata ?? {},
  };
}

/**
 * Scan a skills root directory and return parsed skill objects alongside
 * structured diagnostics for any files that failed to parse.
 * Expects structure: rootDir/<skill-name>/SKILL.md
 * @param {string} rootDir  Path to the skills/ directory
 * @returns {{ skills: Array<{ dir: string, name: string, description: string, metadata: object }>, diagnostics: Array<{ file: string, error: string, message: string }> }}
 */
export function scanSkillsDir(rootDir) {
  const skills = [];
  const diagnostics = [];
  let entries;
  try {
    entries = readdirSync(rootDir);
  } catch {
    return { skills, diagnostics };
  }

  for (const entry of entries) {
    const skillDir = join(rootDir, entry);
    try {
      if (!statSync(skillDir).isDirectory()) continue;
    } catch {
      continue;
    }

    const skillFile = join(skillDir, "SKILL.md");
    let content;
    try {
      content = readFileSync(skillFile, "utf-8");
    } catch {
      continue; // no SKILL.md in this directory
    }

    let parsed;
    try {
      const { yaml: yamlStr } = extractFrontmatter(content);
      parsed = parseSkillFrontmatter(yamlStr);
    } catch (err) {
      diagnostics.push({
        file: skillFile,
        error: err.constructor?.name ?? "Error",
        message: err.message,
      });
      continue;
    }

    skills.push({
      dir: entry,
      name: parsed.name || entry,
      description: parsed.description,
      metadata: parsed.metadata,
    });
  }

  return { skills, diagnostics };
}

/**
 * Build a skill map object from SKILL.md frontmatter
 * by scanning SKILL.md frontmatter in the given skills directory.
 *
 * Output shape:
 * {
 *   "$schema": "...",
 *   "skills": {
 *     "<name>": {
 *       "priority": <number>,
 *       "pathPatterns": [...],
 *       "bashPatterns": [...]
 *     }
 *   }
 * }
 *
 * @param {string} rootDir  Path to the skills/ directory
 * @returns {object}
 */
export function buildSkillMap(rootDir) {
  const skills = {};
  const warnings = [];
  const { skills: parsed, diagnostics } = scanSkillsDir(rootDir);

  for (const skill of parsed) {
    const meta = skill.metadata || {};

    // Coerce filePattern: bare string → single-element array
    let pathPatterns = meta.filePattern ?? [];
    if (typeof pathPatterns === "string") {
      warnings.push(`skill "${skill.name}": metadata.filePattern is a string, coercing to array`);
      pathPatterns = [pathPatterns];
    } else if (!Array.isArray(pathPatterns)) {
      warnings.push(`skill "${skill.name}": metadata.filePattern is not an array (${typeof pathPatterns}), defaulting to []`);
      pathPatterns = [];
    }

    // Coerce bashPattern: bare string → single-element array
    let bashPatterns = meta.bashPattern ?? [];
    if (typeof bashPatterns === "string") {
      warnings.push(`skill "${skill.name}": metadata.bashPattern is a string, coercing to array`);
      bashPatterns = [bashPatterns];
    } else if (!Array.isArray(bashPatterns)) {
      warnings.push(`skill "${skill.name}": metadata.bashPattern is not an array (${typeof bashPatterns}), defaulting to []`);
      bashPatterns = [];
    }

    skills[skill.name] = {
      priority: meta.priority ?? 5,
      pathPatterns,
      bashPatterns,
    };
  }

  return {
    $schema:
      "Maps Vercel plugin skills to file-path globs and bash-command regexes for PreToolUse hook injection.",
    skills,
    diagnostics,
    warnings,
  };
}
