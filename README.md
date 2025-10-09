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

Analyze CSS code for quality, complexity, and design patterns. Returns 150+ metrics including stylesheet metadata, selector complexity, specificity analysis, color palettes, font sizes, and more.

**Parameters:**

- `css` (string) - CSS code to analyze

**Example:**

```javascript
analyze_css({
  css: `
    .container {
      display: grid;
      color: #3b82f6;
    }
  `,
});
```

**Returns:**

```json
{
  "stylesheet": {
    "sourceLinesOfCode": 5,
    "size": 72
  },
  "atrules": { ... },
  "rules": {
    "total": 1,
    "size": { "total": 72 }
  },
  "selectors": {
    "total": 1,
    "specificity": { ... }
  },
  "declarations": { ... },
  "properties": { ... },
  "values": {
    "colors": { ... },
    "fontSizes": { ... }
  }
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

## Performance

With caching enabled:

- **First fetch**: ~400-500ms (network + cache write)
- **Cached fetch**: ~100ms (**~5x faster**)
- **Cache size**: ~390KB for typical usage

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
