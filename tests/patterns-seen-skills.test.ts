import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseSeenSkillsFile, readSeenSkillsFile, appendSeenSkill } from "../hooks/patterns.mjs";

let tempDir: string;
let seenSkillsFile: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "vercel-plugin-seen-skills-"));
  seenSkillsFile = join(tempDir, "seen-skills.txt");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("parseSeenSkillsFile", () => {
  test("parses CRLF content and removes blank lines", () => {
    const parsed = parseSeenSkillsFile("nextjs\r\n\r\nai-sdk\r\n   \r\n");
    expect([...parsed]).toEqual(["nextjs", "ai-sdk"]);
  });

  test("collapses duplicate slugs while preserving first-seen order", () => {
    const parsed = parseSeenSkillsFile("nextjs\nai-sdk\nnextjs\nai-sdk\nworkflow\n");
    expect([...parsed]).toEqual(["nextjs", "ai-sdk", "workflow"]);
  });
});

describe("readSeenSkillsFile", () => {
  test("returns an empty set for a missing file", () => {
    const parsed = readSeenSkillsFile(seenSkillsFile);
    expect([...parsed]).toEqual([]);
  });

  test("returns an empty set for undefined and blank path inputs", () => {
    expect([...readSeenSkillsFile(undefined)]).toEqual([]);
    expect([...readSeenSkillsFile("")]).toEqual([]);
    expect([...readSeenSkillsFile("   ")]).toEqual([]);
  });
});

describe("appendSeenSkill", () => {
  test("no-ops for undefined/blank path and blank skill", () => {
    appendSeenSkill(undefined, "nextjs");
    appendSeenSkill("", "nextjs");
    appendSeenSkill("   ", "nextjs");
    appendSeenSkill(seenSkillsFile, "");
    appendSeenSkill(seenSkillsFile, "   ");
    expect(existsSync(seenSkillsFile)).toBe(false);
  });

  test("appends newline-delimited content that round-trips through readSeenSkillsFile", () => {
    appendSeenSkill(seenSkillsFile, "nextjs");
    appendSeenSkill(seenSkillsFile, "ai-sdk");

    const raw = readFileSync(seenSkillsFile, "utf8");
    expect(raw).toBe("nextjs\nai-sdk\n");

    const parsed = readSeenSkillsFile(seenSkillsFile);
    expect([...parsed]).toEqual(["nextjs", "ai-sdk"]);
  });
});
