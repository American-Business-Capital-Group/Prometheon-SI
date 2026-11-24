# Prometheon SI Unified App — Gateway API Contract (v1.00)

The browser/desktop app is a static site. ALL dynamic behavior goes through the
chat gateway on the Alienware (FastAPI, pilot stack). The site discovers the
gateway at runtime from `gateway-config.js`:

```js
window.PROMETHEON_GATEWAYS = [
  "https://<funnel-or-magicdns-host>",   // tried first
  "http://100.89.231.37:8811"            // tailnet fallback
];
```

The client probes `GET /health` on each candidate (2.5s timeout) and uses the
first that answers. If none answers, the chat UI shows a "gateway unreachable"
state — it never fakes answers.

## Auth (JWT bearer, bcrypt/pbkdf2 password hashing, SQLite store on the Alienware)

- `POST /auth/signup` {email, password, name} -> {token, user{id,email,name}}
- `POST /auth/login` {email, password} -> {token, user}
- `GET /auth/me` (Bearer) -> {user, wallet:{balance_micro_usd}, plan}
- Signup grants a free-trial wallet credit (trial, not a payment). Paid
  checkout is NOT live (Stripe reauthorization pending) — no endpoint takes a
  real payment.

## Catalog (Decision Options: Model Type -> Vendor -> Model)

- `GET /catalog` -> {
    model_types: [{id, label, group}],   // the 25 AI model types (registry A–I + 16 ASI classes) + LLM classes
    vendors: [{id, label}],
    models: [{id, label, vendor, model_type, route, lifecycle}]  // Approved records only, from roster.csv
  }

## Conversations / sub-chats / projects

- `GET /conversations` (Bearer) -> [{id, title, platform, parent_id, project_id, created_at, updated_at}]
- `POST /conversations` {title?, platform, project_id?, parent_id?} -> conversation
  - parent_id set = a sub-chat. Creating a sub-chat registers a child run with
    the Fence (spawn record carries parent run/conversation ids).
- `PATCH /conversations/{id}` {title?, project_id?} -> conversation
- `DELETE /conversations/{id}`
- `GET /conversations/{id}/messages` -> [{id, role, content, route, created_at}]
- `GET /projects` / `POST /projects` {name} / `PATCH /projects/{id}` {name?, pinned_app?}
  - pinned_app=true puts the project on the user's app shelf ("internal apps").

## Chat

- `POST /chat` (Bearer) {
    conversation_id, message,
    platform: "prometheon" | "legacy" | "lampas" | "ignis" | "civilization",
    selection: {mode: "auto"} | {mode:"manual", model_type, vendor, model_id}
  } -> {
    message: {role:"assistant", content, route:{model_type, vendor, model, route_label}},
    run: {run_id, fence_status, tokens, trace_id},
    conversation_id
  }

Server-side flow (Prometheon platform): Input Prompt -> Process Manager
(classify/decompose via the pilot router) -> Decision Intelligence/Reasoning ->
Decision Options (auto: K5 router v2 decides; manual: validated against the
roster, Approved only, S-11 lifecycle enforced) -> Output Generator
(serve.py serving path, K6 v2 verification + escalation) -> Model Output.
Every turn is a Fence-registered run and Langfuse-traced, like the Door.

Other platforms answer through their real services:
- legacy: the Legacy Agents pilot supervisor (C:\AI\legacy-agents-pilot)
- lampas: the Lampas recursive engine (bounded run; returns its spawn summary)
- ignis: the Ignis HTTP service (127.0.0.1:8790)
- civilization: AICivilization state API (18711) — a real model call grounded
  in live world state, route labeled as world-state; if the model leg is
  unavailable, return the live state summary labeled as such, never invented.

## Health

- `GET /health` -> {service:"prometheon-gateway", status:"ok", fence:true, platforms:{...}}
- CORS: allow https://prometheon.si, https://american-business-capital-group.github.io,
  http://localhost:* and the desktop app's file/null origin.
