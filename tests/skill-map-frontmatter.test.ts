import { describe, test, expect } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// Import the module under test
import {
  extractFrontmatter,
  parseSkillFrontmatter,
  scanSkillsDir,
  buildSkillMap,
} from "../hooks/skill-map-frontmatter.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");

// ─── extractFrontmatter ───────────────────────────────────────────

describe("extractFrontmatter", () => {
  test("extracts yaml and body from valid frontmatter", () => {
    const md = `---\nname: test\ndescription: hello\n---\n# Body here`;
    const result = extractFrontmatter(md);
    expect(result.yaml).toBe("name: test\ndescription: hello");
    expect(result.body).toBe("# Body here");
  });

  test("returns empty yaml when no frontmatter present", () => {
    const md = `# Just a heading\nSome content`;
    const result = extractFrontmatter(md);
    expect(result.yaml).toBe("");
    expect(result.body).toBe(md);
  });

  test("handles empty body after frontmatter", () => {
    const md = `---\nname: test\n---\n`;
    const result = extractFrontmatter(md);
    expect(result.yaml).toBe("name: test");
    expect(result.body).toBe("");
  });

  test("handles frontmatter with no trailing newline", () => {
    const md = `---\nname: test\n---`;
    const result = extractFrontmatter(md);
    expect(result.yaml).toBe("name: test");
  });

  test("handles windows-style line endings", () => {
    const md = "---\r\nname: test\r\n---\r\n# Body";
    const result = extractFrontmatter(md);
    expect(result.yaml).toBe("name: test");
    expect(result.body).toBe("# Body");
  });
});

// ─── parseSkillFrontmatter ────────────────────────────────────────

describe("parseSkillFrontmatter", () => {
  test("parses name, description, and metadata", () => {
    const yamlStr = `name: nextjs\ndescription: Next.js guide\nmetadata:\n  priority: 5\n  filePattern:\n    - 'app/**'\n  bashPattern:\n    - '\\bnext\\s+dev\\b'`;
    const result = parseSkillFrontmatter(yamlStr);
    expect(result.name).toBe("nextjs");
    expect(result.description).toBe("Next.js guide");
    expect(result.metadata.priority).toBe(5);
    expect(result.metadata.filePattern).toEqual(["app/**"]);
    expect(result.metadata.bashPattern).toEqual(["\\bnext\\s+dev\\b"]);
  });

  test("returns defaults for empty string", () => {
    const result = parseSkillFrontmatter("");
    expect(result.name).toBe("");
    expect(result.description).toBe("");
    expect(result.metadata).toEqual({});
  });

  test("preserves backslash sequences in single-quoted YAML strings", () => {
    // Single-quoted YAML strings should NOT interpret \b as backspace
    const yamlStr = `name: test\nmetadata:\n  bashPattern:\n    - '\\bnpm\\s+install\\b'`;
    const result = parseSkillFrontmatter(yamlStr);
    expect(result.metadata.bashPattern[0]).toBe("\\bnpm\\s+install\\b");
  });

  test("handles missing metadata gracefully", () => {
    const yamlStr = `name: minimal\ndescription: just a name`;
    const result = parseSkillFrontmatter(yamlStr);
    expect(result.name).toBe("minimal");
    expect(result.metadata).toEqual({});
  });
});

// ─── scanSkillsDir ────────────────────────────────────────────────

