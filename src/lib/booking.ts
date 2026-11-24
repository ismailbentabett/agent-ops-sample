import type { Booking } from "./types";

export const SERVICES: Record<string, string> = {
  service: "Standard service", brake: "Brake inspection", tyre: "Tyre rotation", tire: "Tyre rotation", roadworthy: "Roadworthy certificate", rwc: "Roadworthy certificate",
};
export const SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
export const BAYS = 2; // two bookings can share a slot
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const HANDOVER_WORDS = /\b(person|human|manager|operator|someone|agent)\b/i;
const SENSITIVE = /(refund|lawyer|legal|sue|injur|accident|complain|compensat)/i;

export type State = "service" | "date" | "time" | "name" | "phone" | "confirm" | "done" | "handover";
export interface Turn { who: "agent" | "caller"; text: string }
export interface Call {
  state: State; misses: number; transcript: Turn[];
  service?: string; date?: string; time?: string; name?: string; phone?: string;
  bookingId?: string; handoverReason?: string;
}
export interface Ctx { now: Date; bookings: Booking[]; book: (b: Omit<Booking, "id">) => Booking }

export const GREETING = "Thanks for calling Kestrel Auto Care. What would you like to book: a service, a brake inspection, a tyre rotation or a roadworthy?";

export function startCall(): Call { return { state: "service", misses: 0, transcript: [{ who: "agent", text: GREETING }] }; }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayOf = (isoDate: string) => new Date(isoDate + "T00:00:00Z").getUTCDay();
const pretty = (isoDate: string) => `${DAYS[dayOf(isoDate)][0].toUpperCase()}${DAYS[dayOf(isoDate)].slice(1)} ${isoDate}`;

export function availableTimes(bookings: Booking[], date: string): string[] {
  return SLOTS.filter((t) => bookings.filter((b) => b.date === date && b.time === t).length < BAYS);
}

export function parseDate(text: string, now: Date): string | null {
  const t = text.toLowerCase();
  const m = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (m) return m[1];
  if (/\btoday\b/.test(t)) return iso(now);
  if (/\btomorrow\b/.test(t)) return iso(new Date(now.getTime() + 86_400_000));
  const idx = DAYS.findIndex((d) => t.includes(d));
  if (idx >= 0) {
    const diff = (idx - now.getUTCDay() + 7) % 7 || 7; // a named weekday means the next one
    return iso(new Date(now.getTime() + diff * 86_400_000));
  }
  return null;
}

export function parseTime(text: string): string | null {
  const t = text.toLowerCase();
  let m = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/) ?? t.match(/\b(\d{1,2})()\s*(am|pm)\b/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function say(c: Call, text: string): Call { return { ...c, transcript: [...c.transcript, { who: "agent", text }] }; }
function miss(c: Call, text: string): Call {
  const n = c.misses + 1;
  if (n >= 3) return toHuman(c, "caller not understood three times");
  return say({ ...c, misses: n }, text);
}
function toHuman(c: Call, reason: string): Call {
  return say({ ...c, state: "handover", handoverReason: reason }, "I will pass you to a colleague who can help. Please hold.");
}

/** One caller turn in, one agent turn out. Booking rules are plain code. */
export function step(call: Call, utterance: string, ctx: Ctx): Call {
  if (call.state === "done" || call.state === "handover") return call;
  const c: Call = { ...call, transcript: [...call.transcript, { who: "caller", text: utterance }] };
  if (SENSITIVE.test(utterance)) return toHuman(c, "sensitive topic");
  if (HANDOVER_WORDS.test(utterance)) return toHuman(c, "caller asked for a person");

  switch (c.state) {
    case "service": {
      const key = Object.keys(SERVICES).find((k) => utterance.toLowerCase().includes(k));
      if (!key) return miss(c, "Sorry, which would you like: a service, a brake inspection, a tyre rotation or a roadworthy?");
      return say({ ...c, service: SERVICES[key], state: "date", misses: 0 }, `${SERVICES[key]}, got it. Which day would you like?`);
    }
    case "date": {
      const d = parseDate(utterance, ctx.now);
      if (!d) return miss(c, "Sorry, which day? You can say tomorrow, or a day like Thursday.");
      if (d < iso(ctx.now)) return miss(c, "That day has passed. Which day would you like?");
      if (dayOf(d) === 0) return miss(c, "We are closed on Sundays. Which other day would suit you?");
      const free = availableTimes(ctx.bookings, d);
      if (free.length === 0) return miss(c, `${pretty(d)} is fully booked. Which other day would suit you?`);
      return say({ ...c, date: d, state: "time", misses: 0 }, `${pretty(d)}. We have ${free.join(", ")}. What time suits you?`);
    }
    case "time": {
      const t = parseTime(utterance);
      const free = availableTimes(ctx.bookings, c.date!);
      if (!t) return miss(c, `Sorry, what time? We have ${free.join(", ")}.`);
      if (!SLOTS.includes(t)) return miss(c, `We start jobs on the hour between 08:00 and 16:00. We have ${free.join(", ")}.`);
      if (!free.includes(t)) return miss(c, `${t} is taken. We have ${free.join(", ")}.`);
      return say({ ...c, time: t, state: "name", misses: 0 }, "And your name, please?");
    }
    case "name": {
      const words = utterance.replace(/^(my name is|it's|it is|this is|i am|i'm)\s+/i, "").match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
      if (words.length === 0 || words.length > 3) return miss(c, "Sorry, could you give me your name?");
      return say({ ...c, name: words.join(" "), state: "phone", misses: 0 }, `Thanks ${words[0]}. What is the best phone number?`);
    }
    case "phone": {
      const digits = utterance.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 12) return miss(c, "Sorry, I did not catch the number. Could you say it again?");
      return say({ ...c, phone: digits, state: "confirm", misses: 0 },
        `I have a ${c.service} on ${pretty(c.date!)} at ${c.time} for ${c.name}, phone ending ${digits.slice(-4)}. Is that right?`);
    }
    case "confirm": {
      if (/\b(yes|yep|yeah|correct|right|confirm)\b/i.test(utterance)) {
        try {
          const b = ctx.book({ name: c.name!, phone: c.phone!, service: c.service!, date: c.date!, time: c.time! });
          return say({ ...c, state: "done", bookingId: b.id }, `You are booked. Your reference is ${b.id}. Thank you for calling.`);
        } catch {
          return say({ ...c, state: "time", time: undefined, misses: 0 }, `Sorry, that slot was just taken. We have ${availableTimes(ctx.bookings, c.date!).join(", ") || "nothing left"}. What time suits you?`);
        }
      }
      if (/\b(no|nope|wrong|change)\b/i.test(utterance)) return say({ ...c, state: "service", service: undefined, date: undefined, time: undefined, misses: 0 }, "No problem, let us start again. What would you like to book?");
      return miss(c, "Sorry, is that booking correct? Please say yes or no.");
    }
    default:
      return c;
  }
}
