# agent-ops-sample

A small reference build for a support agent you can trust. Made-up business (Kestrel Auto Care), sample data only.

What it shows:

1. **An agent that hands over to a person when unsure.** Rules first (sensitive topics, daily cost limit), then a model that may only use retrieved documents, then a person. Any failure ends in a handover, never a silent guess.
2. **Answers from documents, with sources.** Every answer carries the id of the section it came from. An invented source is rejected.
3. **A call-style booking flow.** Service, day, time, name, phone, read back, confirm. Opening hours, hourly slots and two bays per slot are plain code. A text simulation of the logic, with no phone line attached.
4. **Roles and data access.** viewer, agent, admin. Viewers see phone numbers masked. Only agents close handovers. Only admins change settings and read the audit log.
5. **Monitoring.** Handover rate, reasons, cost today, alerts, a queue of items waiting for a person.
6. **An MCP server** so Claude can use the same data with the same roles. Read only by default, role set by `MCP_ROLE`, writes only with `MCP_ALLOW_WRITE=1`.

## Run

```bash
npm install
npm test          # 79 tests
npm run dev       # http://localhost:3200
npm run mcp       # MCP server over stdio
```

No API key is needed. Without `OPENAI_API_KEY` an offline stand-in reads the documents. With a key, the model path uses the OpenAI chat API.

Claude Desktop config for the MCP server:

```json
{ "mcpServers": { "kestrel": { "command": "npx", "args": ["tsx", "/full/path/mcp/server.ts"], "env": { "MCP_ROLE": "viewer", "MCP_ALLOW_WRITE": "0" } } } }
```

## Not done

- The model path is tested with a mocked reply, not against the live API.
- Retrieval is keyword scoring. Embeddings would come when your documents are bigger.
- The call flow is the logic only. A phone provider and speech to text would sit in front of it.
- Storage is in memory. No real database, no sign-in, roles are a cookie switch for the demo.
- The MCP server has been tested with the SDK client, not inside Claude Desktop.
