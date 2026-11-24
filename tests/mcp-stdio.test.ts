import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Starts the real server as a child process, the way Claude Desktop would.
describe("MCP server over stdio", () => {
  it("starts, lists tools and answers a search with a source id", async () => {
    const t = new StdioClientTransport({ command: "npx", args: ["tsx", "mcp/server.ts"], cwd: process.cwd(), env: { ...process.env, MCP_ROLE: "viewer" } as Record<string, string> });
    const c = new Client({ name: "stdio-test", version: "1" });
    await c.connect(t);
    const names = (await c.listTools()).tools.map((x) => x.name);
    expect(names).toContain("search_docs");
    expect(names).not.toContain("create_booking");
    const r = (await c.callTool({ name: "search_docs", arguments: { question: "how much is a brake inspection" } })) as { content: { text: string }[] };
    expect(JSON.parse(r.content[0].text)[0].id).toBe("price-1");
    await c.close();
  }, 30000);
});
