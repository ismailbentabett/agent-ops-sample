import "./globals.css";
import type { ReactNode } from "react";
import { setRole } from "./actions";
import { currentRole } from "./state";

export const metadata = { title: "Kestrel Agent Ops (sample)", description: "Sample data only." };

export default function Layout({ children }: { children: ReactNode }) {
  const role = currentRole();
  return (
    <html lang="en"><body>
      <header className="top">
        <h1>Kestrel Agent Ops</h1><span>sample data, made-up business</span>
        <nav className="top"><a href="/">Monitor</a><a href="/chat">Chat agent</a><a href="/call">Call booking</a><a href="/handover">Handovers</a><a href="/settings">Settings</a></nav>
        <div className="rolebar">Role:
          {(["viewer", "agent", "admin"] as const).map((r) => (
            <form key={r} action={setRole}><input type="hidden" name="role" value={r} /><input type="hidden" name="back" value="/" />
              <button className={r === role ? "on" : ""}>{r}</button></form>
          ))}
        </div>
      </header>
      <main>{children}</main>
    </body></html>
  );
}
