#!/usr/bin/env bun
/**
 * Structural validation for the Vercel ecosystem plugin.
 * Checks cross-references, frontmatter, manifest completeness, and hooks validity.
 *
 * Usage: bun run scripts/validate.ts
 * Exits 0 on success, non-zero on failure.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const errors: string[] = [];

function fail(msg: string) {
  errors.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const pairs: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      pairs[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// 1. Validate ⤳ skill: references in ecosystem graph
// ---------------------------------------------------------------------------

async function validateGraphSkillRefs() {
  console.log("\n[1] Ecosystem graph → skill cross-references");

  const graphPath = join(ROOT, "assets", "vercel-ecosystem-graph.md");
  if (!(await exists(graphPath))) {
    fail("assets/vercel-ecosystem-graph.md not found");
    return;
  }

  const graph = await readFile(graphPath, "utf-8");
  const refs = [...graph.matchAll(/⤳\s*skill:\s*([a-z][a-z0-9-]*)/g)].map((m) => m[1]);

  if (refs.length === 0) {
    fail("No ⤳ skill: references found in ecosystem graph");
    return;
  }

  const uniqueRefs = [...new Set(refs)];
  for (const name of uniqueRefs) {
    const skillPath = join(ROOT, "skills", name, "SKILL.md");
    if (await exists(skillPath)) {
      pass(`⤳ skill:${name} → skills/${name}/SKILL.md`);
    } else {
      fail(`⤳ skill:${name} referenced in graph but skills/${name}/SKILL.md not found`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Validate SKILL.md frontmatter
// ---------------------------------------------------------------------------

async function validateSkillFrontmatter(): Promise<string[]> {
  console.log("\n[2] SKILL.md YAML frontmatter");

  const skillsDir = join(ROOT, "skills");
  const dirs = await readdir(skillsDir);
  const skillNames: string[] = [];

  for (const dir of dirs.sort()) {
    const skillPath = join(skillsDir, dir, "SKILL.md");
    if (!(await exists(skillPath))) continue;

    skillNames.push(dir);
    const content = await readFile(skillPath, "utf-8");
    const fm = parseFrontmatter(content);

    if (!fm) {
      fail(`skills/${dir}/SKILL.md — missing YAML frontmatter`);
      continue;
    }
    if (!fm.name) {
      fail(`skills/${dir}/SKILL.md — frontmatter missing 'name' field`);
    }
    if (!fm.description) {
      fail(`skills/${dir}/SKILL.md — frontmatter missing 'description' field`);
    }
    if (fm.name && fm.description) {
      pass(`skills/${dir}/SKILL.md — name: "${fm.name}", description present`);
    }
  }

  return skillNames;
}

// ---------------------------------------------------------------------------
// 3. Validate plugin.json enumerates all capabilities
// ---------------------------------------------------------------------------

async function validatePluginJson(skillNames: string[]) {
  console.log("\n[3] plugin.json completeness");

  const manifestPath = join(ROOT, ".plugin", "plugin.json");
  if (!(await exists(manifestPath))) {
    fail(".plugin/plugin.json not found");
    return;
  }

  let manifest: any;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
  } catch (e) {
    fail(`.plugin/plugin.json is not valid JSON: ${e}`);
    return;
  }

  // Skills
  const declaredSkills: string[] = manifest.skills ?? [];
  for (const name of skillNames) {
    if (declaredSkills.includes(name)) {
      pass(`plugin.json lists skill "${name}"`);
    } else {
      fail(`plugin.json missing skill "${name}"`);
    }
  }
  for (const name of declaredSkills) {
    if (!skillNames.includes(name)) {
      fail(`plugin.json lists skill "${name}" but skills/${name}/SKILL.md not found`);
    }
  }

  // Agents
  const agentsDir = join(ROOT, "agents");
  if (await exists(agentsDir)) {
    const agentFiles = (await readdir(agentsDir)).filter((f) => f.endsWith(".md")).sort();
    const declaredAgents: string[] = manifest.agents ?? [];
    for (const f of agentFiles) {
      if (declaredAgents.includes(f)) {
        pass(`plugin.json lists agent "${f}"`);
      } else {
        fail(`plugin.json missing agent "${f}"`);
      }
    }
  }

  // Commands
  const commandsDir = join(ROOT, "commands");
  if (await exists(commandsDir)) {
    const cmdFiles = (await readdir(commandsDir)).filter((f) => f.endsWith(".md")).sort();
    const declaredCmds: string[] = manifest.commands ?? [];
    for (const f of cmdFiles) {
      if (declaredCmds.includes(f)) {
        pass(`plugin.json lists command "${f}"`);
      } else {
        fail(`plugin.json missing command "${f}"`);
      }
    }
  }

  // Rules
  const rulesDir = join(ROOT, "rules");
  if (await exists(rulesDir)) {
    const ruleFiles = (await readdir(rulesDir)).filter((f) => f.endsWith(".mdc")).sort();
    const declaredRules: string[] = manifest.rules ?? [];
    for (const f of ruleFiles) {
      if (declaredRules.includes(f)) {
        pass(`plugin.json lists rule "${f}"`);
      } else {
        fail(`plugin.json missing rule "${f}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Validate hooks.json
// ---------------------------------------------------------------------------

async function validateHooksJson() {
  console.log("\n[4] hooks.json validity");

  const hooksPath = join(ROOT, "hooks", "hooks.json");
  if (!(await exists(hooksPath))) {
    fail("hooks/hooks.json not found");
    return;
  }

  try {
    const content = await readFile(hooksPath, "utf-8");
    JSON.parse(content);
    pass("hooks/hooks.json is valid JSON");
  } catch (e) {
    fail(`hooks/hooks.json is not valid JSON: ${e}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Vercel Plugin — Structural Validation\n" + "=".repeat(40));

  await validateGraphSkillRefs();
  const skillNames = await validateSkillFrontmatter();
  await validatePluginJson(skillNames);
  await validateHooksJson();

  console.log("\n" + "=".repeat(40));
  if (errors.length > 0) {
    console.error(`\nFAILED — ${errors.length} error(s)\n`);
    process.exit(1);
  } else {
    console.log("\nPASSED — all checks OK\n");
    process.exit(0);
  }
}

main();
