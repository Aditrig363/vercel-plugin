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
  // Strip BOM (U+FEFF) if present
  if (markdown.charCodeAt(0) === 0xFEFF) {
    markdown = markdown.slice(1);
  }
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
    metadata: (doc?.metadata != null && typeof doc.metadata === "object" && !Array.isArray(doc.metadata)) ? doc.metadata : {},
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
 * Build a skill map from SKILL.md frontmatter in the given skills directory.
 *
 * Output shape:
 * {
 *   "skills": {
 *     "<dir-name>": {
 *       "priority": <number>,    // defaults to 5
 *       "pathPatterns": [...],
 *       "bashPatterns": [...]
 *     }
 *   },
 *   "diagnostics": [...],
 *   "warnings": [...]
 * }
 *
 * @param {string} rootDir  Path to the skills/ directory
 * @returns {object}
 */
export function buildSkillMap(rootDir) {
  const skills = {};
  const warnings = [];
  const warningDetails = [];
  const { skills: parsed, diagnostics } = scanSkillsDir(rootDir);

  /**
   * Push a warning string (backwards compat) and a structured detail object.
   * @param {string} msg  Human-readable warning string
   * @param {{ code: string, skill: string, field: string, valueType: string, hint: string }} detail
   */
  function addWarning(msg, detail) {
    warnings.push(msg);
    warningDetails.push({ ...detail, message: msg });
  }

  for (const skill of parsed) {
    const meta = skill.metadata || {};

    // Coerce filePattern: bare string → single-element array
    let pathPatterns = meta.filePattern ?? [];
    if (typeof pathPatterns === "string") {
      addWarning(
        `skill "${skill.dir}": metadata.filePattern is a string, coercing to array`,
        { code: "COERCE_STRING_TO_ARRAY", skill: skill.dir, field: "filePattern", valueType: "string", hint: "Change metadata.filePattern to a YAML list" },
      );
      pathPatterns = [pathPatterns];
    } else if (!Array.isArray(pathPatterns)) {
      addWarning(
        `skill "${skill.dir}": metadata.filePattern is not an array (${typeof pathPatterns}), defaulting to []`,
        { code: "INVALID_TYPE", skill: skill.dir, field: "filePattern", valueType: typeof pathPatterns, hint: "metadata.filePattern must be an array of glob strings" },
      );
      pathPatterns = [];
    }
    // Filter out non-string and empty-string entries
    pathPatterns = pathPatterns.filter((p, i) => {
      if (typeof p !== "string") {
        addWarning(
          `skill "${skill.dir}": metadata.filePattern[${i}] is not a string (${typeof p}), removing`,
          { code: "ENTRY_NOT_STRING", skill: skill.dir, field: `filePattern[${i}]`, valueType: typeof p, hint: "Each filePattern entry must be a string" },
        );
        return false;
      }
      if (p === "") {
        addWarning(
          `skill "${skill.dir}": metadata.filePattern[${i}] is empty, removing`,
          { code: "ENTRY_EMPTY", skill: skill.dir, field: `filePattern[${i}]`, valueType: "string", hint: "Remove empty entries from metadata.filePattern" },
        );
        return false;
      }
      return true;
    });

    // Coerce bashPattern: bare string → single-element array
    let bashPatterns = meta.bashPattern ?? [];
    if (typeof bashPatterns === "string") {
      addWarning(
        `skill "${skill.dir}": metadata.bashPattern is a string, coercing to array`,
        { code: "COERCE_STRING_TO_ARRAY", skill: skill.dir, field: "bashPattern", valueType: "string", hint: "Change metadata.bashPattern to a YAML list" },
      );
      bashPatterns = [bashPatterns];
    } else if (!Array.isArray(bashPatterns)) {
      addWarning(
        `skill "${skill.dir}": metadata.bashPattern is not an array (${typeof bashPatterns}), defaulting to []`,
        { code: "INVALID_TYPE", skill: skill.dir, field: "bashPattern", valueType: typeof bashPatterns, hint: "metadata.bashPattern must be an array of regex strings" },
      );
      bashPatterns = [];
    }
    // Filter out non-string and empty-string entries
    bashPatterns = bashPatterns.filter((p, i) => {
      if (typeof p !== "string") {
        addWarning(
          `skill "${skill.dir}": metadata.bashPattern[${i}] is not a string (${typeof p}), removing`,
          { code: "ENTRY_NOT_STRING", skill: skill.dir, field: `bashPattern[${i}]`, valueType: typeof p, hint: "Each bashPattern entry must be a string" },
        );
        return false;
      }
      if (p === "") {
        addWarning(
          `skill "${skill.dir}": metadata.bashPattern[${i}] is empty, removing`,
          { code: "ENTRY_EMPTY", skill: skill.dir, field: `bashPattern[${i}]`, valueType: "string", hint: "Remove empty entries from metadata.bashPattern" },
        );
        return false;
      }
      return true;
    });

    // Key by directory name — the canonical identity of a skill.
    // Frontmatter `name` may differ; directory name is authoritative.
    skills[skill.dir] = {
      priority: meta.priority ?? 5,
      pathPatterns,
      bashPatterns,
    };
  }

  return {
    skills,
    diagnostics,
    warnings,
    warningDetails,
  };
}

// ---------------------------------------------------------------------------
// Shared skill-map validator / normalizer
// ---------------------------------------------------------------------------

const KNOWN_KEYS = new Set(["priority", "pathPatterns", "bashPatterns"]);

/**
 * Validate and normalize a skill-map object (as produced by buildSkillMap).
 * Returns { ok: true, normalizedSkillMap, warnings } or { ok: false, errors }.
 *
 * This is the single source of truth for skill-map validation — both the
 * PreToolUse hook and the validate script should consume this function.
 */
