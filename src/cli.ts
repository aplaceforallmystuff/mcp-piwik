#!/usr/bin/env node

/**
 * Piwik PRO CLI - Query analytics data from the command line.
 *
 * Saves ~1500 tokens of MCP overhead per session.
 */

// Configuration from environment
const PIWIK_ACCOUNT = process.env.PIWIK_ACCOUNT;
const PIWIK_CLIENT_ID = process.env.PIWIK_CLIENT_ID;
const PIWIK_CLIENT_SECRET = process.env.PIWIK_CLIENT_SECRET;

if (!PIWIK_ACCOUNT || !PIWIK_CLIENT_ID || !PIWIK_CLIENT_SECRET) {
  console.error("Error: Required environment variables:");
  console.error("  PIWIK_ACCOUNT - Your Piwik Pro account name");
  console.error("  PIWIK_CLIENT_ID - API client ID");
  console.error("  PIWIK_CLIENT_SECRET - API client secret");
  process.exit(1);
}

const BASE_URL = `https://${PIWIK_ACCOUNT}.piwik.pro`;

// Token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
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
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return accessToken;
}

async function piwikRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

function getDateRange(dateFrom?: string, dateTo?: string): { from: string; to: string } {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return {
    from: dateFrom || thirtyDaysAgo,
    to: dateTo || today,
  };
}

function parseArgs(args: string[]): { command: string; options: Record<string, string> } {
  const command = args[0] || "help";
  const options: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      options[key] = value;
    }
  }

  return { command, options };
}

// Commands

async function listSites(asJson: boolean) {
  interface Site {
    id: string;
    type: string;
    attributes?: { name?: string; createdAt?: string };
  }

  const data = await piwikRequest<{ data?: Site[] }>("/api/apps/v2");
  const sites = data.data?.map((s) => ({
    id: s.id,
    name: s.attributes?.name || "Unknown",
    type: s.type,
  })) || [];

  if (asJson) {
    console.log(JSON.stringify({ sites }, null, 2));
    return;
  }

  console.log(`\n${"Site ID".padEnd(40)} ${"Name".padEnd(30)} Type`);
  console.log("-".repeat(80));
  for (const site of sites) {
    console.log(`${site.id.padEnd(40)} ${site.name.padEnd(30)} ${site.type}`);
  }
  console.log(`\n${sites.length} sites found`);
}

async function getSummary(siteId: string, dateFrom?: string, dateTo?: string, asJson?: boolean) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const query = {
    date_from: from,
    date_to: to,
    website_id: siteId,
    columns: [
      { column_id: "sessions" },
      { column_id: "page_views" },
      { column_id: "visitors" },
      { column_id: "bounce_rate" },
    ],
    order_by: [[0, "desc"]],
    offset: 0,
    limit: 1,
  };

  const data = await piwikRequest<{ data?: unknown[]; meta?: Record<string, unknown> }>("/api/analytics/v1/query/", {
    method: "POST",
    body: JSON.stringify(query),
  });

  if (asJson) {
    console.log(JSON.stringify({ period: { from, to }, data: data.data, meta: data.meta }, null, 2));
    return;
  }

  console.log(`\nAnalytics Summary: ${from} to ${to}\n`);

  if (data.data && data.data.length > 0) {
    const row = data.data[0] as number[];
    console.log(`  Sessions:    ${row[0]?.toLocaleString() || 0}`);
    console.log(`  Page Views:  ${row[1]?.toLocaleString() || 0}`);
    console.log(`  Visitors:    ${row[2]?.toLocaleString() || 0}`);
    console.log(`  Bounce Rate: ${((row[3] || 0) * 100).toFixed(1)}%`);
  } else {
    console.log("  No data for this period");
  }
}

async function getTopPages(siteId: string, dateFrom?: string, dateTo?: string, limit = 10, asJson?: boolean) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const query = {
    date_from: from,
    date_to: to,
    website_id: siteId,
    columns: [
      { column_id: "page_url" },
      { column_id: "page_views" },
      { column_id: "visitors" },
    ],
    order_by: [[1, "desc"]],
    offset: 0,
    limit,
  };

  const data = await piwikRequest<{ data?: unknown[] }>("/api/analytics/v1/query/", {
    method: "POST",
    body: JSON.stringify(query),
  });

  if (asJson) {
    console.log(JSON.stringify({ period: { from, to }, topPages: data.data }, null, 2));
    return;
  }

  console.log(`\nTop Pages: ${from} to ${to}\n`);
  console.log(`${"Page URL".padEnd(60)} ${"Views".padStart(8)} ${"Visitors".padStart(10)}`);
  console.log("-".repeat(80));

  for (const row of (data.data || []) as [string, number, number][]) {
    const url = row[0].length > 58 ? row[0].slice(0, 55) + "..." : row[0];
    console.log(`${url.padEnd(60)} ${row[1].toLocaleString().padStart(8)} ${row[2].toLocaleString().padStart(10)}`);
  }
}

