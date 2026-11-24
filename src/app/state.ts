import { cookies } from "next/headers";
import { asRole } from "@/lib/service";
import { Store } from "@/lib/store";
import type { Call } from "@/lib/booking";

const g = globalThis as unknown as { __store?: Store; __call?: Call | null };
export const store = (g.__store ??= new Store({ seed: true }));
export const getCall = () => g.__call ?? null;
export const setCall = (c: Call | null) => { g.__call = c; };
export const currentRole = () => asRole(cookies().get("role")?.value);
