import { mockModel, openAiModel, respond, type Model } from "./agent";
import { startCall, step, type Call } from "./booking";
import { Store } from "./store";
import type { Channel, Role, RunRecord } from "./types";

export function pickModel(env: Record<string, string | undefined> = process.env): { model: Model; live: boolean } {
  const key = env.OPENAI_API_KEY;
  return key ? { model: openAiModel(key), live: true } : { model: mockModel, live: false };
}

export async function ask(store: Store, question: string, opts: { channel?: Channel; model?: Model; phone?: string; now?: Date } = {}): Promise<RunRecord> {
  const t0 = Date.now();
  const model = opts.model ?? pickModel().model;
  const d = await respond(question, { model, settings: store.settings, spentTodayUsd: store.spentToday(opts.now) });
  return store.addRun({ ...d, channel: opts.channel ?? "chat", question, latencyMs: Date.now() - t0, customerPhone: opts.phone });
}

/** One caller turn. A finished handover is logged as a run so the person who picks up sees the call. */
export function callTurn(store: Store, call: Call | null, utterance: string | null, now = new Date()): Call {
  if (!call || utterance === null) return startCall();
  const before = call.state;
  const next = step(call, utterance, { now, bookings: store.bookings, book: (b) => store.addBooking(b) });
  if (before !== "handover" && next.state === "handover") {
    store.addRun({
      channel: "call", question: next.transcript.filter((t) => t.who === "caller").map((t) => t.text).join(" / ") || "(no speech)",
      outcome: "handover", reason: next.handoverReason ?? "handover", sources: [], confidence: 0, costUsd: 0, latencyMs: 0, customerPhone: next.phone,
    });
  }
  return next;
}

export const asRole = (r: string | undefined): Role => (r === "admin" || r === "agent" ? r : "viewer");
