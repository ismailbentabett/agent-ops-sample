import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "../mcp/server";
import { Forbidden, can, maskPhone, redactRun } from "@/lib/auth";
import { mockModel } from "@/lib/agent";
import { ask, callTurn } from "@/lib/service";
import { Store } from "@/lib/store";

const base = { channel: "chat" as const, outcome: "handover" as const, sources: [], confidence: 0, costUsd: 0, latencyMs: 1 };

describe("roles and data access", () => {
  it("viewer: runs only", () => { expect(can("viewer", "view_runs")).toBe(true); expect(can("viewer", "view_pii")).toBe(false); expect(can("viewer", "answer_handover")).toBe(false); });
  it("agent can answer handovers but not change settings", () => { expect(can("agent", "answer_handover")).toBe(true); expect(can("agent", "edit_settings")).toBe(false); });
  it("only admin edits settings and reads the audit log", () => { expect(can("admin", "edit_settings")).toBe(true); expect(can("admin", "view_audit")).toBe(true); expect(can("agent", "view_audit")).toBe(false); });
  it("masks a phone number", () => expect(maskPhone("0412 555 019")).toBe("•••• 5019"));
  it("viewer sees numbers removed from the question and the phone masked", () => {
    const s = new Store();
    s.addRun({ ...base, reason: "x", question: "call me on 0412 555 019 please", customerPhone: "0412555019" });
    const v = s.recentRuns("viewer")[0];
    expect(v.question).toBe("call me on [number] please");
    expect(v.customerPhone).toBe("•••• 5019");
    expect(s.recentRuns("agent")[0].question).toContain("0412 555 019");
  });
  it("viewer still sees a date, only phone-like numbers are removed", () => {
    const s = new Store(); s.addRun({ ...base, reason: "x", question: "sunday 2026-11-29 or +61 412 555 019" });
    expect(s.recentRuns("viewer")[0].question).toBe("sunday 2026-11-29 or [number]");
  });
  it("viewer cannot close a handover", () => {
    const s = new Store(); const r = s.addRun({ ...base, reason: "x", question: "q" });
    expect(() => s.resolve("viewer", r.id, "v", "note")).toThrow(Forbidden);
  });
  it("agent closes a handover with a note, and it is audited", () => {
    const s = new Store(); const r = s.addRun({ ...base, reason: "x", question: "q" });
    expect(() => s.resolve("agent", r.id, "Sam", "  ")).toThrow(/note is required/);
    s.resolve("agent", r.id, "Sam", "Called back, booked in");
    expect(s.queue("agent")).toHaveLength(0);
    expect(s.auditLog.at(-1)?.action).toBe("resolve_handover");
    expect(() => s.resolve("agent", r.id, "Sam", "again")).toThrow(/Already handled/);
  });
  it("settings: admin only, with limits, audited", () => {
    const s = new Store();
    expect(() => s.updateSettings("agent", { confidenceThreshold: 0.8 })).toThrow(Forbidden);
    expect(() => s.updateSettings("admin", { confidenceThreshold: 0.1 })).toThrow(/between/);
    expect(() => s.updateSettings("admin", { dailyCostLimitUsd: 0 })).toThrow(/between/);
    expect(s.updateSettings("admin", { confidenceThreshold: 0.8 }).confidenceThreshold).toBe(0.8);
    expect(s.auditLog.at(-1)?.action).toBe("update_settings");
  });
});

