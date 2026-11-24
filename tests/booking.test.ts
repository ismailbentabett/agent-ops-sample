import { describe, expect, it } from "vitest";
import { availableTimes, parseDate, parseTime, startCall, step, type Call, type Ctx } from "@/lib/booking";
import { Store } from "@/lib/store";

const NOW = new Date("2026-11-24T10:00:00Z"); // a Tuesday
const mk = (store = new Store()): Ctx => ({ now: NOW, bookings: store.bookings, book: (b) => store.addBooking(b) });
const say = (c: Call, ctx: Ctx, ...lines: string[]) => lines.reduce((x, l) => step(x, l, ctx), c);
const lastAgent = (c: Call) => [...c.transcript].reverse().find((t) => t.who === "agent")!.text;

describe("parsing", () => {
  it("tomorrow", () => expect(parseDate("tomorrow please", NOW)).toBe("2026-11-25"));
  it("a weekday means the next one", () => expect(parseDate("thursday", NOW)).toBe("2026-11-26"));
  it("same weekday means next week", () => expect(parseDate("tuesday", NOW)).toBe("2026-12-01"));
  it("iso date", () => expect(parseDate("on 2026-12-02", NOW)).toBe("2026-12-02"));
  it("no date", () => expect(parseDate("whenever", NOW)).toBeNull());
  it("9am", () => expect(parseTime("9am")).toBe("09:00"));
  it("2 pm", () => expect(parseTime("2 pm")).toBe("14:00"));
  it("12 am is midnight, 12 pm is noon", () => { expect(parseTime("12am")).toBe("00:00"); expect(parseTime("12pm")).toBe("12:00"); });
  it("24 hour", () => expect(parseTime("14:00")).toBe("14:00"));
  it("no time", () => expect(parseTime("later")).toBeNull());
});

describe("happy path", () => {
  it("books a brake inspection and confirms back before saving", () => {
    const store = new Store(); const ctx = mk(store);
    let c = say(startCall(), ctx, "I need a brake check", "tomorrow", "10am", "my name is Sam Lee");
    expect(c.state).toBe("phone");
    c = say(c, ctx, "0412 555 019");
    expect(c.state).toBe("confirm");
    expect(lastAgent(c)).toMatch(/Brake inspection on Wednesday 2026-11-25 at 10:00 for Sam Lee, phone ending 5019/);
    expect(store.bookings).toHaveLength(0); // nothing saved until the caller says yes
    c = say(c, ctx, "yes that's right");
    expect(c.state).toBe("done");
    expect(store.bookings).toHaveLength(1);
    expect(lastAgent(c)).toContain(c.bookingId!);
  });
  it("saying no restarts the booking and saves nothing", () => {
    const store = new Store(); const ctx = mk(store);
    let c = say(startCall(), ctx, "service", "tomorrow", "9am", "Sam", "0412555019", "no");
    expect(c.state).toBe("service");
    expect(store.bookings).toHaveLength(0);
  });
});

describe("booking rules are code", () => {
  it("refuses Sundays", () => {
    const c = say(startCall(), mk(), "service", "sunday 2026-11-29");
    expect(c.state).toBe("date");
    expect(lastAgent(c)).toMatch(/closed on Sundays/);
  });
  it("refuses a past date", () => expect(lastAgent(say(startCall(), mk(), "service", "2026-11-20"))).toMatch(/passed/));
  it("refuses a time off the hour", () => {
    const c = say(startCall(), mk(), "tyres", "tomorrow", "9:30");
    expect(c.state).toBe("time");
    expect(lastAgent(c)).toMatch(/on the hour/);
  });
  it("refuses a time after closing", () => expect(lastAgent(say(startCall(), mk(), "tyres", "tomorrow", "5pm"))).toMatch(/08:00 and 16:00/));
  it("offers other times when a slot is full", () => {
    const store = new Store();
    store.addBooking({ name: "A", phone: "0400000001", service: "x", date: "2026-11-25", time: "09:00" });
    store.addBooking({ name: "B", phone: "0400000002", service: "x", date: "2026-11-25", time: "09:00" });
    expect(availableTimes(store.bookings, "2026-11-25")).not.toContain("09:00");
    const c = say(startCall(), mk(store), "service", "tomorrow", "9am");
    expect(lastAgent(c)).toMatch(/09:00 is taken/);
  });
  it("a slot that fills while two callers are on the line sends both back to pick a time", () => {
    const store = new Store(); const ctx = mk(store);
    store.addBooking({ name: "A", phone: "0400000001", service: "x", date: "2026-11-25", time: "11:00" });
    const a = say(startCall(), ctx, "service", "tomorrow", "11am", "Ann", "0412555011");
    const b = say(startCall(), ctx, "service", "tomorrow", "11am", "Bob", "0412555022");
    store.addBooking({ name: "C", phone: "0400000003", service: "x", date: "2026-11-25", time: "11:00" }); // slot fills while both are on the line
    const a2 = step(a, "yes", ctx); const b2 = step(b, "yes", ctx);
    expect(a2.state).toBe("time"); expect(b2.state).toBe("time");
    expect(store.bookings.filter((x) => x.time === "11:00")).toHaveLength(2);
  });
});

describe("handover", () => {
  it("asking for a person hands over at any step", () => {
    const c = say(startCall(), mk(), "can I talk to a person");
    expect(c.state).toBe("handover");
    expect(c.handoverReason).toBe("caller asked for a person");
  });
  it("a refund request hands over", () => expect(say(startCall(), mk(), "I want a refund").state).toBe("handover"));
  it("three misunderstood turns hand over", () => {
    const c = say(startCall(), mk(), "blah", "blah", "blah");
    expect(c.state).toBe("handover");
    expect(c.handoverReason).toBe("caller not understood three times");
  });
  it("a good answer resets the miss counter", () => {
    const c = say(startCall(), mk(), "blah", "blah", "service", "blah");
    expect(c.state).toBe("date");
    expect(c.misses).toBe(1);
  });
  it("a finished call ignores further speech", () => {
    const c = say(startCall(), mk(), "person");
    expect(step(c, "hello?", mk())).toBe(c);
  });
});