describe("scanSkillsDir", () => {
  test("scans actual skills directory and finds all skills", () => {
    const { skills } = scanSkillsDir(SKILLS_DIR);
    expect(skills.length).toBeGreaterThanOrEqual(25);
    const names = skills.map((s) => s.name);
    expect(names).toContain("nextjs");
    expect(names).toContain("vercel-storage");
    expect(names).toContain("ai-sdk");
  });

  test("each skill has name, description, and metadata", () => {
    const { skills } = scanSkillsDir(SKILLS_DIR);
    for (const skill of skills) {
      expect(typeof skill.name).toBe("string");
      expect(skill.name.length).toBeGreaterThan(0);
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.metadata).toBe("object");
    }
  });

  test("each skill has filePattern and bashPattern arrays in metadata", () => {
    const { skills } = scanSkillsDir(SKILLS_DIR);
    for (const skill of skills) {
      expect(Array.isArray(skill.metadata.filePattern)).toBe(true);
      expect(Array.isArray(skill.metadata.bashPattern)).toBe(true);
    }
  });

  test("returns empty skills and diagnostics for non-existent directory", () => {
    const { skills, diagnostics } = scanSkillsDir("/nonexistent/path");
    expect(skills).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  test("works with a temp directory containing skill files", () => {
    const tmp = join(tmpdir(), `skill-test-${Date.now()}`);
    const skillDir = join(tmp, "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: my-skill\ndescription: A test skill\nmetadata:\n  priority: 3\n  filePattern:\n    - 'src/**'\n  bashPattern:\n    - '\\bmy-cmd\\b'\n---\n# My Skill`
    );

    const { skills, diagnostics } = scanSkillsDir(tmp);
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe("my-skill");
    expect(skills[0].metadata.priority).toBe(3);
    expect(skills[0].metadata.filePattern).toEqual(["src/**"]);
    expect(diagnostics).toEqual([]);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("skips SKILL.md with malformed YAML and populates diagnostics", () => {
    const tmp = join(tmpdir(), `skill-bad-yaml-${Date.now()}`);
    const goodDir = join(tmp, "good-skill");
    const badDir = join(tmp, "bad-skill");
    mkdirSync(goodDir, { recursive: true });
    mkdirSync(badDir, { recursive: true });

    writeFileSync(
      join(goodDir, "SKILL.md"),
      `---\nname: good-skill\ndescription: Works\nmetadata:\n  priority: 5\n  filePattern:\n    - 'src/**'\n  bashPattern: []\n---\n# Good`,
    );
    // Malformed YAML: unbalanced braces
    writeFileSync(
      join(badDir, "SKILL.md"),
      `---\nname: {{{invalid yaml\n---\n# Bad`,
    );

    const { skills, diagnostics } = scanSkillsDir(tmp);
    // Should get only the good skill, not crash
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe("good-skill");
    // Diagnostic should capture the bad file
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].file).toContain("bad-skill");
    expect(diagnostics[0].file).toContain("SKILL.md");
    expect(typeof diagnostics[0].error).toBe("string");
    expect(typeof diagnostics[0].message).toBe("string");

    rmSync(tmp, { recursive: true, force: true });
  });
});

// ─── buildSkillMap ────────────────────────────────────────────────

describe("buildSkillMap", () => {
  test("produces object with $schema, skills, and diagnostics keys", () => {
    const map = buildSkillMap(SKILLS_DIR);
    expect(map.$schema).toBeTruthy();
    expect(typeof map.skills).toBe("object");
    expect(Array.isArray(map.diagnostics)).toBe(true);
  });

  test("output shape has priority, pathPatterns, and bashPatterns per skill", () => {
    const map = buildSkillMap(SKILLS_DIR);
    for (const [name, skill] of Object.entries(map.skills) as [string, any][]) {
      expect(typeof skill.priority).toBe("number");
      expect(Array.isArray(skill.pathPatterns)).toBe(true);
      expect(Array.isArray(skill.bashPatterns)).toBe(true);
    }
  });

  test("nextjs skill matches expected values from frontmatter", () => {
    const map = buildSkillMap(SKILLS_DIR);
    const nextjs = map.skills["nextjs"];
    expect(nextjs).toBeDefined();
    expect(nextjs.priority).toBe(5);
    expect(nextjs.pathPatterns).toContain("next.config.*");
    expect(nextjs.pathPatterns).toContain("app/**");
    expect(nextjs.bashPatterns.length).toBeGreaterThan(0);
  });

  test("skill count matches number of SKILL.md directories", () => {
    const map = buildSkillMap(SKILLS_DIR);
    const skillCount = Object.keys(map.skills).length;
    expect(skillCount).toBeGreaterThanOrEqual(25);
  });

  test("invariant: expected representative skills present with correct patterns", () => {
    const map = buildSkillMap(SKILLS_DIR);
    // Spot-check key skills
    expect(map.skills["nextjs"]).toBeDefined();
    expect(map.skills["vercel-cli"]).toBeDefined();
    expect(map.skills["ai-sdk"]).toBeDefined();
    expect(map.skills["vercel-storage"]).toBeDefined();

    // nextjs should have app/** and next.config.* patterns
    expect(map.skills["nextjs"].pathPatterns).toContain("app/**");
    expect(map.skills["nextjs"].pathPatterns).toContain("next.config.*");

    // vercel-cli should have a bash pattern for vercel commands
    expect(map.skills["vercel-cli"].bashPatterns.length).toBeGreaterThan(0);
  });

  test("backslash sequences preserved in bash patterns", () => {
    const map = buildSkillMap(SKILLS_DIR);
    const nextjs = map.skills["nextjs"];
    // Should contain literal \b not a backspace character
    const hasWordBoundary = nextjs.bashPatterns.some((p: string) => p.includes("\\b"));
    expect(hasWordBoundary).toBe(true);
  });

  test("coerces bare string filePattern to array with warning", () => {
    const tmp = join(tmpdir(), `skill-string-fp-${Date.now()}`);
    const skillDir = join(tmp, "bare-string-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: bare-string-skill\ndescription: Test bare string\nmetadata:\n  priority: 3\n  filePattern: 'src/**'\n  bashPattern:\n    - '\\btest\\b'\n---\n# Test`,
    );

    const map = buildSkillMap(tmp);
    const skill = map.skills["bare-string-skill"];
    expect(skill).toBeDefined();
    expect(Array.isArray(skill.pathPatterns)).toBe(true);
    expect(skill.pathPatterns).toEqual(["src/**"]);
    expect(Array.isArray(skill.bashPatterns)).toBe(true);
    // Should have a coercion warning
    expect(map.warnings.length).toBeGreaterThanOrEqual(1);
    expect(map.warnings.some((w: string) => w.includes("filePattern") && w.includes("coercing"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("coerces bare string bashPattern to array with warning", () => {
    const tmp = join(tmpdir(), `skill-string-bp-${Date.now()}`);
    const skillDir = join(tmp, "bare-bash-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: bare-bash-skill\ndescription: Test bare bash string\nmetadata:\n  priority: 2\n  filePattern:\n    - 'app/**'\n  bashPattern: '\\bnpm\\b'\n---\n# Test`,
    );

    const map = buildSkillMap(tmp);
    const skill = map.skills["bare-bash-skill"];
    expect(skill).toBeDefined();
    expect(Array.isArray(skill.bashPatterns)).toBe(true);
    expect(skill.bashPatterns).toEqual(["\\bnpm\\b"]);
    expect(map.warnings.some((w: string) => w.includes("bashPattern") && w.includes("coercing"))).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("defaults non-array non-string filePattern to empty array with warning", () => {
    const tmp = join(tmpdir(), `skill-bad-type-${Date.now()}`);
    const skillDir = join(tmp, "bad-type-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: bad-type-skill\ndescription: Test bad type\nmetadata:\n  priority: 1\n  filePattern: 42\n  bashPattern: true\n---\n# Test`,
    );

    const map = buildSkillMap(tmp);
    const skill = map.skills["bad-type-skill"];
    expect(skill).toBeDefined();
    expect(skill.pathPatterns).toEqual([]);
    expect(skill.bashPatterns).toEqual([]);
    expect(map.warnings.length).toBeGreaterThanOrEqual(2);

    rmSync(tmp, { recursive: true, force: true });
  });

  test("no warnings emitted for well-formed skills directory", () => {
    const map = buildSkillMap(SKILLS_DIR);
    expect(map.warnings).toEqual([]);
  });
});