describe("monitoring", () => {
  it("counts answered and handed over, with reasons", async () => {
    const s = new Store();
    await ask(s, "how much is a brake inspection", { model: mockModel });
    await ask(s, "I want a refund", { model: mockModel });
    await ask(s, "refund please", { model: mockModel });
    const st = s.stats();
    expect(st.total).toBe(3); expect(st.answered).toBe(1); expect(st.handover).toBe(2);
    expect(st.reasons[0]).toEqual({ reason: "sensitive topic", count: 2 });
  });
  it("alerts when more than 40% of 5+ runs are handed over", async () => {
    const s = new Store();
    for (let i = 0; i < 5; i++) await ask(s, "do you repair electric bikes", { model: mockModel });
    expect(s.stats().alerts.join()).toMatch(/Handover rate 100%/);
  });
  it("no alert on a healthy day", async () => {
    const s = new Store();
    for (let i = 0; i < 5; i++) await ask(s, "how much is a brake inspection", { model: mockModel });
    expect(s.stats().alerts).toEqual([]);
  });
  it("cost limit: spend adds up and the next run is handed over", async () => {
    const s = new Store(); s.updateSettings("admin", { dailyCostLimitUsd: 0.01 });
    const pricey = async () => ({ raw: '{"answer":"From 189 dollars","sources":["price-1"],"confidence":0.9}', costUsd: 0.02 });
    expect((await ask(s, "how much is a service", { model: pricey })).outcome).toBe("answered");
    const r = await ask(s, "how much is a service", { model: pricey });
    expect(r.reason).toBe("daily cost limit reached");
    expect(s.stats().alerts.join()).toMatch(/Cost today/);
  });
  it("a call that ends in a handover appears in the queue", () => {
    const s = new Store();
    let c = callTurn(s, null, null);
    c = callTurn(s, c, "I want to speak to a manager");
    expect(c.state).toBe("handover");
    expect(s.queue("agent")[0].channel).toBe("call");
    callTurn(s, c, "hello?");
    expect(s.runs).toHaveLength(1); // logged once
  });
  it("store refuses a third booking in a slot with two bays", () => {
    const s = new Store(); const b = { name: "A", phone: "0400000000", service: "x", date: "2026-12-01", time: "09:00" };
    s.addBooking(b); s.addBooking(b);
    expect(() => s.addBooking(b)).toThrow(/full/);
  });
});

describe("redactRun for a role with personal data access", () => {
  it("returns the run unchanged", () => { const s = new Store(); const r = s.addRun({ ...base, reason: "x", question: "0412 555 019" }); expect(redactRun(r, "admin")).toBe(r); });
});

async function connect(opts: Parameters<typeof buildMcpServer>[0]) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await buildMcpServer(opts).connect(b);
  const c = new Client({ name: "t", version: "1" }); await c.connect(a); return c;
}
const call = async (c: Client, name: string, args: Record<string, unknown> = {}) => {
  const r = await c.callTool({ name, arguments: args }) as { isError?: boolean; content: { text: string }[] };
  return { error: !!r.isError, text: r.content[0].text };
};

describe("MCP server", () => {
  it("fresh install: no write tool", async () => {
    const names = (await (await connect({})).listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("create_booking");
    expect(names).toContain("search_docs");
  });
  it("search_docs returns ids so answers can cite sources", async () => {
    const r = await call(await connect({}), "search_docs", { question: "how much is a brake inspection" });
    expect(JSON.parse(r.text)[0].id).toBe("price-1");
  });
  it("viewer cannot list bookings", async () => {
    const r = await call(await connect({ role: "viewer" }), "list_bookings", { date: "2026-11-25" });
    expect(r.error).toBe(true); expect(r.text).toMatch(/cannot view bookings/);
  });
  it("agent lists bookings with masked phones", async () => {
    const s = new Store(); s.addBooking({ name: "A", phone: "0412555019", service: "x", date: "2026-12-01", time: "09:00" });
    const r = await call(await connect({ role: "agent", store: s }), "list_bookings", { date: "2026-12-01" });
    expect(r.text).toContain("•••• 5019"); expect(r.text).not.toContain("0412555019");
  });
  it("viewer sees masked runs through recent_runs", async () => {
    const s = new Store(); s.addRun({ ...base, reason: "x", question: "ring 0412 555 019" });
    const r = await call(await connect({ role: "viewer", store: s }), "recent_runs", {});
    expect(r.text).toContain("[number]");
  });
  it("write tool exists only when enabled, and the viewer role is still refused", async () => {
    const viewer = await connect({ role: "viewer", allowWrite: true });
    const args = { name: "A", phone: "0412555019", service: "Standard service", date: "2026-12-01", time: "09:00" };
    expect((await call(viewer, "create_booking", args)).error).toBe(true);
    const agent = await connect({ role: "agent", allowWrite: true });
    expect((await call(agent, "create_booking", args)).error).toBe(false);
  });
  it("a full slot comes back as a tool error", async () => {
    const s = new Store(); const b = { name: "A", phone: "0412555019", service: "x", date: "2026-12-01", time: "09:00" };
    s.addBooking(b); s.addBooking(b);
    const r = await call(await connect({ role: "agent", allowWrite: true, store: s }), "create_booking", b);
    expect(r.error).toBe(true); expect(r.text).toMatch(/full/);
  });
});
