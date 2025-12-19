#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Configuration from environment
const PIWIK_ACCOUNT = process.env.PIWIK_ACCOUNT;
const PIWIK_CLIENT_ID = process.env.PIWIK_CLIENT_ID;
const PIWIK_CLIENT_SECRET = process.env.PIWIK_CLIENT_SECRET;

if (!PIWIK_ACCOUNT) {
  console.error("Error: PIWIK_ACCOUNT environment variable is required");
  process.exit(1);
}

const BASE_URL = `https://${PIWIK_ACCOUNT}.piwik.pro`;

// Token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  if (!PIWIK_CLIENT_ID || !PIWIK_CLIENT_SECRET) {
    throw new Error("PIWIK_CLIENT_ID and PIWIK_CLIENT_SECRET must be set");
  }

  const response = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: PIWIK_CLIENT_ID,
      client_secret: PIWIK_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Auth failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  return accessToken!;
}

async function piwikRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} - ${text}`);
  }

  return response.json();
}

// Create MCP server
const server = new McpServer({
  name: "mcp-piwik",
  version: "1.0.0",
});

// Tool: List all sites/apps
server.tool(
  "piwik_list_sites",
  "List all websites and apps tracked in Piwik PRO",
  {},
  async () => {
    try {
      const data = await piwikRequest("/api/apps/v2");

      const sites = data.data?.map((site: any) => ({
        id: site.id,
        name: site.attributes?.name,
        type: site.type,
        createdAt: site.attributes?.createdAt,
      })) || [];

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ sites, total: sites.length }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get analytics summary
server.tool(
  "piwik_analytics_summary",
  "Get analytics summary for a site (sessions, pageviews, visitors)",
  {
    siteId: z.string().describe("The site/app ID from piwik_list_sites"),
    dateFrom: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 30 days ago"),
    dateTo: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today"),
  },
  async ({ siteId, dateFrom, dateTo }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const from = dateFrom || thirtyDaysAgo;
      const to = dateTo || today;

      const query = {
        relative_date: "custom",
        date_from: from,
        date_to: to,
        website_id: siteId,
        columns: [
          { column_id: "sessions" },
          { column_id: "page_views" },
          { column_id: "visitors" },
          { column_id: "bounce_rate" },
          { column_id: "avg_session_time" },
        ],
        order_by: [[0, "desc"]],
        offset: 0,
        limit: 1,
      };

      const data = await piwikRequest("/api/analytics/v1/query/", {
        method: "POST",
        body: JSON.stringify(query),
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            period: { from, to },
            siteId,
            data: data.data,
            meta: data.meta,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get top pages
server.tool(
  "piwik_top_pages",
  "Get top pages by pageviews for a site",
  {
    siteId: z.string().describe("The site/app ID"),
    dateFrom: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 30 days ago"),
    dateTo: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today"),
    limit: z.number().optional().describe("Number of results (default 10)"),
  },
  async ({ siteId, dateFrom, dateTo, limit = 10 }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const from = dateFrom || thirtyDaysAgo;
      const to = dateTo || today;

      const query = {
        relative_date: "custom",
        date_from: from,
        date_to: to,
        website_id: siteId,
        columns: [
          { column_id: "page_url" },
          { column_id: "page_views" },
          { column_id: "visitors" },
          { column_id: "avg_time_on_page" },
        ],
        order_by: [[1, "desc"]],
        offset: 0,
        limit,
      };

      const data = await piwikRequest("/api/analytics/v1/query/", {
        method: "POST",
        body: JSON.stringify(query),
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            period: { from, to },
            siteId,
            topPages: data.data,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get traffic sources
server.tool(
  "piwik_traffic_sources",
  "Get traffic sources breakdown for a site",
  {
    siteId: z.string().describe("The site/app ID"),
    dateFrom: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 30 days ago"),
    dateTo: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today"),
  },
  async ({ siteId, dateFrom, dateTo }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const from = dateFrom || thirtyDaysAgo;
      const to = dateTo || today;

      const query = {
        relative_date: "custom",
        date_from: from,
        date_to: to,
        website_id: siteId,
        columns: [
          { column_id: "source_medium" },
          { column_id: "sessions" },
          { column_id: "visitors" },
          { column_id: "bounce_rate" },
        ],
        order_by: [[1, "desc"]],
        offset: 0,
        limit: 20,
      };

      const data = await piwikRequest("/api/analytics/v1/query/", {
        method: "POST",
        body: JSON.stringify(query),
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            period: { from, to },
            siteId,
            sources: data.data,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get goals/conversions
server.tool(
  "piwik_goals",
  "Get goal completions and conversion data",
  {
    siteId: z.string().describe("The site/app ID"),
    dateFrom: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 30 days ago"),
    dateTo: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today"),
  },
  async ({ siteId, dateFrom, dateTo }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const from = dateFrom || thirtyDaysAgo;
      const to = dateTo || today;

      const query = {
        relative_date: "custom",
        date_from: from,
        date_to: to,
        website_id: siteId,
        columns: [
          { column_id: "goal_name" },
          { column_id: "goal_conversions" },
          { column_id: "goal_conversion_rate" },
          { column_id: "goal_revenue" },
        ],
        order_by: [[1, "desc"]],
        offset: 0,
        limit: 50,
      };

      const data = await piwikRequest("/api/analytics/v1/query/", {
        method: "POST",
        body: JSON.stringify(query),
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            period: { from, to },
            siteId,
            goals: data.data,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Custom analytics query
server.tool(
  "piwik_custom_query",
  "Run a custom analytics query with specified dimensions and metrics",
  {
    siteId: z.string().describe("The site/app ID"),
    columns: z.array(z.string()).describe("Column IDs to query (e.g., ['sessions', 'page_views', 'country'])"),
    dateFrom: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 30 days ago"),
    dateTo: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today"),
    limit: z.number().optional().describe("Number of results (default 50)"),
  },
  async ({ siteId, columns, dateFrom, dateTo, limit = 50 }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const from = dateFrom || thirtyDaysAgo;
      const to = dateTo || today;

      const query = {
        relative_date: "custom",
        date_from: from,
        date_to: to,
        website_id: siteId,
        columns: columns.map(col => ({ column_id: col })),
        order_by: [[0, "desc"]],
        offset: 0,
        limit,
      };

      const data = await piwikRequest("/api/analytics/v1/query/", {
        method: "POST",
        body: JSON.stringify(query),
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            period: { from, to },
            siteId,
            columns,
            data: data.data,
            meta: data.meta,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get available columns/metrics (static reference)
server.tool(
  "piwik_available_columns",
  "List common columns (dimensions and metrics) available for analytics queries",
  {},
  async () => {
    const columns = {
      metrics: [
        "sessions", "visitors", "page_views", "bounce_rate", "avg_session_time",
        "avg_time_on_page", "entries", "exits", "goal_conversions",
        "goal_conversion_rate", "goal_revenue", "unique_page_views"
      ],
      dimensions: [
        "page_url", "page_title", "referrer_type", "source_medium", "source",
        "medium", "campaign", "country", "city", "device_type", "browser_name",
        "operating_system", "session_entry_url", "session_exit_url",
        "custom_event_category", "custom_event_action", "custom_event_name",
        "goal_name", "timestamp", "session_date"
      ],
      note: "Use these column_id values in the columns array for piwik_custom_query. " +
            "For the complete list, see: https://developers.piwik.pro/reference/metrics-dimensions"
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(columns, null, 2),
      }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Piwik PRO MCP server running");
}

main().catch(console.error);
