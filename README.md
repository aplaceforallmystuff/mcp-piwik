# mcp-piwik

[![npm version](https://img.shields.io/npm/v/mcp-piwik.svg)](https://www.npmjs.com/package/mcp-piwik)
[![CI](https://github.com/aplaceforallmystuff/mcp-piwik/actions/workflows/ci.yml/badge.svg)](https://github.com/aplaceforallmystuff/mcp-piwik/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

MCP server for Piwik PRO analytics - query your website analytics data directly from Claude.

## Features

- **List Sites** - View all websites and apps tracked in your Piwik PRO account
- **Analytics Summary** - Get sessions, pageviews, visitors, bounce rate for any site
- **Top Pages** - See your most visited pages
- **Traffic Sources** - Understand where your traffic comes from
- **Goals & Conversions** - Track goal completions and revenue
- **Custom Queries** - Run flexible analytics queries with any dimensions/metrics

## Installation

### Prerequisites

1. A Piwik PRO account
2. API credentials from [Piwik PRO](https://help.piwik.pro/support/collecting-data/create-api-credentials/)

### Setup

```bash
# Clone and build
git clone https://github.com/aplaceforallmystuff/mcp-piwik.git
cd mcp-piwik
npm install
npm run build
```

## Configuration

### Claude Code

```bash
claude mcp add piwik -s user \
  --env PIWIK_ACCOUNT=your-account-name \
  --env PIWIK_CLIENT_ID=your-client-id \
  --env PIWIK_CLIENT_SECRET=your-client-secret \
  -- node /path/to/mcp-piwik/dist/index.js
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "piwik": {
      "command": "node",
      "args": ["/path/to/mcp-piwik/dist/index.js"],
      "env": {
        "PIWIK_ACCOUNT": "your-account-name",
        "PIWIK_CLIENT_ID": "your-client-id",
        "PIWIK_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

Replace:
- `your-account-name` - Your Piwik PRO subdomain (e.g., if your URL is `example.piwik.pro`, use `example`)
- `your-client-id` - OAuth client ID from API credentials
- `your-client-secret` - OAuth client secret from API credentials

## Available Tools

### piwik_list_sites
List all websites and apps tracked in your Piwik PRO account.

### piwik_analytics_summary
Get analytics summary (sessions, pageviews, visitors, bounce rate, avg session time) for a site.

**Parameters:**
- `siteId` (required) - Site/app ID from piwik_list_sites
- `dateFrom` (optional) - Start date YYYY-MM-DD (default: 30 days ago)
- `dateTo` (optional) - End date YYYY-MM-DD (default: today)

### piwik_top_pages
Get top pages by pageviews.

**Parameters:**
- `siteId` (required) - Site/app ID
- `dateFrom` (optional) - Start date
- `dateTo` (optional) - End date
- `limit` (optional) - Number of results (default: 10)

### piwik_traffic_sources
Get traffic sources breakdown (source/medium, sessions, visitors, bounce rate).

**Parameters:**
- `siteId` (required) - Site/app ID
- `dateFrom` (optional) - Start date
- `dateTo` (optional) - End date

### piwik_goals
Get goal completions and conversion data.

**Parameters:**
- `siteId` (required) - Site/app ID
- `dateFrom` (optional) - Start date
- `dateTo` (optional) - End date

### piwik_custom_query
Run a custom analytics query with specified dimensions and metrics.

**Parameters:**
- `siteId` (required) - Site/app ID
- `columns` (required) - Array of column IDs (e.g., `["sessions", "page_views", "country"]`)
- `dateFrom` (optional) - Start date
- `dateTo` (optional) - End date
- `limit` (optional) - Number of results (default: 50)

### piwik_available_columns
List common dimensions and metrics available for queries.

## Example Usage

```
"Show me the top 10 pages on my site for the last 7 days"

"What are my traffic sources this month?"

"Give me an analytics summary for December"

"Run a custom query for sessions and visitors by country"
```

## License

MIT

## Author

Jim Christian - [https://jimchristian.net](https://jimchristian.net)
