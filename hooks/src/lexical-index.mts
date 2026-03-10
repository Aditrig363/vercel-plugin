import MiniSearch from "minisearch";
import * as hookEnv from "./hook-env.mjs";
import { createLogger, logCaughtError } from "./logger.mjs";

type RetrievalField = "aliases" | "intents" | "entities" | "examples";
type RetrievalBlock = Partial<Record<RetrievalField, unknown>>;
type LexicalDocument = Record<RetrievalField, string> & { id: string };
type NumberEnv = (name: string, fallback: number) => number;

export const SYNONYM_MAP = {
  deploy: ["ship", "release", "go-live", "publish", "push"],
  env: ["environment", "secret", "config", "variable"],
  auth: ["login", "signin", "session", "authentication", "credentials"],
  chat: ["conversation", "messaging", "bot", "chatbot"],
  database: ["db", "sql", "postgres", "prisma", "drizzle"],
  style: ["css", "styling", "theme", "tailwind"],
  test: ["testing", "spec", "jest", "vitest"],
  api: ["endpoint", "route", "handler", "rest", "graphql"],
} as const;

export const CONTRACTIONS = {
  "aren't": "are not",
  arent: "are not",
  "can't": "cannot",
  cant: "cannot",
  "didn't": "did not",
  didnt: "did not",
  "doesn't": "does not",
  doesnt: "does not",
  "don't": "do not",
  dont: "do not",
  "i'm": "i am",
  im: "i am",
  "isn't": "is not",
  isnt: "is not",
  "shouldn't": "should not",
  shouldnt: "should not",
  "wasn't": "was not",
  wasnt: "was not",
  "weren't": "were not",
  werent: "were not",
  "won't": "will not",
  wont: "will not",
  "wouldn't": "would not",
  wouldnt: "would not",
} as const;

const FIELDS: RetrievalField[] = ["aliases", "intents", "entities", "examples"];
const SEARCH_OPTIONS = {
  prefix: true,
  fuzzy: 0.2,
  boost: { intents: 3, aliases: 2, entities: 1.5, examples: 1 },
} as const;
const logger = createLogger();
const numberEnv: NumberEnv =
  (hookEnv as { numberEnv?: NumberEnv }).numberEnv ?? ((name, fallback) => {
    const raw = process.env[name];
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
    return Number.isFinite(value) ? value : fallback;
  });

const expansionLookup = buildExpansionLookup();
let lexicalIndex: MiniSearch<LexicalDocument> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildExpansionLookup(): Record<string, string[]> {
  const lookup: Record<string, string[]> = {};
  for (const [root, aliases] of Object.entries(SYNONYM_MAP)) {
    const terms = [...new Set([root, ...aliases])];
    for (const term of terms) lookup[term] = terms;
  }
  return lookup;
}

function expandContractions(text: string): string {
  return Object.entries(CONTRACTIONS).reduce(
    (result, [from, to]) => result.replaceAll(new RegExp(`\\b${from}\\b`, "g"), to),
    text.toLowerCase().replaceAll("’", "'"),
  );
}

function expandText(text: string, includeContractions = false): string {
  const source = includeContractions ? expandContractions(text) : text.toLowerCase();
  const tokens = source.match(/[a-z0-9-]+/g) ?? [];
  const seen = new Set<string>();
  const expanded: string[] = [];

  for (const token of tokens) {
    for (const term of expansionLookup[token] ?? [token]) {
      if (!seen.has(term)) {
        seen.add(term);
        expanded.push(term);
      }
    }
  }

  return expanded.join(" ");
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function resolveRetrievalBlock(skill: any): RetrievalBlock | null {
  const entry = asRecord(skill);
  const frontmatter = asRecord(entry?.frontmatter);
  const metadata = asRecord(entry?.metadata);
  const frontmatterMetadata = asRecord(frontmatter?.metadata);
  return (
    asRecord(entry?.retrieval) ||
    asRecord(metadata?.retrieval) ||
    asRecord(frontmatter?.retrieval) ||
    asRecord(frontmatterMetadata?.retrieval)
  );
}

function buildDocument(id: string, retrieval: RetrievalBlock): LexicalDocument | null {
  const document = {
    id,
    aliases: expandText(stringList(retrieval.aliases).join(" ")),
    intents: expandText(stringList(retrieval.intents).join(" ")),
    entities: expandText(stringList(retrieval.entities).join(" ")),
    examples: expandText(stringList(retrieval.examples).join(" ")),
  };
  return FIELDS.some((field) => document[field] !== "") ? document : null;
}

export function initializeLexicalIndex(skillMap: Map<string, any>): void {
  const documents: LexicalDocument[] = [];

  for (const [skill, entry] of skillMap) {
    const retrieval = resolveRetrievalBlock(entry);
    const document = retrieval ? buildDocument(skill, retrieval) : null;
    if (document) documents.push(document);
  }

  try {
    lexicalIndex = new MiniSearch<LexicalDocument>({
      fields: FIELDS,
      storeFields: ["id"],
      searchOptions: SEARCH_OPTIONS,
    });
    lexicalIndex.addAll(documents);
    logger.debug("lexical-index:initialized", {
      indexedSkillCount: documents.length,
      totalSkillCount: skillMap.size,
    });
  } catch (error) {
    lexicalIndex = null;
    logCaughtError(logger, "lexical-index:initialize-failed", error, {
      indexedSkillCount: documents.length,
      totalSkillCount: skillMap.size,
    });
  }
}

export function searchSkills(query: string): { skill: string; score: number }[] {
  if (!lexicalIndex) return [];

  const expandedQuery = expandText(query, true);
  if (expandedQuery === "") return [];

  try {
    const minScore = numberEnv("VERCEL_PLUGIN_LEXICAL_RESULT_MIN_SCORE", 4.5);
    return lexicalIndex
      .search(expandedQuery)
      .map((result) => ({ skill: String(result.id), score: result.score }))
      .filter((result) => result.score >= minScore)
      .sort((left, right) => right.score - left.score);
  } catch (error) {
    logCaughtError(logger, "lexical-index:search-failed", error, { query });
    return [];
  }
}
