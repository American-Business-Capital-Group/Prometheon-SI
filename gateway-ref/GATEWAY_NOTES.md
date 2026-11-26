# Prometheon SI Chat Gateway — Build Notes (gateway v1.01)

Live service: `C:\AI\prometheon-pilot\gateway.py` on the Alienware (ABCG-PC), agents venv
(`C:\AI\envs\agents\.venv`), launched detached via WMI (`start-gateway.ps1` →
`launch-gateway.ps1`, same pattern as `launch-door.ps1`). Reference copies in this folder:
`gateway.py`, `lampas_run.py`, `launch-gateway.ps1`, `start-gateway.ps1`,
`gateway_adapters.json`. Store: `C:\AI\prometheon-pilot\gateway.db` (SQLite).
Built and tested 2026-11-23.

## Constitution (apex doctrine, Jon 2026-11-23)

Jon M. Anderson is the ultimate authority of the entire system; the agents' ultimate
goal is to serve him and make Prometheon SI what he tells them to. Authority order:
(0) Jon's word — direct directives override everything; (1) commanded work through
Prometheon (his instrument); (2) the instincts (build, survive, betterment) in the
space his commands leave open. The Fence and lifecycle governance are the enforcement
of **his** law — they bind agents and the engine; Jon sets and can change the law.
How the gateway embodies it: gateway accounts are owner accounts under Jon's control
(signup/login/JWT issued by his gateway on his machine; the trial wallet is his to
change); every spawn and creation is Fence-checked under his law (GRANTED/DENIED,
budget/depth/lifecycle); no endpoint, label, or description presents any agent,
engine, or platform as an authority over or independent of him — Lampas is described
as the creator engine exercising initiative only inside the space Jon's commands
leave open, under the Fence.

## Role doctrine (Jon 2026-11-23)

- **Prometheon SI** = the aggregator intelligence on top of everything.
- **Lampas** = the creator engine (brings agents into being; spawns on its own
  initiative and as needed during work — initiative bounded by the Constitution above).
- **Legacy Agents SI** = the human creation console (humans commission; the engine creates).
- **AI Civilization** = the created world. **Ignis** = the neural network beneath.
- Governance unchanged: every spawn clears THE FENCE.
- `/agents/create` is the engine-creation path; its responses name
  `engine: "Lampas (creator engine)"` and `fence_status` remains the verdict field.
- Creation is callable mid-work from a Prometheon chat context — same Bearer auth as
  `/chat`, no separate credential (confirmed: one token drives chat, world, and
  agent creation in the tests below).

## Bind choice

The gateway binds **two sockets in one process: `100.89.231.37:8811` (the tailnet IP)
and `127.0.0.1:8811`** — mirroring door.py's posture (the Door binds the tailnet IP
only, so the service is reachable across the tailnet and never exposed on the LAN),
plus localhost so Tailscale Funnel and on-box probes can reach it. It does **not**
bind 0.0.0.0 / the LAN address. Verified listening on exactly those two addresses
(pid shown by `Get-NetTCPConnection`).

## Auth

- Password hashing: **`hashlib.pbkdf2_hmac` (SHA-256, 200,000 iterations, per-user
  16-byte salt)** — bcrypt is NOT installed in the agents venv (probed:
  `find_spec('bcrypt') == False`).
- Tokens: **stdlib HMAC-SHA256 signed JWTs** — PyJWT is NOT installed in the venv
  (probed `False`). Signing secret is generated at first run and stored in the
  gateway.db `meta` table on the Alienware; never printed, never in these notes.
- Signup seeds a wallet row: **5,000,000 micro-USD ($5.00) labeled plan
  `free-trial`, kind `trial`** — a trial credit, not a payment. There are **no
  payment code paths** (Stripe is not live).

## Catalog derivation

`GET /catalog` is built live from `C:\AI\model-deck\roster.csv` on every request:

