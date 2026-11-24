import { askAction } from "../actions";
import { store } from "../state";
export const dynamic = "force-dynamic";
const SAMPLES = ["What time do you open on Saturday?", "How much is a brake inspection?", "Can I get a courtesy car?", "I want a refund for my last service", "Do you repair electric bikes?"];

export default function Chat({ searchParams }: { searchParams: { run?: string } }) {
  const run = store.runs.find((r) => r.id === searchParams.run);
  return (<div className="grid2">
    <div className="panel"><h3>Ask the agent</h3>
      <form action={askAction}><label>Customer question<input name="question" placeholder="Ask about hours, prices, warranty..." /></label><button>Ask</button></form>
      <p className="note" style={{ marginTop: 14 }}>Try one:</p>
      <div className="chips">{SAMPLES.map((q) => <form key={q} action={askAction}><input type="hidden" name="question" value={q} /><button>{q}</button></form>)}</div>
    </div>
    <div className="panel"><h3>Result</h3>
      {!run ? <p className="note">Ask something to see the result.</p> : (<>
        <div className="bubble caller"><small>customer</small>{run.question}</div>
        {run.outcome === "answered"
          ? <div className="bubble agent"><small>agent, confidence {run.confidence.toFixed(2)}</small>{run.answer}
              <div className="src">Source: {run.sources.map((s) => <code key={s}>{s}</code>)}</div></div>
          : <div className="bubble agent"><small>agent</small>I will pass this to a colleague, who will get back to you.
              <div className="src"><span className="tag t-hand">handover</span> reason: {run.reason}{run.draft ? <> · draft kept for the person: “{run.draft}”</> : null}</div></div>}
        <p className="note">Run {run.id} · cost ${run.costUsd.toFixed(4)} · {run.latencyMs} ms · logged</p></>)}
    </div>
  </div>);
}
