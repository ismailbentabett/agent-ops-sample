import { assertCan, redactRun } from "./auth";
import { BAYS } from "./booking";
import type { AuditEntry, Booking, Role, RunRecord, Settings } from "./types";

const DEFAULTS: Settings = { confidenceThreshold: 0.7, dailyCostLimitUsd: 5 };

export class Store {
  settings: Settings = { ...DEFAULTS };
  runs: RunRecord[] = [];
  bookings: Booking[] = [];
  auditLog: AuditEntry[] = [];
  private n = 0;
  private b = 0;

  constructor(opts: { seed?: boolean } = {}) { if (opts.seed) this.seed(); }

  audit(role: Role, action: string, detail = "") { this.auditLog.push({ at: new Date().toISOString(), role, action, detail }); }

  addRun(r: Omit<RunRecord, "id" | "at"> & { at?: string }): RunRecord {
    const run: RunRecord = { ...r, id: `R-${String(++this.n).padStart(4, "0")}`, at: r.at ?? new Date().toISOString() };
    this.runs.push(run);
    return run;
  }

  spentToday(now = new Date()): number {
    const day = now.toISOString().slice(0, 10);
    return this.runs.filter((r) => r.at.startsWith(day)).reduce((s, r) => s + r.costUsd, 0);
  }

  addBooking(b: Omit<Booking, "id">): Booking {
    if (this.bookings.filter((x) => x.date === b.date && x.time === b.time).length >= BAYS) throw new Error("Slot is full");
    const booking: Booking = { ...b, id: `KAC-${String(++this.b + 1000)}` };
    this.bookings.push(booking);
    return booking;
  }

  queue(role: Role): RunRecord[] {
    assertCan(role, "view_runs");
    return this.runs.filter((r) => r.outcome === "handover" && !r.handled).map((r) => redactRun(r, role));
  }

  resolve(role: Role, id: string, by: string, note: string): RunRecord {
    assertCan(role, "answer_handover");
    if (!note.trim()) throw new Error("A note is required to close a handover");
    const run = this.runs.find((r) => r.id === id);
    if (!run) throw new Error(`No run ${id}`);
    if (run.outcome !== "handover") throw new Error("Only handovers can be closed");
    if (run.handled) throw new Error("Already handled");
    run.handled = { by, note: note.trim(), at: new Date().toISOString() };
    this.audit(role, "resolve_handover", `${id}: ${note.trim()}`);
    return run;
  }

  updateSettings(role: Role, patch: Partial<Settings>): Settings {
    assertCan(role, "edit_settings");
    const next = { ...this.settings, ...patch };
    if (!(next.confidenceThreshold >= 0.3 && next.confidenceThreshold <= 0.95)) throw new Error("Confidence threshold must be between 0.3 and 0.95");
    if (!(next.dailyCostLimitUsd > 0 && next.dailyCostLimitUsd <= 100)) throw new Error("Daily cost limit must be between 0 and 100 dollars");
    this.settings = next;
    this.audit(role, "update_settings", JSON.stringify(patch));
    return next;
  }

  recentRuns(role: Role, n = 12): RunRecord[] {
    assertCan(role, "view_runs");
    return this.runs.slice(-n).reverse().map((r) => redactRun(r, role));
  }

  stats(now = new Date()) {
    const total = this.runs.length;
    const answered = this.runs.filter((r) => r.outcome === "answered").length;
    const handover = total - answered;
    const reasons = new Map<string, number>();
    for (const r of this.runs) if (r.outcome === "handover") {
      const key = r.reason.replace(/^sensitive topic: .*/, "sensitive topic");
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
    const reasonList = [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const rate = total ? (handover / total) * 100 : 0;
    const spent = this.spentToday(now);
    const alerts: string[] = [];
    if (total >= 5 && rate > 40) alerts.push(`Handover rate ${rate.toFixed(0)}% is above 40%`);
    if (spent >= this.settings.dailyCostLimitUsd * 0.8) alerts.push(`Cost today is ${((spent / this.settings.dailyCostLimitUsd) * 100).toFixed(0)}% of the daily limit`);
    const modelFails = this.runs.filter((r) => /^model (error|timeout)|unusable/.test(r.reason)).length;
    if (modelFails >= 3) alerts.push(`${modelFails} model failures so far`);
    const unhandled = this.runs.filter((r) => r.outcome === "handover" && !r.handled).length;
    if (unhandled >= 5) alerts.push(`${unhandled} handovers are waiting for a person`);
    return {
      total, answered, handover, handoverRatePct: +rate.toFixed(1), reasons: reasonList, alerts, unhandled,
      costTodayUsd: +spent.toFixed(4), avgLatencyMs: total ? Math.round(this.runs.reduce((s, r) => s + r.latencyMs, 0) / total) : 0,
    };
  }

  private seed() {
    const t = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    const mk = (q: string, outcome: "answered" | "handover", reason: string, extra: Partial<RunRecord> = {}) =>
      this.addRun({ channel: "chat", question: q, outcome, reason, sources: [], confidence: outcome === "answered" ? 0.9 : 0, costUsd: 0.0004, latencyMs: 900, ...extra });
    mk("What time do you open on Saturday?", "answered", "answered from documents", { sources: ["hours-1"], at: t(7), latencyMs: 820 });
    mk("How much is a brake inspection?", "answered", "answered from documents", { sources: ["price-1"], at: t(6), latencyMs: 760 });
    mk("Can I get a courtesy car for a long job?", "answered", "answered from documents", { sources: ["car-1"], at: t(5), latencyMs: 1010 });
    mk("I want a refund for my last service, call me on 0412 555 019", "handover", "sensitive topic: refund", { at: t(4), costUsd: 0, customerPhone: "0412555019" });
    mk("Do you fix electric bikes?", "handover", "no matching source", { at: t(3), costUsd: 0 });
    mk("Is the warranty valid if I serviced elsewhere?", "handover", "low confidence", { at: t(2), confidence: 0.55, draft: "Parts and labour are covered for 12 months or 20,000 km.", sources: ["warr-1"] });
    mk("Do you take cash?", "answered", "answered from documents", { sources: ["pay-1"], at: t(1), latencyMs: 700 });
    this.bookings.push({ id: "KAC-1000", name: "Sample Customer", phone: "0400000000", service: "Standard service", date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), time: "09:00" });
    this.b = 0;
  }
}
