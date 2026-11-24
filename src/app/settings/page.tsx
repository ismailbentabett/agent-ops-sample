import { can } from "@/lib/auth";
import { settingsAction } from "../actions";
import { currentRole, store } from "../state";
export const dynamic = "force-dynamic";

export default function Settings({ searchParams }: { searchParams: { error?: string } }) {
  const role = currentRole();
  const admin = can(role, "edit_settings");
  const log = can(role, "view_audit") ? [...store.auditLog].reverse().slice(0, 12) : null;
  return (<div className="grid2">
    <div className="panel"><h3>Agent settings</h3>
      {searchParams.error && <div className="alert">{searchParams.error}</div>}
      {!admin && <div className="alert">Only the admin role can change settings. You are {role}.</div>}
      <form action={settingsAction}>
        <label>Confidence threshold (0.3 to 0.95). Below this the agent hands over.<input name="threshold" defaultValue={store.settings.confidenceThreshold} disabled={!admin} /></label>
        <label>Daily cost limit in dollars. Over this the agent hands everything over.<input name="limit" defaultValue={store.settings.dailyCostLimitUsd} disabled={!admin} /></label>
        {admin && <button>Save</button>}</form></div>
    <div className="panel"><h3>Audit log</h3>
      {!log ? <p className="note">Only the admin role can read the audit log.</p> : log.length === 0 ? <p className="note">No changes yet.</p> :
        <table className="t"><tbody>{log.map((e, i) => <tr key={i}><td>{e.at.slice(11, 19)}</td><td>{e.role}</td><td>{e.action}<div className="note">{e.detail}</div></td></tr>)}</tbody></table>}</div>
  </div>);
}
