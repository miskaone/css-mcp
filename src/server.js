#!/usr/bin/env node
// src/server.js — Node 20+, pure ESM, MCP stdio server
// Tools:
//  - get_docs({ slug }) → MDN page JSON (index.json)
//  - get_browser_compatibility({ bcd_id }) → BCD feature node + raw file

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import TurndownService from "turndown";
import Database from "better-sqlite3";
import { analyze } from "@projectwallace/css-analyzer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync } from "fs";
import { homedir } from "os";

// ---------- cache setup ----------
const CACHE_DIR = join(homedir(), ".cache", "css-mcp");
const CACHE_DB = join(CACHE_DIR, "cache.db");
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (MDN docs don't change often)

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize database
const db = new Database(CACHE_DB);
db.pragma("journal_mode = WAL"); // Better performance for concurrent access

// Create cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    hit_count INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_fetched_at ON cache(fetched_at);
`);

// Prepare statements for better performance
const getCache = db.prepare("SELECT data, fetched_at FROM cache WHERE key = ?");
const setCache = db.prepare(
  "INSERT OR REPLACE INTO cache (key, data, fetched_at, hit_count) VALUES (?, ?, ?, COALESCE((SELECT hit_count FROM cache WHERE key = ?), 0))"
);
const updateHitCount = db.prepare("UPDATE cache SET hit_count = hit_count + 1 WHERE key = ?");
const cleanOldCache = db.prepare("DELETE FROM cache WHERE fetched_at < ?");

// Cache helper functions
function getCached(key) {
  const row = getCache.get(key);
  if (!row) return null;

  const age = Date.now() - row.fetched_at;
  if (age > CACHE_TTL) {
    return null; // Expired
  }

  updateHitCount.run(key);
  return JSON.parse(row.data);
}

function setCached(key, data) {
  const now = Date.now();
  setCache.run(key, JSON.stringify(data), now, key);
}

// Clean old cache entries on startup (older than TTL)
cleanOldCache.run(Date.now() - CACHE_TTL);

// ---------- utils ----------
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Convert MDN body sections from HTML to markdown
function convertBodyToMarkdown(body) {
  if (!body || !Array.isArray(body)) return [];

  return body.map((section) => {
    if (section.type === "prose" && section.value?.content) {
      return {
        type: section.type,
        title: section.value.title,
        content: turndownService.turndown(section.value.content),
      };
    }
    // Keep other section types as-is (specifications, browser_compatibility, etc.)
    return section;
  });
}

const normalize_slug_to_json = (slug) => {
  let raw = String(slug).replace(/^\/+/, "");

  // Smart CSS normalization - auto-prepend Web/CSS/ if not present
  if (!raw.startsWith("en-US/") && !raw.startsWith("Web/")) {
    raw = `Web/CSS/${raw}`;
  }

  const has_locale = /^([a-z]{2}-[A-Z]{2})\/docs\//.test(raw);
  const path = has_locale ? raw : `en-US/docs/${raw}`;
  const clean = path.replace(/\/+$/, "");
  // MDN URLs preserve special chars like : for pseudo-selectors (:has, ::before, etc.)
  // No need to encode path segments for MDN's index.json endpoints
  const encoded = clean;

  return {
    slug_path: `/${encoded}`,
    url_primary: `https://developer.mozilla.org/${encoded}/index.json`,
    url_fallback: `https://mdn.dev/${encoded}/index.json`,
  };
};

async function fetch_json(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetch_failed ${res.status} ${res.statusText} ${url}\n${text}`);
  }
  return res.json();
}

function resolve_bcd_feature(raw_bcd, bcd_id) {
  let node = raw_bcd;
  for (const part of bcd_id.split(".")) {
    if (node && Object.prototype.hasOwnProperty.call(node, part)) {
      node = node[part];
    } else {
      return null;
    }
  }
  return node;
}

// ---------- tool impls ----------
async function get_docs_impl({ slug }) {
  const cacheKey = `docs:${slug}`;

  // Try cache first
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const { slug_path, url_primary } = normalize_slug_to_json(slug);
  const data = await fetch_json(url_primary);
  const result = { source: "mdn-doc", slug: slug_path, url: url_primary, data };

  // Cache for next time
  setCached(cacheKey, result);

  return result;
}

async function get_bcd_impl({ bcd_id }) {
  const cacheKey = `bcd:${bcd_id}`;

  // Try cache first
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const path = bcd_id.replaceAll(".", "/");
  const url = `https://raw.githubusercontent.com/mdn/browser-compat-data/main/${path}.json`;
  const raw = await fetch_json(url);
  const feature = resolve_bcd_feature(raw, bcd_id);
  const result = {
    source: "mdn-bcd",
    bcd_id,
    url,
    feature, // usually has __compat + subfeatures
    raw, // entire file as fetched
  };

  // Cache for next time
  setCached(cacheKey, result);

  return result;
}