export function validateSkillMap(raw) {
  const errors = [];
  const errorDetails = [];
  const warnings = [];
  const warningDetails = [];

  function addError(msg, detail) {
    errors.push(msg);
    errorDetails.push({ ...detail, message: msg });
  }

  function addWarning(msg, detail) {
    warnings.push(msg);
    warningDetails.push({ ...detail, message: msg });
  }

  if (raw == null || typeof raw !== "object") {
    return {
      ok: false,
      errors: ["skill-map must be a non-null object"],
      errorDetails: [{ code: "INVALID_ROOT", skill: "", field: "", valueType: typeof raw, message: "skill-map must be a non-null object", hint: "Pass a valid skill-map object" }],
    };
  }

  if (!("skills" in raw)) {
    return {
      ok: false,
      errors: ["skill-map is missing required 'skills' key"],
      errorDetails: [{ code: "MISSING_SKILLS_KEY", skill: "", field: "skills", valueType: "undefined", message: "skill-map is missing required 'skills' key", hint: "Add a 'skills' key to the skill-map object" }],
    };
  }

  const skills = raw.skills;
  if (skills == null || typeof skills !== "object" || Array.isArray(skills)) {
    return {
      ok: false,
      errors: ["'skills' must be a non-null object (not an array)"],
      errorDetails: [{ code: "SKILLS_NOT_OBJECT", skill: "", field: "skills", valueType: Array.isArray(skills) ? "array" : typeof skills, message: "'skills' must be a non-null object (not an array)", hint: "'skills' should be a plain object keyed by skill directory name" }],
    };
  }

  const normalizedSkills = {};

  for (const [skill, config] of Object.entries(skills)) {
    if (config == null || typeof config !== "object" || Array.isArray(config)) {
      addError(
        `skill "${skill}": config must be a non-null object`,
        { code: "CONFIG_NOT_OBJECT", skill, field: "", valueType: Array.isArray(config) ? "array" : typeof config, hint: "Each skill config must be a plain object" },
      );
      continue;
    }

    // Warn on unknown keys
    for (const key of Object.keys(config)) {
      if (!KNOWN_KEYS.has(key)) {
        addWarning(
          `skill "${skill}": unknown key "${key}"`,
          { code: "UNKNOWN_KEY", skill, field: key, valueType: typeof config[key], hint: `Remove or rename unknown key "${key}"` },
        );
      }
    }

    // Normalize priority (default 5, matching buildSkillMap)
    let priority = 5;
    if ("priority" in config) {
      const p = config.priority;
      if (typeof p !== "number" || Number.isNaN(p)) {
        addWarning(
          `skill "${skill}": priority is not a valid number, defaulting to 5`,
          { code: "INVALID_PRIORITY", skill, field: "priority", valueType: typeof p, hint: "Set priority to a numeric value (e.g., 5)" },
        );
      } else {
        priority = p;
      }
    }

    // Normalize pathPatterns
    let pathPatterns = [];
    if ("pathPatterns" in config) {
      if (!Array.isArray(config.pathPatterns)) {
        addWarning(
          `skill "${skill}": pathPatterns is not an array, defaulting to []`,
          { code: "INVALID_TYPE", skill, field: "pathPatterns", valueType: typeof config.pathPatterns, hint: "pathPatterns must be an array of glob strings" },
        );
      } else {
        pathPatterns = config.pathPatterns.filter((p, i) => {
          if (typeof p !== "string") {
            addWarning(
              `skill "${skill}": pathPatterns[${i}] is not a string, removing`,
              { code: "ENTRY_NOT_STRING", skill, field: `pathPatterns[${i}]`, valueType: typeof p, hint: "Each pathPatterns entry must be a string" },
            );
            return false;
          }
          if (p === "") {
            addWarning(
              `skill "${skill}": pathPatterns[${i}] is empty, removing`,
              { code: "ENTRY_EMPTY", skill, field: `pathPatterns[${i}]`, valueType: "string", hint: "Remove empty entries from pathPatterns" },
            );
            return false;
          }
          return true;
        });
      }
    }

    // Normalize bashPatterns
    let bashPatterns = [];
    if ("bashPatterns" in config) {
      if (!Array.isArray(config.bashPatterns)) {
        addWarning(
          `skill "${skill}": bashPatterns is not an array, defaulting to []`,
          { code: "INVALID_TYPE", skill, field: "bashPatterns", valueType: typeof config.bashPatterns, hint: "bashPatterns must be an array of regex strings" },
        );
      } else {
        bashPatterns = config.bashPatterns.filter((p, i) => {
          if (typeof p !== "string") {
            addWarning(
              `skill "${skill}": bashPatterns[${i}] is not a string, removing`,
              { code: "ENTRY_NOT_STRING", skill, field: `bashPatterns[${i}]`, valueType: typeof p, hint: "Each bashPatterns entry must be a string" },
            );
            return false;
          }
          if (p === "") {
            addWarning(
              `skill "${skill}": bashPatterns[${i}] is empty, removing`,
              { code: "ENTRY_EMPTY", skill, field: `bashPatterns[${i}]`, valueType: "string", hint: "Remove empty entries from bashPatterns" },
            );
            return false;
          }
          return true;
        });
      }
    }

    normalizedSkills[skill] = { priority, pathPatterns, bashPatterns };
  }

  if (errors.length > 0) {
    return { ok: false, errors, errorDetails };
  }

  return { ok: true, normalizedSkillMap: { skills: normalizedSkills }, warnings, warningDetails };
}
