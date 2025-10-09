# CSS MCP Server

An MCP (Model Context Protocol) server that provides up-to-date CSS documentation from MDN and comprehensive CSS code analysis.

## Features

**Documentation & Compatibility:**

- Official MDN Docs - Fetches documentation directly from MDN's API
- Browser Compatibility - Includes browser support data from MDN's BCD
- Simple API - Just pass CSS property names like `"grid"`, `"flexbox"`, or `":has"`
- Markdown Conversion - Converts HTML documentation to clean, readable markdown
- Auto-normalization - Supports both simple slugs (`"grid"`) and full paths (`"Web/CSS/grid"`)
- Smart Caching - SQLite-based cache with 7-day TTL for blazing-fast responses

**CSS Analysis:**

- 150+ Metrics - Comprehensive analysis of stylesheet quality and complexity
- Design Patterns - Detect color palettes, font sizes, spacing patterns
- Code Quality - Selector complexity, specificity analysis, property usage
- Performance Insights - Identify overly complex selectors and redundant code

## Installation

### For Claude Code

Install via the Claude Code CLI:

```bash
claude mcp add css -- npx -y css-mcp
```

### For VS Code 

One click install:

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=css-mcp&config=%7B%22name%22%3A%22css-mcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22css%22%5D%2C%22env%22%3A%7B%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=css-mcp&config=%7B%22name%22%3A%22css%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22css-mcp%22%5D%2C%22env%22%3A%7B%7D%7D&quality=insiders)

Install via VS Code CLI:

```bash
code --add-mcp '{\"name\":\"css\",\"command\":\"npx\",\"args\":[\"-y\",\"css-mcp\"],\"env\":{}}'
```

### For MCP Clients (Claude Desktop, etc.)

Add to your MCP settings configuration:

```json
{
  "mcpServers": {
    "css": {
      "command": "npx",
      "args": ["-y", "css-mcp"]
    }
  }
}
```

### For Development

```bash
npm install -g css-mcp
```

Or use with npx:

```bash
npx css-mcp --self-test
```

## Requirements

- Node.js 20+
- Build tools for native modules (usually pre-installed on most systems)

## Usage

### Available Tools

#### `get_docs`

Fetch CSS documentation for any property, selector, function, or concept.

**Parameters:**

- `slug` (string) - CSS feature name or MDN path

**Examples:**

```javascript
// Simple slugs (auto-normalized)
get_docs({ slug: "grid" });
get_docs({ slug: ":has" });
get_docs({ slug: "flexbox" });
get_docs({ slug: "@media" });
get_docs({ slug: "::before" });

// Full MDN paths also work
get_docs({ slug: "Web/CSS/grid" });
get_docs({ slug: "en-US/docs/Web/CSS/border-radius" });
```

**Returns:**

```json
{
  "source": "mdn-doc",
  "slug": "/en-US/docs/Web/CSS/grid",
  "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/grid/index.json",
  "title": "grid",
  "mdn_url": "/en-US/docs/Web/CSS/grid",
  "summary": "The grid CSS property is a shorthand...",
  "body": [
    {
      "type": "prose",
      "title": "Syntax",
      "content": "The **`grid`** property is a shorthand..."
    }
  ]
}
```

#### `get_browser_compatibility`

Fetch browser compatibility data for CSS features.

**Parameters:**

- `bcd_id` (string) - Browser Compat Data ID (e.g., `"css.properties.grid"`)

**Example:**

```javascript
get_browser_compatibility({ bcd_id: "css.properties.grid" });
get_browser_compatibility({ bcd_id: "css.selectors.has" });
```

#### `analyze_css`

Analyze CSS code for quality, complexity, and design patterns. Returns **curated summary by default** (lightweight, ~1-2k tokens). Use `summaryOnly: false` for complete 150+ metrics (uses ~10k+ tokens).

**Parameters:**

- `css` (string, required) - CSS code to analyze
- `summaryOnly` (boolean, optional) - Return summary instead of full analysis. Default: `true`

**Examples:**

```javascript
// Summary mode (default, lightweight)
analyze_css({
  css: `
    .container {
      display: grid;
      color: #3b82f6;
    }
  `
});

// Full analysis with all 150+ metrics
analyze_css({
  css: "...",
  summaryOnly: false
});
```

**Returns (default summary):**

```json
{
  "analysis": {
    "stylesheet": {
      "sourceLinesOfCode": 5,
      "size": 72
    },
    "rules": { "total": 1 },
    "selectors": {
      "total": 1,
      "averageComplexity": 1.0,
      "maxComplexity": 1
    },
    "colors": {
      "unique": 1,
      "uniqueColors": ["#3b82f6"]
    }
  },
  "note": "Summary metrics only. Use summaryOnly: false for complete 150+ metrics."
}
```

