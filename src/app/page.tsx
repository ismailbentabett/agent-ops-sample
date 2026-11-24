import { currentRole, store } from "./state";
export const dynamic = "force-dynamic";

export default function Monitor() {
  const role = currentRole();
  const s = store.stats();
  const runs = store.recentRuns(role, 10);
  return (<>
    {s.alerts.length ? s.alerts.map((a) => <div className="alert" key={a}>{a}</div>) : <div className="ok">No alerts. Handover rate and cost are inside the limits.</div>}
    <div className="stats">
      <div className="stat"><b>{s.total}</b><span>runs</span></div>
      <div className="stat"><b>{s.handoverRatePct}%</b><span>handed to a person</span></div>
      <div className="stat"><b>${s.costTodayUsd.toFixed(4)}</b><span>cost today (limit ${store.settings.dailyCostLimitUsd})</span></div>
      <div className="stat"><b>{s.unhandled}</b><span>waiting for a person</span></div>
    </div>
    <div className="grid2">
      <div className="panel"><h3>Why it handed over</h3>
        <table className="t"><tbody>{s.reasons.map((r) => <tr key={r.reason}><td>{r.reason}</td><td><b>{r.count}</b></td></tr>)}</tbody></table>
        <p className="note">Threshold {store.settings.confidenceThreshold}. Below it, or on any failure, the agent passes to a person.</p></div>
      <div className="panel"><h3>Recent runs ({role} view)</h3>
        <table className="t"><thead><tr><th>Question</th><th>Result</th></tr></thead><tbody>
          {runs.map((r) => <tr key={r.id}><td>{r.question}{r.customerPhone ? <div className="note">phone {r.customerPhone}</div> : null}</td>
            <td><span className={`tag ${r.outcome === "answered" ? "t-ans" : "t-hand"}`}>{r.outcome}</span><div className="note">{r.reason}</div></td></tr>)}
        </tbody></table></div>
    </div>
  </>);
}
