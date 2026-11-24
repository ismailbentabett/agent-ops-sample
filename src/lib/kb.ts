import type { Chunk, Hit } from "./types";

// Made-up business. Every fact below is invented for this sample.
export const DOCS: Chunk[] = [
  { id: "hours-1", doc: "Visiting us", section: "Opening hours", text: "We are open Monday to Saturday, 8 am to 5 pm. We are closed on Sundays and public holidays. The workshop is at 12 Harbour Lane, Northgate." },
  { id: "book-1", doc: "Bookings", section: "Making a booking", text: "Book by phone or through the chat. Each booking is one hour for the first appointment slot, and we start jobs on the hour." },
  { id: "book-2", doc: "Bookings", section: "Cancellations", text: "You can cancel up to 24 hours before your booking at no charge. A cancellation inside 24 hours has a 40 dollar fee." },
  { id: "price-1", doc: "Prices", section: "Service prices", text: "A standard service starts from 189 dollars. A brake inspection is 59 dollars. A tyre rotation is 45 dollars. A roadworthy certificate is 95 dollars." },
  { id: "warr-1", doc: "Warranty", section: "What is covered", text: "Parts and labour are covered for 12 months or 20,000 km, whichever comes first. Wear items such as tyres and brake pads are not covered." },
  { id: "car-1", doc: "Courtesy cars", section: "Courtesy car rules", text: "A courtesy car is available for jobs longer than 3 hours and must be booked 2 days ahead. The driver must be 21 or older and hold a full licence." },
  { id: "pay-1", doc: "Payment", section: "How to pay", text: "We accept card and bank transfer. We do not take cash. The invoice is emailed when the job is finished." },
  { id: "comp-1", doc: "Complaints", section: "Complaints", text: "Complaints are handled by the workshop manager only. Staff and the assistant do not promise refunds or compensation." },
];

const STOP = new Set(("a an the is are was were be do does did can could would should will you your we our us i me my to of for in on at by with and or it its this that there how what when where which who much many any get have has had about from as if so not no yes please tell").split(" "));

export function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .filter((w) => !STOP.has(w));
}

/** Small keyword retriever (BM25 style). Returns [] when nothing in the documents matches. */
export function retrieve(question: string, k = 3, docs: Chunk[] = DOCS): Hit[] {
  const q = [...new Set(tokens(question))];
  if (q.length === 0) return [];
  const bags = docs.map((c) => tokens(c.section + " " + c.text));
  const avg = bags.reduce((n, b) => n + b.length, 0) / bags.length;
  const df = (t: string) => bags.filter((b) => b.includes(t)).length;
  const hits: Hit[] = [];
  docs.forEach((chunk, i) => {
    const b = bags[i];
    let score = 0, matched = 0;
    for (const t of q) {
      const tf = b.filter((x) => x === t).length;
      if (!tf) continue;
      matched++;
      const idf = Math.log(1 + (docs.length - df(t) + 0.5) / (df(t) + 0.5));
      score += idf * ((tf * 2.5) / (tf + 1.5 * (0.25 + 0.75 * (b.length / avg))));
    }
    if (matched > 0) hits.push({ chunk, score, coverage: matched / q.length });
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
