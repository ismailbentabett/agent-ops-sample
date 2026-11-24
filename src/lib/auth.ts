import type { Role, RunRecord } from "./types";

export type Action = "view_runs" | "view_pii" | "view_bookings" | "answer_handover" | "create_booking" | "edit_settings" | "view_audit";

const P: Record<Role, Action[]> = {
  viewer: ["view_runs"],
  agent: ["view_runs", "view_pii", "view_bookings", "answer_handover", "create_booking"],
  admin: ["view_runs", "view_pii", "view_bookings", "answer_handover", "create_booking", "edit_settings", "view_audit"],
};

export class Forbidden extends Error {
  constructor(role: Role, action: Action) { super(`Role "${role}" cannot ${action.replace("_", " ")}`); }
}

export const can = (role: Role, action: Action) => P[role].includes(action);
export function assertCan(role: Role, action: Action) { if (!can(role, action)) throw new Forbidden(role, action); }
export const isRole = (v: unknown): v is Role => v === "admin" || v === "agent" || v === "viewer";

export function maskPhone(p: string): string { const d = p.replace(/\D/g, ""); return d.length < 4 ? "••••" : `•••• ${d.slice(-4)}`; }

/** Roles without view_pii see runs with phone numbers and long digit strings removed. */
export function redactRun(r: RunRecord, role: Role): RunRecord {
  if (can(role, "view_pii")) return r;
  // Only strings with 9 or more digits count as phone-like, so dates such as 2026-11-29 stay readable.
  const strip = (s: string) => s.replace(/\+?\d[\d\s-]{6,}\d/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[number]" : m));
  return { ...r, question: strip(r.question), answer: r.answer && strip(r.answer), draft: r.draft && strip(r.draft),
    customerPhone: r.customerPhone ? maskPhone(r.customerPhone) : undefined };
}