#### `analyze_project_css`

Analyze all CSS files in a project. Finds CSS files recursively, combines them, and provides project-wide analysis. **Framework-agnostic** - works with built CSS from any framework (SvelteKit, React, Vue, etc.).

Returns **curated summary metrics by default** (lightweight, ~1-2k tokens). Use `includeFullAnalysis: true` for complete data (uses ~10k+ tokens).

**Automatically excludes:**
- `**/node_modules/**`
- `**/*.min.css`

**Parameters:**

- `path` (string, required) - File path, directory, or glob pattern
- `includeFullAnalysis` (boolean, optional) - Return full 150+ metrics instead of summary. Default: `false`
- `exclude` (array of strings, optional) - Additional glob patterns to exclude

**Examples:**

```javascript
// Analyze all CSS in a directory (summary - default, lightweight)
analyze_project_css({ path: "dist" });

// Full analysis with all 150+ metrics (uses more tokens)
analyze_project_css({
  path: "dist",
  includeFullAnalysis: true
});

// Exclude additional patterns
analyze_project_css({
  path: "dist",
  exclude: ["**/vendor/**", "**/*.legacy.css"]
});

// Analyze specific file
analyze_project_css({ path: "public/styles.css" });

// Use glob patterns
analyze_project_css({ path: "dist/**/*.css" });
```

**Returns (default summary):**

```json
{
  "files": {
    "total": 5,
    "analyzed": 5,
    "errors": 0,
    "list": [
      { "path": "/path/to/style.css", "size": 2048 },
      { "path": "/path/to/theme.css", "size": 1024 }
    ]
  },
  "summary": {
    "stylesheet": {
      "sourceLinesOfCode": 450,
      "size": 12800
    },
    "rules": { "total": 85 },
    "selectors": {
      "total": 120,
      "averageComplexity": 1.4,
      "maxComplexity": 5
    },
    "colors": {
      "unique": 12,
      "uniqueColors": ["#3b82f6", "#10b981", ...]
    },
    "fontSizes": {
      "unique": 8,
      "uniqueSizes": ["1rem", "1.5rem", ...]
    }
  },
  "note": "Summary metrics only. Use includeFullAnalysis: true for complete data."
}
```

## Cache Management

The server automatically:

- Creates cache at `~/.cache/css-mcp/cache.db`
- Cleans up expired entries on startup
- Tracks hit counts for each cached entry
- Uses WAL mode for better concurrent performance

To clear the cache:

```bash
rm -rf ~/.cache/css-mcp/
```

## Self-Test

Verify the server is working correctly:

```bash
npm test
# or
css-mcp --self-test
# or
npx css-mcp --self-test
```

Expected output:

```
docs ok (simple slug): { input: 'grid', slug: '/en-US/docs/Web/CSS/grid', ... }
docs ok (pseudo-selector + markdown): { input: ':has', ... }
bcd ok: { bcd_id: 'css.properties.grid', has_compat: true, ... }
```

## Example: Using with Claude Code

Once configured, you can ask Claude Code:

**Documentation & Compatibility:**

> "Use the CSS MCP to get documentation for flexbox"

> "What browser support does :has selector have?"

> "Explain how CSS grid works"

**CSS Analysis:**

> "Analyze this CSS and tell me what could be improved"

> "What colors are used in my stylesheet?"

> "Check the complexity of my selectors"

**Project Analysis:**

> "Analyze all CSS in my dist folder"

> "What's the total complexity of my project's CSS?"

> "Show me all colors used across my entire project"

Claude will automatically use the MCP to fetch the latest MDN documentation and analyze CSS code.

## Development

```bash
# Clone the repository
git clone https://github.com/stolinski/css-mcp.git
cd css-mcp

# Install dependencies
npm install

# Link for local development
npm link

# Run tests
npm test
```

## Performance & Limits

**Caching:**
- **First fetch**: ~400-500ms (network + cache write)
- **Cached fetch**: ~100ms (**~5x faster**)
- **Cache size**: ~390KB for typical usage

**Input Limits:**
- **Max file size**: 10MB per CSS file
- **Max total size**: 50MB combined
- **Max files**: 500 CSS files per analysis
- **Network timeout**: 10 seconds for MDN API calls

## Troubleshooting

### "Module did not self-register"

This usually means native modules need rebuilding:

```bash
npm rebuild better-sqlite3
```

### Cache not working

Check cache directory permissions:

```bash
ls -la ~/.cache/css-mcp/
```

Should show `cache.db`, `cache.db-shm`, and `cache.db-wal` files.

## Contributing

This is an experimental MCP server for CSS documentation tooling, let's work on tools that make AI better at CSS