// ---------- self-test ----------
async function self_test() {
  // Test with simple slug (auto-normalized)
  const d = await get_docs_impl({ slug: "grid" });
  console.error("docs ok (simple slug):", {
    input: "grid",
    slug: d.slug,
    url: d.url,
    has_data: !!d.data,
  });

  // Test with special chars (pseudo-selectors like :has) and markdown conversion
  const d2 = await get_docs_impl({ slug: ":has" });
  const body = convertBodyToMarkdown(d2.data?.doc?.body || []);
  const firstSection = body[0]?.content?.substring(0, 100);
  console.error("docs ok (pseudo-selector + markdown):", {
    input: ":has",
    slug: d2.slug,
    url: d2.url,
    has_data: !!d2.data,
    markdown_preview: firstSection + "...",
  });

  const b = await get_bcd_impl({ bcd_id: "css.properties.grid" });
  const has_compat = Boolean(b.feature?.__compat);
  const support_keys = Object.keys(b.feature?.__compat?.support || {});
  console.error("bcd ok:", { bcd_id: b.bcd_id, has_compat, support_keys });

  // Test analyze_css
  const testCss = `
    .container {
      display: grid;
      color: blue;
      font-size: 16px;
    }
    .item {
      color: #0000ff;
    }
  `;
  const analysis = analyze(testCss);
  console.error("analyze_css ok:", {
    has_stylesheet: !!analysis.stylesheet,
    rules_total: analysis.rules?.total,
    colors_total: analysis.colors?.total,
    has_metrics: !!analysis.__meta__,
  });
}

// ---------- stdio server ----------
async function start() {
  const server = new McpServer({ name: "css", version: "1.1.0" });

  server.tool(
    "get_docs",
    'Fetch official MDN documentation for any CSS property, selector, function, or concept. Use this tool PROACTIVELY whenever the user mentions CSS features. Supports simple slugs (auto-normalized): "grid", "flexbox", ":has", "::before", "@media", "container-queries", "calc". Also accepts full paths: "Web/CSS/grid". Always fetch docs when analyzing, fixing, or implementing CSS code.',
    { slug: z.string().min(1) },
    async ({ slug }) => {
      const result = await get_docs_impl({ slug });
      // Convert HTML to markdown and extract essential parts
      const body = convertBodyToMarkdown(result.data?.doc?.body || []);
      const filtered = {
        source: result.source,
        slug: result.slug,
        url: result.url,
        title: result.data?.doc?.title,
        mdn_url: result.data?.doc?.mdn_url,
        summary: result.data?.doc?.summary,
        body: body.slice(0, 15), // First 15 sections (now much smaller as markdown)
      };
      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }
  );

  server.tool(
    "get_browser_compatibility",
    'Get browser support data for CSS features. Use this tool when the user needs to know browser compatibility, or when suggesting modern CSS features that may need fallbacks. Format: "css.properties.grid", "css.selectors.has", "css.properties.container-type".',
    { bcd_id: z.string().min(1) },
    async ({ bcd_id }) => {
      const result = await get_bcd_impl({ bcd_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "analyze_css",
    'Analyze CSS code for quality, complexity, and design patterns. Provides 150+ metrics including selector complexity, specificity, color usage, font sizes, property patterns, and code quality indicators. Use this to identify issues, suggest improvements, or audit CSS codebases.',
    { css: z.string().min(1) },
    async ({ css }) => {
      const result = analyze(css);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ---------- entry ----------
const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  self_test()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  start();
}
