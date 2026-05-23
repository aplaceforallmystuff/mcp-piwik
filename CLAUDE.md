# CLAUDE.md - mcp-piwik

MCP server for querying Piwik PRO analytics data.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js (ES modules)
- **Protocol:** Model Context Protocol (MCP)
- **Build:** TypeScript compiler (tsc)
- **Validation:** Zod (schema validation for tool params)

## Architecture

```
src/
  index.ts          # Server, OAuth token management, all tool handlers
  cli.ts            # CLI entry point
```

## Development Commands

```bash
npm run build       # tsc
npm run dev         # tsc --watch
npm start           # node dist/index.js
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PIWIK_ACCOUNT` | Yes | Piwik PRO subdomain (e.g., `example` for example.piwik.pro) |
| `PIWIK_CLIENT_ID` | Yes | OAuth client ID |
| `PIWIK_CLIENT_SECRET` | Yes | OAuth client secret |

## Tools (7)

`piwik_list_sites`, `piwik_analytics_summary`, `piwik_top_pages`, `piwik_traffic_sources`, `piwik_goals`, `piwik_custom_query`, `piwik_available_columns`

## Key Patterns

- Uses `McpServer` class from MCP SDK (high-level API with `server.tool()`)
- Zod schemas for parameter validation
- OAuth2 client_credentials flow with token caching (60s buffer before expiry)
- `sanitizeError()` strips sensitive details from error messages
- All analytics queries POST to `/api/analytics/v1/query/`
- All three env vars required at startup (exits if missing)

## Pre-Publish

Run `/publish-mcp` before any `npm publish` — mandatory pipeline that handles tests, secret scan, sanitize, docs check, version bump, tag, push, and publish in strict order. Do not run `npm publish` directly.