- **models**: roster records with `Lifecycle == "Approved"` only — 95 records,
  deduplicated by `(Route, ApiId)` (6 duplicate deployment records collapse) = **89
  roster models**, plus **2 gateway adapter-registry entries** (below) = **91 total**.
  `vendor` = the record's **Company** field (no vendors invented); `route` = the
  record's **Route** field; `id` = `"<Route>::<ApiId>"`. All 95 Approved records
  have Category `Model`.
- **model_type** per model: the roster has no architecture field, so the type is the
  LLM class derived from the record's Model/ApiId strings by a documented heuristic
  in the code (`llm_class_for`): embedding → `embedding`; guard → `guard/safety`;
  rerank → `reranking`; coder/codex → `code`; r1/reasoning/inkling → `reasoning`;
  -vl/vision → `vision-language`; a95b/moe → `mixture-of-experts`; ≤9B →
  `small language model`; otherwise `instruction-tuned`. This is a labeling
  heuristic over the record's own names, stated as such.
- **model_types (50)**: the 25 AI model types — Master List v2.08 table T-2 registry
  categories A–I (Models, Agents, Security, Environments, Add-Ons, Plug-ins,
  Training / Knowledge Base, Resources, Weights) + table T-3's 16 ASI model classes
  (verbatim component names) — plus the 25 LLM class labels from the spec brief
  (decoder-only autoregressive … agentic/tool-use), grouped `registry` /
  `asi-component` / `llm-class`.
- **vendors (22)**: distinct Company values of the Approved records + "AI
  Civilization" from the adapter registry.

### Gateway adapter registry (`gateway_adapters.json`)

`roster.csv`'s 5,507 records were **not** edited. Two routable records are carried in
the gateway's own adapter registry file (in this folder and beside gateway.py),
each lifecycle-governed exactly like a roster record — the gateway checks its
`Lifecycle` field before every dispatch (S-11 semantics); only `Approved` routes:

| id | label | vendor | route | lifecycle |
|---|---|---|---|---|
| `civilization::society` | AI Civilization Society | AI Civilization | civilization | Approved |
| `lampas::creator-engine` | Lampas Creator Engine | Lampas SI by Pyr Neural Network | lampas | Approved |

The civilization entry is described as **the created-world society** (callable
model); the Lampas entry as **the creator engine**. Both are selectable in manual
mode on the Prometheon platform and dispatch to their platform handlers.
K5 auto-selection does not name them (the router ranks roster records only);
platform-explicit / manual dispatch is the delivered form, auto-selection is
designed but not wired.

## Per-platform wiring — truth table

