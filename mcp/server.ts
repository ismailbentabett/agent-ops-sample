import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { assertCan, isRole, maskPhone } from "../src/lib/auth";
import { availableTimes } from "../src/lib/booking";
import { retrieve } from "../src/lib/kb";
import { Store } from "../src/lib/store";
import type { Role } from "../src/lib/types";

/**
 * MCP server so Claude can work with the same data as the dashboard, with the same roles.
 * Default role is "viewer" and writes are off, so a fresh install can read stats and documents only.
 */
export function buildMcpServer(opts: { role?: Role; allowWrite?: boolean; store?: Store } = {}) {
  const role = opts.role ?? "viewer";
  const allowWrite = opts.allowWrite ?? false;
  const store = opts.store ?? new Store({ seed: true });
  const server = new McpServer({ name: "kestrel-agent-ops", version: "0.1.0" });
  const ok = (d: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(d, null, 2) }] });
  const run = (fn: () => unknown) => { try { store.audit(role, "mcp_call"); return ok(fn()); } catch (e) { return { isError: true, content: [{ type: "text" as const, text: (e as Error).message }] }; } };

  server.registerTool("search_docs", {
    description: "Search the business documents. Returns the matching sections with their ids, so any answer can cite a source. Read only.",
    inputSchema: { question: z.string().max(500) }, annotations: { readOnlyHint: true },
  }, ({ question }) => run(() => retrieve(question).map((h) => ({ id: h.chunk.id, section: h.chunk.section, text: h.chunk.text, coverage: +h.coverage.toFixed(2) }))));

  server.registerTool("agent_stats", {
    description: "Answered vs handed over, reasons, cost today and alerts. Read only.",
    inputSchema: {}, annotations: { readOnlyHint: true },
  }, () => run(() => store.stats()));

  server.registerTool("recent_runs", {
    description: "Recent agent runs. Phone numbers are masked unless the server role may see personal data. Read only.",
    inputSchema: { limit: z.number().int().min(1).max(50).default(10) }, annotations: { readOnlyHint: true },
  }, ({ limit }) => run(() => store.recentRuns(role, limit)));

  server.registerTool("list_bookings", {
    description: "Bookings for a date, with free times. Needs a role that may view bookings. Read only.",
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }, annotations: { readOnlyHint: true },
  }, ({ date }) => run(() => {
    assertCan(role, "view_bookings");
    return { date, bookings: store.bookings.filter((b) => b.date === date).map((b) => ({ ...b, phone: maskPhone(b.phone) })), freeTimes: availableTimes(store.bookings, date) };
  }));

  if (allowWrite) {
    server.registerTool("create_booking", {
      description: "Create a booking. Needs a role that may create bookings. Refuses a full slot. Logged.",
      inputSchema: { name: z.string().min(1).max(60), phone: z.string().min(8).max(20), service: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) },
      annotations: { readOnlyHint: false, destructiveHint: false },
    }, (b) => run(() => { assertCan(role, "create_booking"); const made = store.addBooking(b); store.audit(role, "mcp_create_booking", made.id); return made; }));
  }
  return server;
}

if (process.argv[1]?.endsWith("server.ts")) {
  const r = process.env.MCP_ROLE;
  buildMcpServer({ role: isRole(r) ? r : "viewer", allowWrite: process.env.MCP_ALLOW_WRITE === "1" })
    .connect(new StdioServerTransport())
    .catch((e) => { console.error(e); process.exit(1); });
}
