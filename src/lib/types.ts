export type Role = "admin" | "agent" | "viewer";
export type Outcome = "answered" | "handover";
export type Channel = "chat" | "call";

export interface Chunk { id: string; doc: string; section: string; text: string }
export interface Hit { chunk: Chunk; score: number; coverage: number }

export interface Decision {
  outcome: Outcome;
  reason: string;
  answer?: string;      // shown to the customer only when outcome is "answered"
  draft?: string;       // kept for the human when the agent was unsure
  sources: string[];
  confidence: number;
  costUsd: number;
}

export interface RunRecord extends Decision {
  id: string;
  at: string;
  channel: Channel;
  question: string;
  latencyMs: number;
  customerPhone?: string;
  handled?: { by: string; note: string; at: string };
}

export interface Booking { id: string; name: string; phone: string; service: string; date: string; time: string }
export interface Settings { confidenceThreshold: number; dailyCostLimitUsd: number }
export interface AuditEntry { at: string; role: Role; action: string; detail: string }