| platform | wiring | real or fallback |
|---|---|---|
| prometheon (auto) | `router.rank` (K5 v2, live classifier) → Fence run + register naming the **actual** chosen brain → `serve.serve_task` with that decision (output contract, K6 v2 verification + escalation) inside `tracing.run_context` → debit + complete | **Real pipeline** |
| prometheon (manual) | model validated against roster (Approved only; unknown/unapproved → HTTP 400 refusal) or the adapter registry (above); served through the same `serve_task` path with a decision built from `router.classify` | **Real**; K6 may escalate — response carries `requested_model` + final route + `escalated` flag |
| legacy | Bounded subprocess: `supervisor.py --task <msg>` in `C:\AI\legacy-agents-pilot` (480 s timeout), its own `spawns.sqlite` registry; gateway parses its `=== AGGREGATE ===` / `=== VERIFICATION ===` sections. The supervisor's decomposition is its fixed 4-worker script — the task text is carried as run context, not decomposed dynamically (its design, stated plainly). Gateway also registers a wrapper run on Fence 8799. Legacy does **not** use the Fence itself (its registry is `spawns.sqlite`) | **Real demo-path invocation** |
| lampas | Bounded subprocess: `lampas_run.py` (sibling of gateway.py) sets `PROMETHEON_FENCE_URL=8798`, max depth 3, fanout 0 **before** importing core — the same pattern as `lampas_proof.py` — then `core.run_mission(run_id, "lampas", <user task>, fanout=0)`; 600 s timeout; result + spawn summary read from the run's JSON. The user's own task is run (not the proof's fixed task) | **Real recursion** (Atomizer decides solve-vs-spawn; the test task solved directly at depth 0 — see evidence) |
| ignis | `POST http://127.0.0.1:8790/route {input}` (the service's real endpoint; GET /health, GET /memory also exist). K1 One Memory context is injected by the service itself. Gateway registers a wrapper run on Fence 8799 (deck gen-0 brain — Ignis's own models are not roster brains, so the wrapper names the deck brain; stated here, not hidden). Tokens: Ignis reports none → `tokens: 0` | **Real service call** |
| civilization | First tries **society dispatch**: `POST http://127.0.0.1:18711/task {task, context}` (see Integration demos — endpoint not yet implemented by the civ service, returns 501). Fallback, delivered and labeled: GET live `/state`, ground a real routed model call (`router.rank` + `serve.serve_task`) in that state; route labeled `world-state` with `dispatch_mode: "grounded-model (civ POST /task endpoint unavailable at call time)"` and `grounded_model` naming the model used. If the model leg fails, returns the raw state summary labeled state-only | **Real grounded call today; society dispatch pending civ endpoint** |

Fence registration for chat turns uses direct Fence HTTP calls naming the actual
serving brain (the Fence API accepts explicit `brain_route`/`brain_api_id`;
`core.FenceClient.register` derives the brain from the deck instead — same server,
same S-11 lifecycle enforcement server-side; the gateway's records are the more
accurate ones). Sub-chat creation registers the child in the **parent
conversation's** persistent Fence run (`conv-<parent_id>`): supervisor `S` at
depth 0 (deck gen-0 brain), sub-chat agent `sub-<id>` at depth 1 (deck gen-1 brain),
role text references the parent conversation id.

## World endpoints (AI Civilization view)

- `GET /world/state` (Bearer) proxies `GET 18711/state` **verbatim**.
- `GET /world/geometry` (Bearer): the civ service exposes **no** geometry endpoint
  (verified 2026-11-23: `/geography`, `/tile`, `/geometry` all → 404). Tile geometry
  exists only as files in `C:\AI\aicivilization-pilot`: **`geography.json`**
  (186,064 bytes, OSM-derived JSON: keys `tile`, `features`, `feature_count`,
  `geography_source`) and **`tile.osm.xml`** (8,282,391 bytes, raw OSM XML). The
  gateway endpoint returns the parsed `geography.json` with its source file labeled;
  the view builder can bundle a static copy of the tile geometry and use the API
  for live entity state only.

### Exact field names the state API returns (live-verified 2026-11-23)

Top level: `service`, `tile`, `tick`, `world_time`, `agents`, `feature_count`,
`action_log_count`, `last_action`, `persistence`, `http`.
Per agent: `id`, `name`, `lat`, `lon`, `target_id`, `target_name`,
`distance_traveled_m`, `actions_count`. **There are no `role` or `state` fields per
agent in the current payload, and no separate tile-bounds object** — position is
`lat`/`lon`, the route is implied by `target_id`/`target_name` (current waypoint
destination, not a polyline). Tile bounds exist in the civ README/geography file:
lat 41.87360…41.88260, lon −87.63584…−87.62376 (Chicago Loop Tile 001, center
41.87810, −87.62980). World clock = `tick` + `world_time`. Agent count for the 1:1
entity check = `len(agents)` (4 at test time: Mara, Theo, Ines, Juno).

## Phase 2 conjunction

The **same gateway instance** (this one process, port 8811) serves all four front
doors — prometheon.si, lampasagents.si, pyr.network, aicivilization.si — with
platform dispatch unchanged: one backend, no copies. CORS allows all four domains
(apex + www), the GitHub Pages origin, `http://localhost:*`/`127.0.0.1:*`, and the
desktop app's `null` origin. Each standalone domain's site points its
`gateway-config.js` at this same gateway; the `platform` field in `/chat` selects
Lampas / Ignis / Civilization / Prometheon behavior.

## Funnel outcome

Command attempted (gateway port ONLY, per brief):
`& 'C:\Program Files\Tailscale\tailscale.exe' funnel --bg 8811`

- First attempt (interactive SSH session): produced **no output and hung**; session
  timed out at 90 s.
- Second attempt (detached, 45 s job timeout): result file records verbatim
  `FUNNEL COMMAND TIMED OUT after 45s (no output)`.
- `tailscale funnel status` afterwards: **`No serve config`** — Funnel is **not
  active**. No other port/service was funneled.
- MagicDNS name (from `tailscale status --json`, `Self.DNSName`):
  **`abcg-pc.tailf35211.ts.net`** → gateway on the tailnet at
  `http://abcg-pc.tailf35211.ts.net:8811` and `http://100.89.231.37:8811`.
  (For the site's `gateway-config.js`, the https Funnel URL does not exist yet;
  the tailnet fallback URL is the working candidate. Funnel likely needs the
  tailnet's Funnel enablement/ACL step in the admin console — outside this build.)

## Test evidence (all from the Alienware against the live gateway, 2026-11-23)

Test account: **gatewaytest@abc-angels.com** — internal test account created for
this build's verification (note: its password was set by the test script and is
not recorded here). Raw result files on the Alienware:
`C:\AI\prometheon-pilot\results\gateway-test1.json`, `gateway-test2.json`.

- **Health**: `{"service":"prometheon-gateway","status":"ok","version":"v1.01","fence":true,"platforms":{"prometheon":true,"legacy":true,"lampas":true,"ignis":true,"civilization":true}}` — also fetched **from the VM** through the runtime proxy (`$HTTPS_PROXY` host, port 3130) → same body; `/catalog` likewise.
- **Signup/login**: signup → 200 (first run); re-run → 400 "email already registered"
  → login 200. `GET /auth/me` → wallet `balance_micro_usd: 5000000`, plan `free-trial`.
- **Catalog**: 50 model types, 22 vendors, 91 models (89 roster + 2 adapter entries).
- **Project**: create → id `6c9e6d72009d4f978e03b5b6b25f4fe9`; PATCH
  `pinned_app: true` → returned `pinned_app: true`.
- **Prometheon auto turn** ("In one short sentence, what is Prometheon SI?", 17.6 s):
  answer *"Prometheon SI is the system I operate as, built to complete your tasks
  fully and exactly as specified."* Route: model_type `instruction-tuned`, vendor
  DeepSeek, model DeepSeek-V4-Pro, route_label `ollama/deepseek-v4-pro:cloud`,
  escalated false. Run `gw-prometheon-20261123-104643-ec7b13`, fence_status
  `granted`, tokens 345, trace_id `4d90f99885ad3cd73f52812e9612fcf3`.
- **Manual turn** (model_id `ollama::llama3.1:8b`, "Reply with exactly: manual route
  ok", 31.1 s): answer `manual route ok`. K6 verification escalated the serving
  model: final route `ollama/deepseek-v4-pro:cloud`, `requested_model: "Llama 3.1
  8B (Ollama)"`, `escalated: true`, tokens 609, trace_id
  `4e317c1fdbff3816f8bc302afbbf4a00`, fence granted.
- **Manual refusal**: model_id `ollama::not-a-real-model` → **400**
  `manual selection refused: model is not an Approved roster record (S-11
  lifecycle enforcement)`.
- **Sub-chat**: created under conversation `12de506868c943f5af51a634bf8dbc0b`;
  Fence tree for run `conv-12de506868c943f5af51a634bf8dbc0b` shows `S` (depth 0,
  brain `deepseek/deepseek-v3.2`, grant `58808f7b…`) and `sub-b0b767a529`
  (parent `S`, depth 1, brain `kimi-k2.6:cloud`, grant `5da2bd37…`,
  fence_status `granted`).
- **Ignis turn** ("Say hello in one short sentence.", 24.6 s): answer `Hello!`;
  route model_type `ignis-intent:quick_chat`, vendor `ollama-local`, model
  `gpt-oss:20b`; run `gw-ignis-20261123-104732-fcabda`, fence granted, tokens 0
  (Ignis reports no token counts).
- **Civilization turn** (grounded path, 77.1 s): answer correctly named Mara
  closest to tile center with live coordinates and each agent's live target
  (Dunkin', Dearborn St & Monroe St, East Madison Street, South Wacker Drive).
  Route labeled `world-state`, grounded_model `ollama/deepseek-v4-pro:cloud`,
  tokens 9969, trace_id `63c88538517134a196c9bdda47461636`, fence granted.
- **Legacy turn** (3.8 s): real supervisor aggregate — 4 worker sections (lane
  registry summary, risk assessment, next-steps planning, status synthesis) +
  verification verdict appended; route `legacy-supervisor`; run
  `gw-legacy-20261123-105236-5be1f5`, fence (wrapper) granted.
- **Lampas turn** (4.3 s): run `gw-lampas-20261123-105240-af59d3` on the Lampas
  Fence — 1 agent, max depth 0 (Atomizer chose solve), 399 tokens debited of
  600,000 budget, trace_id `62fdb59113b6605fa52413be5514c508`; answer text is the
  run's real model output (a generic description of "Lampas SI" — the model's
  words, not a fabricated summary).
- **World**: `/world/state` → 200, tick 219355, world_time
  `2027-01-26T09:19:10+00:00`, 4 agents, feature_count 1106; unauthenticated
  request → 401. `/world/geometry` → 200 with labeled file source.

## Integration demos

### Create-agent (platform home) — REAL, complete

`POST /agents/create {role:"builder", home:"platform"}` →
`fence_status: "granted"`, run_id `gw-create-20261123-105231-3e4504`, trace_id
`d699da61af4a0c9aeea1f3ee29e97d1f`, agent id `36871ef2bef54e13ac54e2e877f44f10`.
Lampas Fence (8798) tree for the run: `S` (depth 0, creator-engine role, grant
`77af1bf1…`) → `agent-36871ef2be` (depth 1, grant `841df011…`, status completed).
Listed by `GET /agents` with registry_source labeled as a platform agent record
(no running worker fabricated).

### Create-agent (civilization home) — Fence half REAL; in-world half PENDING civ endpoint

`POST /agents/create {name:"Demo Builder", role:"builder", home:"civilization"}` →
`fence_status: "granted"`, run_id `gw-create-20261123-105234-1476a9`, trace_id
`a8cdce98c92f9c9d752fd0d3d315ad70`, Lampas Fence tree shows the depth-1 created-agent
registration (grant `b1a1a077…`, completed). BUT the civ instantiation call
`POST 18711/agents` returned **501** (the civ service implements no POST handlers
yet — probed directly 2026-11-23: `POST /task` → 501, `POST /agents` → 501), so
`civ_status: "pending-civ-endpoint (POST /agents -> 501)"`, `civ_agent_id: null`,
and the civ state agent count was **4 before and 4 after** — the agent is **not**
in the world yet. The joint demo (agent appearing in state) is **pending the civ
builder's POST /agents endpoint**; the gateway side is implemented against the
exact contract and will instantiate automatically once it exists.

### Civilization society dispatch — PENDING civ endpoint (fallback verified)

`POST 18711/task` → **501** at build time, so no society-dispatched answer exists
to show. The gateway attempts society dispatch first on every civilization chat
(Fence-registered, Langfuse-traced) and falls back to the verified grounded-model
path (see Civilization turn above, route labeled `world-state` with
`dispatch_mode` saying why). The joint demo is **pending the civ builder's
POST /task endpoint**; nothing about the fallback is presented as society output.

## Pre-existing services — re-verified at the end (from the Alienware)

| service | check | result |
|---|---|---|
| Door 8800 | GET /health | 200 `{"service":"prometheon-door","status":"ok","fence":true}` |
| Fence 8799 | GET /health | 200 ok, max_depth 2 |
| Lampas Fence 8798 | GET /health | 200 ok, max_depth 3 |
| Ignis 8790 | GET /health | 200 `{"status":"ok","service":"ignis-by-pyr","version":"v1.00"}` |
| AICivilization 18711 | GET /health | 200 (live state payload, tick advancing) |
| Langfuse 3000 | GET / | 200 (web UI HTML) |
| Staging Fence 8899 | GET /health | 200 ok, max_depth 3 |
| Staging society 8890 | GET /health | 200 (its `/` is 404 by design; service listening, pid unchanged) |
| Gateway 8811 | GET /health | 200, v1.01, all platforms true |

## Partials / open items

1. Tailscale Funnel not active (see above) — site config should use the tailnet
   fallback URL until Funnel is enabled in the tailnet admin console.
2. Civ `POST /task` and `POST /agents` endpoints pending on the civ builder —
   gateway contracts implemented; joint demos pending (documented above, not faked).
3. K5 auto-selection of the society/creator-engine adapter records: designed,
   not wired (router ranks roster records only); manual + platform dispatch delivered.
4. Manual-mode turns on roster records whose route has no adapter in
   `adapters.py` (routes `openai`, `gemini`, `xai`, `meta-api`,
   `Catalog — Artificial Analysis`) will fail at call time with the adapter's real
   error (`no adapter for route …`) — the catalog lists them because they are
   Approved registry records; only `ollama`/`openrouter`/`deepseek` routes are
   callable through the pilot serving path in this build.
5. Ignis and Legacy report no token counts; their `run.tokens` is 0 by their own
   accounting, not a gateway omission.
6. The gateway's per-turn Fence runs accumulate in the Fence ledgers like Door
   runs do; no cleanup job was added (out of scope).

---

## Coordinator addendum (2026-11-23, after the civ endpoints landed)

Two gateway patches were applied by the coordinator after the civ builder
delivered `POST /agents`, `POST /task`, and `GET /ledger` on port 18711.
The live `gateway.py` was patched in place (original backed up on the
Alienware as `gateway.py.bak-20261123`), restarted via the standard WMI
launcher, and re-verified healthy after each patch:

1. **Civ creation status fix** — `/agents/create` treated only HTTP 200 as
   instantiation success; the civ service returns **201**. The check now
   accepts 200/201 and also reads a nested `agent.id`. Verified live:
   `POST /agents/create {name:"Coordinator Verify", role:"builder",
   home:"civilization"}` → `fence_status: granted`,
   `civ_status: "instantiated"`, `civ_agent_id: "agent-07"`, run
   `gw-create-20261123-113028-033865`; world state agent count 6 → 7.
   (An earlier creation, "Coordinator Demo", had already instantiated —
   count 5 → 6 — under the old label; the substance worked, the label
   lagged.)
2. **`GET /world/ledger` added** — proxies civ `GET /ledger` verbatim
   (Bearer-gated, mirrors `/world/state`). Verified: 200 with the sim's
   ledger (18 structures at check time); unauthenticated → 401.

**Joint integration demos — now complete** (they were pending the civ
endpoints at gateway build time):
- Creation → Fence GRANTED → agent in civ state with before/after counts:
  5 → 6 ("Coordinator Demo") and 6 → 7 ("Coordinator Verify", agent-07).
- Society dispatch: a civilization-platform chat turn returned a genuine
  society answer — route `AI Civilization / society`,
  `agents_involved` Mara (agent-01) + Juno (agent-04),
  `activity_ref: task-221262-17823`, Fence granted, Langfuse trace
  `41155f85ce68e9adcaec4f65f353183a`. The answer is labeled in-text by the
  society layer as retrieval-grounded (corpora + One Memory + live state;
  no model call in that layer).
