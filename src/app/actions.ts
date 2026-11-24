"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ask, asRole, callTurn } from "@/lib/service";
import { currentRole, getCall, setCall, store } from "./state";

export async function setRole(fd: FormData) {
  cookies().set("role", asRole(String(fd.get("role"))));
  redirect(String(fd.get("back") || "/"));
}
export async function askAction(fd: FormData) {
  const run = await ask(store, String(fd.get("question") ?? ""));
  redirect(`/chat?run=${run.id}`);
}
export async function callAction(fd: FormData) {
  const said = String(fd.get("say") ?? "").trim();
  setCall(callTurn(store, getCall(), said === "" ? null : said));
  redirect("/call");
}
export async function newCall() { setCall(callTurn(store, null, null)); redirect("/call"); }
export async function resolveAction(fd: FormData) {
  try { store.resolve(currentRole(), String(fd.get("id")), `${currentRole()} user`, String(fd.get("note") ?? "")); }
  catch (e) { redirect(`/handover?error=${encodeURIComponent((e as Error).message)}`); }
  redirect("/handover");
}
export async function settingsAction(fd: FormData) {
  try { store.updateSettings(currentRole(), { confidenceThreshold: Number(fd.get("threshold")), dailyCostLimitUsd: Number(fd.get("limit")) }); }
  catch (e) { redirect(`/settings?error=${encodeURIComponent((e as Error).message)}`); }
  redirect("/settings");
}