async function getTrafficSources(siteId: string, dateFrom?: string, dateTo?: string, asJson?: boolean) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const query = {
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

  const data = await piwikRequest<{ data?: unknown[] }>("/api/analytics/v1/query/", {
    method: "POST",
    body: JSON.stringify(query),
  });

  if (asJson) {
    console.log(JSON.stringify({ period: { from, to }, sources: data.data }, null, 2));
    return;
  }

  console.log(`\nTraffic Sources: ${from} to ${to}\n`);
  console.log(`${"Source / Medium".padEnd(40)} ${"Sessions".padStart(10)} ${"Visitors".padStart(10)} ${"Bounce".padStart(8)}`);
  console.log("-".repeat(70));

  for (const row of (data.data || []) as [string, number, number, number][]) {
    const source = row[0].length > 38 ? row[0].slice(0, 35) + "..." : row[0];
    const bounce = ((row[3] || 0) * 100).toFixed(1) + "%";
    console.log(`${source.padEnd(40)} ${row[1].toLocaleString().padStart(10)} ${row[2].toLocaleString().padStart(10)} ${bounce.padStart(8)}`);
  }
}

async function getGoals(siteId: string, dateFrom?: string, dateTo?: string, asJson?: boolean) {
  const { from, to } = getDateRange(dateFrom, dateTo);

  const query = {
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

  const data = await piwikRequest<{ data?: unknown[] }>("/api/analytics/v1/query/", {
    method: "POST",
    body: JSON.stringify(query),
  });

  if (asJson) {
    console.log(JSON.stringify({ period: { from, to }, goals: data.data }, null, 2));
    return;
  }

  console.log(`\nGoals: ${from} to ${to}\n`);

  if (!data.data || data.data.length === 0) {
    console.log("  No goals configured or no conversions in this period");
    return;
  }

  console.log(`${"Goal Name".padEnd(40)} ${"Conversions".padStart(12)} ${"Rate".padStart(8)} ${"Revenue".padStart(10)}`);
  console.log("-".repeat(72));

  for (const row of data.data as [string, number, number, number][]) {
    const name = row[0].length > 38 ? row[0].slice(0, 35) + "..." : row[0];
    const rate = ((row[2] || 0) * 100).toFixed(1) + "%";
    const revenue = row[3] ? `$${row[3].toFixed(2)}` : "-";
    console.log(`${name.padEnd(40)} ${row[1].toLocaleString().padStart(12)} ${rate.padStart(8)} ${revenue.padStart(10)}`);
  }
}

function showHelp() {
  console.log(`
Piwik PRO CLI - Query analytics data

Usage: piwik <command> [options]

Commands:
  sites                     List all tracked sites
  summary <site-id>         Get analytics summary (sessions, views, visitors)
  pages <site-id>           Get top pages by pageviews
  sources <site-id>         Get traffic sources breakdown
  goals <site-id>           Get goal conversions

Options:
  --from <date>             Start date (YYYY-MM-DD), default: 30 days ago
  --to <date>               End date (YYYY-MM-DD), default: today
  --limit <n>               Number of results (for pages command)
  --json                    Output as JSON

Examples:
  piwik sites
  piwik summary abc123-def456
  piwik pages abc123-def456 --from 2025-12-01 --to 2025-12-28
  piwik sources abc123-def456 --json

Environment Variables:
  PIWIK_ACCOUNT             Your Piwik Pro account name (required)
  PIWIK_CLIENT_ID           API client ID (required)
  PIWIK_CLIENT_SECRET       API client secret (required)
`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);
  const asJson = options.json === "true";

  try {
    switch (command) {
      case "sites":
        await listSites(asJson);
        break;
      case "summary":
        if (!options.site && !args[1]) {
          console.error("Error: Site ID required. Run 'piwik sites' to list available sites.");
          process.exit(1);
        }
        await getSummary(options.site || args[1], options.from, options.to, asJson);
        break;
      case "pages":
        if (!options.site && !args[1]) {
          console.error("Error: Site ID required.");
          process.exit(1);
        }
        await getTopPages(options.site || args[1], options.from, options.to, parseInt(options.limit) || 10, asJson);
        break;
      case "sources":
        if (!options.site && !args[1]) {
          console.error("Error: Site ID required.");
          process.exit(1);
        }
        await getTrafficSources(options.site || args[1], options.from, options.to, asJson);
        break;
      case "goals":
        if (!options.site && !args[1]) {
          console.error("Error: Site ID required.");
          process.exit(1);
        }
        await getGoals(options.site || args[1], options.from, options.to, asJson);
        break;
      case "help":
      case "--help":
      case "-h":
        showHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();
