import { callAction, newCall } from "../actions";
import { getCall } from "../state";
export const dynamic = "force-dynamic";

export default function CallPage() {
  const call = getCall();
  return (<div className="grid2">
    <div className="panel"><h3>Incoming call (text simulation)</h3>
      {!call ? <form action={newCall}><button>Start a call</button></form> : (<>
        {call.transcript.map((t, i) => <div key={i} className={`bubble ${t.who}`}><small>{t.who}</small>{t.text}</div>)}
        {call.state === "done" && <div className="ok">Booked: {call.bookingId}</div>}
        {call.state === "handover" && <div className="alert">Passed to a person: {call.handoverReason}. It is now in the Handovers queue.</div>}
        {call.state !== "done" && call.state !== "handover"
          ? <form action={callAction}><label>Caller says<input name="say" autoFocus autoComplete="off" /></label><button>Say it</button></form>
          : <form action={newCall}><button className="alt">New call</button></form>}</>)}
    </div>
    <div className="panel"><h3>How the call flow works</h3>
      <ul className="plain"><li>The caller is guided through service, day, time, name and phone, one question at a time.</li>
        <li>Opening hours, hourly slots, two bays per slot and “no Sundays” are plain code.</li>
        <li>The agent reads the booking back and only saves after a clear yes.</li>
        <li>Asking for a person, a sensitive topic, or three misunderstood turns passes the call to a human.</li>
        <li>A real phone line would sit in front of this: a provider turns speech to text and back. This sample is the logic only.</li></ul></div>
  </div>);
}
