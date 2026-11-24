import { can } from "@/lib/auth";
import { resolveAction } from "../actions";
import { currentRole, store } from "../state";
export const dynamic = "force-dynamic";

export default function Handover({ searchParams }: { searchParams: { error?: string } }) {
  const role = currentRole();
  const q = store.queue(role);
  const canAnswer = can(role, "answer_handover");
  return (<div className="panel"><h3>Waiting for a person ({q.length})</h3>
    {searchParams.error && <div className="alert">{searchParams.error}</div>}
    {!canAnswer && <div className="alert">Your role ({role}) can read this queue but not close items. Switch to agent or admin.</div>}
    {q.length === 0 && <p className="note">Nothing waiting.</p>}
    <table className="t"><tbody>{q.map((r) => (<tr key={r.id}>
      <td style={{ width: "46%" }}><b>{r.id}</b> · {r.channel}<div>{r.question}</div>{r.customerPhone && <div className="note">phone {r.customerPhone}</div>}
        {r.draft && <div className="note">Agent draft: “{r.draft}” (confidence {r.confidence.toFixed(2)})</div>}</td>
      <td><span className="tag t-hand">{r.reason}</span></td>
      <td>{canAnswer && <form action={resolveAction}><input type="hidden" name="id" value={r.id} /><input name="note" placeholder="What you did (required)" /><button style={{ marginTop: 6 }}>Close</button></form>}</td>
    </tr>))}</tbody></table></div>);
}
