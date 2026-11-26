"""Prometheon SI - unified chat gateway (v1.00).

FastAPI service implementing API_SPEC.md v1.00. Runs on the Alienware in
C:\\AI\\prometheon-pilot beside the pilot stack, in the same agents venv
as door.py. Binds the tailnet IP (100.89.231.37, mirroring door.py) plus
127.0.0.1 (for Tailscale Funnel / local probes) - never the LAN.

Platforms:
  prometheon   - real pilot pipeline: router.rank (K5 v2) + serve.serve_task
                 (output contract + K6 v2 verification/escalation), every
                 turn registered as a Fence run (8799) and Langfuse-traced.
  legacy       - Legacy Agents SI pilot supervisor.py run as a bounded
                 subprocess (its own spawns.sqlite registry).
  lampas       - Lampas recursive engine via lampas_run.py subprocess
                 (core.run_mission on the dedicated Lampas Fence, 8798).
  ignis        - Ignis HTTP service at 127.0.0.1:8790 (POST /route).
  civilization - AICivilization state API (18711) grounding a real routed
                 model call via serve.py; state-only fallback, labeled.

Auth: SQLite gateway.db; passwords hashed with hashlib.pbkdf2_hmac
(per-user salt; bcrypt is not installed in the agents venv); bearer
tokens are stdlib HMAC-SHA256 signed JWTs (PyJWT is not installed).
Signup seeds a free-trial wallet (trial credit only - no payment paths).
"""
import base64
import csv
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import subprocess
import sys
import threading
import time
import uuid

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "gateway.db")
ROSTER = r"C:\AI\model-deck\roster.csv"
FENCE_URL = os.environ.get("PROMETHEON_FENCE_URL", "http://127.0.0.1:8799")
IGNIS_URL = "http://127.0.0.1:8790"
CIV_URL = "http://127.0.0.1:18711"
CIV_DIR = r"C:\AI\aicivilization-pilot"
LEGACY_DIR = r"C:\AI\legacy-agents-pilot"
PYTHON = sys.executable
TRIAL_CREDIT_MICRO_USD = 5_000_000  # $5.00 free-trial credit, labeled trial
TOKEN_TTL_SECONDS = 7 * 24 * 3600

VERSION = "v1.01"
ADAPTERS_FILE = os.path.join(HERE, "gateway_adapters.json")
LAMPAS_FENCE_URL = "http://127.0.0.1:8798"


def load_adapter_registry():
    """Gateway-carried routable adapter records (roster.csv is never
    edited for these). Each record is lifecycle-governed exactly like a
    roster record: only Lifecycle == 'Approved' may route (S-11)."""
    try:
        with open(ADAPTERS_FILE, encoding="utf-8") as f:
            return json.load(f).get("entries", [])
    except Exception:
        return []


def adapter_record(model_id):
    for e in load_adapter_registry():
        if e["id"] == model_id or e["api_id"] == model_id:
            return e
    return None

# --------------------------------------------------------------------------
# Catalog static data: the 25 AI model types (Master List v2.08 tables
# T-2 registry categories A-I + T-3's 16 ASI model classes) and the LLM
# class labels from API_SPEC / the build brief.
# --------------------------------------------------------------------------
REGISTRY_TYPES = [
    ("reg-a-models", "A \u2014 Models"),
    ("reg-b-agents", "B \u2014 Agents"),
    ("reg-c-security", "C \u2014 Security"),
    ("reg-d-environments", "D \u2014 Environments"),
    ("reg-e-addons", "E \u2014 Add-Ons"),
    ("reg-f-plugins", "F \u2014 Plug-ins"),
    ("reg-g-training-knowledge", "G \u2014 Training / Knowledge Base"),
    ("reg-h-resources", "H \u2014 Resources"),
    ("reg-i-weights", "I \u2014 Weights"),
]
ASI_TYPES = [
    ("asi-neural-models-algorithms", "Neural models, Algorithms & computing"),
    ("asi-multi-sensory", "Multi-sensory AI models"),
    ("asi-neuromorphic", "Neuromorphic computing & algorithms"),
    ("asi-evolutionary", "Evolutionary models"),
    ("asi-problem-solving", "Problem solving models"),
    ("asi-decision-making", "Decision-making models"),
    ("asi-neuralese", "Neuralese recurrence, and other Neural languages"),
    ("asi-error-reduction", "Error-Reduction models"),
    ("asi-human-ethics", "Human Ethics models"),
    ("asi-creativity", "Creativity models"),
    ("asi-collective-intelligence", "Collective Intelligence models"),
    ("asi-agentic-evolutionary", "Agentic Evolutionary models"),
    ("asi-existential", "Existential AI models"),
    ("asi-automated", "Automated AI models"),
    ("asi-goal-based", "Goal-based AI models"),
    ("asi-neural-networks", "Neural Networks, models, computing & algorithms"),
]
LLM_CLASSES = [
    "decoder-only autoregressive", "encoder-only", "encoder-decoder",
    "mixture-of-experts", "dense", "state-space/hybrid", "retrieval-native",
    "base", "instruction-tuned", "preference-aligned chat", "reasoning",
    "distilled", "text-only", "vision-language", "speech/audio-language",
    "omni-modal", "code", "math/formal", "guard/safety", "embedding",
    "reranking", "small language model", "domain-specific", "multilingual",
    "agentic/tool-use",
]


def _slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def llm_class_for(model_name, api_id):
    """Primary LLM class for a roster record, derived from its Model /
    ApiId strings only (documented heuristic; the roster carries no
    architecture field). Default: instruction-tuned."""
    n = (model_name or "").lower()
    a = (api_id or "").lower()
    if "embedding" in n or "embed" in a:
        return "embedding"
    if "guard" in n:
        return "guard/safety"
    if "rerank" in n or "rerank" in a:
        return "reranking"
    if "coder" in n or "codex" in n or "code" in a:
        return "code"
    if "r1" in n or "reasoning" in n or "inkling" in n:
        return "reasoning"
    if "-vl" in a or " vl" in n or "vision" in n or "-vl-" in a:
        return "vision-language"
    if "a95b" in a or "moe" in n:
        return "mixture-of-experts"
    m = re.search(r"(\d+(?:\.\d+)?)b\b", n + " " + a)
    if m and float(m.group(1)) <= 9:
        return "small language model"
    return "instruction-tuned"


def load_roster():
    with open(ROSTER, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def approved_models():
    out = []
    seen = set()
    for r in load_roster():
        if (r.get("Lifecycle") or "").strip() != "Approved":
            continue
        mid = f"{r['Route']}::{r['ApiId']}"
        if mid in seen:
            continue  # duplicate deployment record (same route+api_id)
        seen.add(mid)
        cls = llm_class_for(r["Model"], r["ApiId"])
        out.append({
            "id": mid, "label": r["Model"], "vendor": r["Company"],
            "model_type": "llm-" + _slug(cls), "route": r["Route"],
            "lifecycle": "Approved", "api_id": r["ApiId"],
            "category": r.get("Category", ""),
        })
    return out


def build_catalog():
    types = [{"id": i, "label": l, "group": "registry"}
             for i, l in REGISTRY_TYPES]
    types += [{"id": i, "label": l, "group": "asi-component"}
              for i, l in ASI_TYPES]
    types += [{"id": "llm-" + _slug(c), "label": c, "group": "llm-class"}
              for c in LLM_CLASSES]
    models = approved_models()
    for e in load_adapter_registry():
        models.append({"id": e["id"], "label": e["label"],
                       "vendor": e["vendor"], "model_type": e["model_type"],
                       "route": e["route"], "lifecycle": e["lifecycle"],
                       "source": "gateway-adapter-registry",
                       "description": e.get("description", "")})
    vendors = sorted({m["vendor"] for m in models if m["vendor"]})
    return {
        "model_types": types,
        "vendors": [{"id": _slug(v), "label": v} for v in vendors],
        "models": [{k: m[k] for k in
                    ("id", "label", "vendor", "model_type", "route",
                     "lifecycle") if k in m} |
                   ({"source": m["source"],
                     "description": m["description"]}
                    if "source" in m else {})
                   for m in models],
    }


# --------------------------------------------------------------------------
# SQLite store
# --------------------------------------------------------------------------
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
            name TEXT, pw_hash TEXT NOT NULL, salt TEXT NOT NULL,
            created_at REAL);
        CREATE TABLE IF NOT EXISTS wallets (
            user_id TEXT PRIMARY KEY, balance_micro_usd INTEGER NOT NULL,
            plan TEXT NOT NULL, kind TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
            pinned_app INTEGER NOT NULL DEFAULT 0, created_at REAL);
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
            title TEXT, platform TEXT NOT NULL,
            parent_id TEXT, project_id TEXT,
            fence_run_id TEXT, fence_agent_id TEXT, fence_grant TEXT,
            fence_status TEXT,
            created_at REAL, updated_at REAL);
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
            role TEXT NOT NULL, content TEXT, route TEXT,
            created_at REAL);
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
            name TEXT, role TEXT, home TEXT, task TEXT,
            fence_run_id TEXT, fence_grant TEXT, fence_status TEXT,
            civ_agent_id TEXT, civ_status TEXT,
            registry_source TEXT, trace_id TEXT, created_at REAL);
    """)
    if conn.execute("SELECT v FROM meta WHERE k='jwt_secret'").fetchone() is None:
        conn.execute("INSERT INTO meta VALUES ('jwt_secret', ?)",
                     (secrets.token_hex(32),))
    conn.commit()
    conn.close()


def _jwt_secret():
    conn = db()
    row = conn.execute("SELECT v FROM meta WHERE k='jwt_secret'").fetchone()
    conn.close()
    return row["v"].encode()


def _b64e(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64d(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_token(user):
    now = int(time.time())
    head = _b64e(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64e(json.dumps({"sub": user["id"], "email": user["email"],
                             "iat": now, "exp": now + TOKEN_TTL_SECONDS}
                            ).encode())
    sig = _b64e(hmac.new(_jwt_secret(), f"{head}.{body}".encode(),
                         hashlib.sha256).digest())
    return f"{head}.{body}.{sig}"


def verify_token(token):
    try:
        head, body, sig = token.split(".")
        want = _b64e(hmac.new(_jwt_secret(), f"{head}.{body}".encode(),
                              hashlib.sha256).digest())
        if not hmac.compare_digest(want, sig):
            return None
        payload = json.loads(_b64d(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def hash_password(password, salt_hex=None):
    salt = bytes.fromhex(salt_hex) if salt_hex else os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return dk.hex(), salt.hex()


# --------------------------------------------------------------------------
# Pilot stack (lazy imports - same pattern as door.py importing core)
# --------------------------------------------------------------------------
_pilot = {}
_pilot_lock = threading.Lock()


def pilot():
    with _pilot_lock:
        if not _pilot:
            import brains as _brains
            import core as _core
            import router as _router
            import serve as _serve
            import tracing as _tracing
            _pilot.update(brains=_brains, core=_core, router=_router,
                          serve=_serve, tracing=_tracing)
        return _pilot


def fence_post(path, payload, timeout=30, base_url=None):
    with httpx.Client(base_url=base_url or FENCE_URL, timeout=timeout) as c:
        return c.post(path, json=payload)


def fence_create_run(run_id, mission, tenant, base_url=None):
    try:
        r = fence_post("/runs", {"run_id": run_id, "mission": mission,
                                 "budget_tokens": 600000, "max_agents": 25,
                                 "tenant": tenant}, base_url=base_url)
        return r.status_code in (200, 409)
    except Exception:
        return False


def fence_register(run_id, agent_id, parent_id, depth, role, route, api_id,
                   base_url=None):
    """Direct Fence registration naming the ACTUAL serving brain, so the
    ledger record matches the route used (core.FenceClient.register
    derives the brain from the deck; the Fence API itself accepts the
    explicit brain fields, and S-11 lifecycle is enforced server-side
    either way). Returns (granted, grant_id_or_reason)."""
    try:
        r = fence_post("/register", {
            "run_id": run_id, "agent_id": agent_id, "parent_id": parent_id,
            "depth": depth, "role": role, "brain_route": route,
            "brain_api_id": api_id}, base_url=base_url)
        body = r.json()
        if body.get("granted"):
            return True, body.get("grant_id")
        return False, body.get("reason", "refused")
    except Exception as e:
        return False, f"fence unreachable: {e}"


def fence_debit(run_id, agent_id, tokens, base_url=None):
    try:
        fence_post("/debit", {"run_id": run_id, "agent_id": agent_id,
                              "tokens": int(tokens)}, base_url=base_url)
    except Exception:
        pass


def fence_complete(run_id, agent_id, status="completed", summary="",
                   base_url=None):
    try:
        fence_post("/complete", {"run_id": run_id, "agent_id": agent_id,
                                 "status": status,
                                 "summary": summary[:200]}, base_url=base_url)
    except Exception:
        pass


def fence_tree(run_id):
    try:
        with httpx.Client(base_url=FENCE_URL, timeout=15) as c:
            return c.get(f"/tree/{run_id}").json()
    except Exception:
        return {}


DECK0 = ("openrouter", "deepseek/deepseek-v3.2")   # brains.brain_for(0)
DECK1 = ("ollama", "kimi-k2.6:cloud")              # brains.brain_for(1)


# --------------------------------------------------------------------------
# App + CORS (API_SPEC + Phase 2 standalone domains, same gateway)
# --------------------------------------------------------------------------
app = FastAPI(title="Prometheon SI Gateway", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://prometheon.si", "https://www.prometheon.si",
        "https://lampasagents.si", "https://www.lampasagents.si",
        "https://pyr.network", "https://www.pyr.network",
        "https://aicivilization.si", "https://www.aicivilization.si",
        "https://american-business-capital-group.github.io",
        "null",  # desktop app file/null origin
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SignupReq(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginReq(BaseModel):
    email: str
    password: str


class ConvReq(BaseModel):
    title: str | None = None
    platform: str = "prometheon"
    project_id: str | None = None
    parent_id: str | None = None


class ConvPatch(BaseModel):
    title: str | None = None
    project_id: str | None = None


class ProjectReq(BaseModel):
    name: str


class ProjectPatch(BaseModel):
    name: str | None = None
    pinned_app: bool | None = None


class ChatReq(BaseModel):
    conversation_id: str
    message: str
    platform: str = "prometheon"
    selection: dict | None = None


def current_user(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    payload = verify_token(auth[7:].strip())
    if not payload:
        raise HTTPException(401, "invalid or expired token")
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE id=?",
                       (payload["sub"],)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(401, "unknown user")
    return dict(row)


def _user_out(u):
    return {"id": u["id"], "email": u["email"], "name": u["name"]}


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
@app.post("/auth/signup")
def signup(req: SignupReq):
    email = req.email.strip().lower()
    if not email or len(req.password) < 8:
        raise HTTPException(400, "email and a password of 8+ chars required")
    conn = db()
    if conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
        conn.close()
        raise HTTPException(400, "email already registered")
    uid = uuid.uuid4().hex
    pw_hash, salt = hash_password(req.password)
    conn.execute("INSERT INTO users VALUES (?,?,?,?,?,?)",
                 (uid, email, req.name or "", pw_hash, salt, time.time()))
    conn.execute("INSERT INTO wallets VALUES (?,?,?,?)",
                 (uid, TRIAL_CREDIT_MICRO_USD, "free-trial", "trial"))
    conn.commit()
    conn.close()
    user = {"id": uid, "email": email, "name": req.name or ""}
    return {"token": make_token(user), "user": user}


@app.post("/auth/login")
def login(req: LoginReq):
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE email=?",
                       (req.email.strip().lower(),)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(401, "invalid credentials")
    dk, _ = hash_password(req.password, row["salt"])
    if not hmac.compare_digest(dk, row["pw_hash"]):
        raise HTTPException(401, "invalid credentials")
    user = _user_out(dict(row))
    return {"token": make_token(user), "user": user}


@app.get("/auth/me")
def me(user=Depends(current_user)):
    conn = db()
    w = conn.execute("SELECT * FROM wallets WHERE user_id=?",
                     (user["id"],)).fetchone()
    conn.close()
    return {"user": _user_out(user),
            "wallet": {"balance_micro_usd": w["balance_micro_usd"] if w else 0},
            "plan": w["plan"] if w else "free-trial"}


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------
@app.get("/catalog")
def catalog():
    return build_catalog()


# --------------------------------------------------------------------------
# Conversations / projects
# --------------------------------------------------------------------------
def _conv_out(r):
    return {"id": r["id"], "title": r["title"], "platform": r["platform"],
            "parent_id": r["parent_id"], "project_id": r["project_id"],
            "fence_run_id": r["fence_run_id"],
            "fence_agent_id": r["fence_agent_id"],
            "fence_grant": r["fence_grant"],
            "fence_status": r["fence_status"],
            "created_at": r["created_at"], "updated_at": r["updated_at"]}


def _ensure_conv_fence_run(conn, conv):
    """Root conversations own a persistent Fence run (conv-<id>) with a
    registered supervisor S (deck gen-0 brain). Returns (run_id, status)."""
    if conv["fence_run_id"]:
        return conv["fence_run_id"], conv["fence_status"]
    run_id = f"conv-{conv['id']}"
    ok = fence_create_run(run_id, "gateway-chat", conv["user_id"])
    if not ok:
        return None, "fence unreachable at conversation setup"
    granted, grant = fence_register(run_id, "S", None, 0, "gateway-supervisor",
                                    DECK0[0], DECK0[1])
    status = "granted" if granted else f"refused: {grant}"
    conn.execute("UPDATE conversations SET fence_run_id=?, fence_agent_id=?, "
                 "fence_grant=?, fence_status=? WHERE id=?",
                 (run_id, "S", grant if granted else None, status, conv["id"]))
    conn.commit()
    return run_id, status


@app.get("/conversations")
def list_conversations(user=Depends(current_user)):
    conn = db()
    rows = conn.execute("SELECT * FROM conversations WHERE user_id=? "
                        "ORDER BY updated_at DESC", (user["id"],)).fetchall()
    conn.close()
    return [_conv_out(r) for r in rows]


@app.post("/conversations")
def create_conversation(req: ConvReq, user=Depends(current_user)):
    conn = db()
    cid = uuid.uuid4().hex
    now = time.time()
    fence_run_id = fence_agent_id = fence_grant = fence_status = None
    if req.parent_id:
        parent = conn.execute("SELECT * FROM conversations WHERE id=? "
                              "AND user_id=?", (req.parent_id, user["id"])
                              ).fetchone()
        if parent is None:
            conn.close()
            raise HTTPException(404, "parent conversation not found")
        # Sub-chat creation registers a child spawn with the Fence in the
        # PARENT conversation's run: parent agent S, depth 1, deck gen-1
        # brain. The spawn record references the parent conversation.
        run_id, _st = _ensure_conv_fence_run(conn, dict(parent))
        fence_run_id = run_id
        fence_agent_id = f"sub-{cid[:10]}"
        if run_id:
            granted, grant = fence_register(
                run_id, fence_agent_id, "S", 1,
                f"sub-chat of conversation {req.parent_id}",
                DECK1[0], DECK1[1])
            fence_grant = grant if granted else None
            fence_status = "granted" if granted else f"refused: {grant}"
        else:
            fence_status = "refused: parent fence run unavailable"
    conn.execute("INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                 (cid, user["id"], req.title or "New chat", req.platform,
                  req.parent_id, req.project_id, fence_run_id, fence_agent_id,
                  fence_grant, fence_status, now, now))
    conn.commit()
    row = conn.execute("SELECT * FROM conversations WHERE id=?",
                       (cid,)).fetchone()
    conn.close()
    return _conv_out(row)


@app.patch("/conversations/{cid}")
def patch_conversation(cid: str, req: ConvPatch, user=Depends(current_user)):
    conn = db()
    row = conn.execute("SELECT * FROM conversations WHERE id=? AND user_id=?",
                       (cid, user["id"])).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(404, "conversation not found")
    if req.title is not None:
        conn.execute("UPDATE conversations SET title=?, updated_at=? WHERE id=?",
                     (req.title, time.time(), cid))
    if req.project_id is not None:
        conn.execute("UPDATE conversations SET project_id=?, updated_at=? "
                     "WHERE id=?", (req.project_id, time.time(), cid))
    conn.commit()
    row = conn.execute("SELECT * FROM conversations WHERE id=?",
                       (cid,)).fetchone()
    conn.close()
    return _conv_out(row)


@app.delete("/conversations/{cid}")
def delete_conversation(cid: str, user=Depends(current_user)):
    conn = db()
    cur = conn.execute("DELETE FROM conversations WHERE id=? AND user_id=?",
                       (cid, user["id"]))
    conn.execute("DELETE FROM messages WHERE conversation_id=?", (cid,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(404, "conversation not found")
    return {"ok": True, "deleted": cid}


@app.get("/conversations/{cid}/messages")
def list_messages(cid: str, user=Depends(current_user)):
    conn = db()
    conv = conn.execute("SELECT id FROM conversations WHERE id=? AND user_id=?",
                        (cid, user["id"])).fetchone()
    if conv is None:
        conn.close()
        raise HTTPException(404, "conversation not found")
    rows = conn.execute("SELECT * FROM messages WHERE conversation_id=? "
                        "ORDER BY created_at", (cid,)).fetchall()
    conn.close()
    return [{"id": r["id"], "role": r["role"], "content": r["content"],
             "route": json.loads(r["route"]) if r["route"] else None,
             "created_at": r["created_at"]} for r in rows]


@app.get("/projects")
def list_projects(user=Depends(current_user)):
    conn = db()
    rows = conn.execute("SELECT * FROM projects WHERE user_id=? "
                        "ORDER BY created_at", (user["id"],)).fetchall()
    conn.close()
    return [{"id": r["id"], "name": r["name"],
             "pinned_app": bool(r["pinned_app"]),
             "created_at": r["created_at"]} for r in rows]


@app.post("/projects")
def create_project(req: ProjectReq, user=Depends(current_user)):
    pid = uuid.uuid4().hex
    conn = db()
    conn.execute("INSERT INTO projects VALUES (?,?,?,?,?)",
                 (pid, user["id"], req.name, 0, time.time()))
    conn.commit()
    conn.close()
    return {"id": pid, "name": req.name, "pinned_app": False}


@app.patch("/projects/{pid}")
def patch_project(pid: str, req: ProjectPatch, user=Depends(current_user)):
    conn = db()
    row = conn.execute("SELECT * FROM projects WHERE id=? AND user_id=?",
                       (pid, user["id"])).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(404, "project not found")
    if req.name is not None:
        conn.execute("UPDATE projects SET name=? WHERE id=?", (req.name, pid))
    if req.pinned_app is not None:
        conn.execute("UPDATE projects SET pinned_app=? WHERE id=?",
                     (1 if req.pinned_app else 0, pid))
    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return {"id": row["id"], "name": row["name"],
            "pinned_app": bool(row["pinned_app"]),
            "created_at": row["created_at"]}


# --------------------------------------------------------------------------
# World (AI Civilization live state for the world view)
# --------------------------------------------------------------------------
@app.get("/world/state")
def world_state(user=Depends(current_user)):
    """Proxy the AICivilization state API verbatim - the view builder
    maps entities 1:1 from these exact fields."""
    try:
        with httpx.Client(timeout=15) as c:
            r = c.get(f"{CIV_URL}/state")
        return JSONResponse(r.json(), status_code=r.status_code)
    except Exception as e:
        raise HTTPException(502, f"civilization state unavailable: {e}")


@app.get("/world/ledger")
def world_ledger(user=Depends(current_user)):
    """Proxy the AICivilization build ledger (GET 18711/ledger) verbatim -
    structures, projects, territory, survival, as served by the sim."""
    try:
        with httpx.Client(timeout=15) as c:
            r = c.get(f"{CIV_URL}/ledger")
        return JSONResponse(r.json(), status_code=r.status_code)
    except Exception as e:
        raise HTTPException(502, f"civilization ledger unavailable: {e}")


@app.get("/world/geometry")
def world_geometry(user=Depends(current_user)):
    """The civ service exposes NO geometry endpoint (verified: /geography,
    /tile, /geometry all 404). Tile geometry lives as files in the civ
    pilot dir; this returns the parsed geography.json with its source
    labeled. tile.osm.xml (raw OSM XML) is file-only (8.3 MB)."""
    path = os.path.join(CIV_DIR, "geography.json")
    try:
        with open(path, encoding="utf-8") as f:
            geo = json.load(f)
    except Exception as e:
        raise HTTPException(502, f"geography file unreadable: {e}")
    return {"source": f"file:{path}", "format": "geography.json (OSM-derived JSON)",
            "osm_xml_file": os.path.join(CIV_DIR, "tile.osm.xml"),
            "geography": geo}


# --------------------------------------------------------------------------
# Chat - per-platform handlers. Each returns
# (content, route_dict, run_dict).
# --------------------------------------------------------------------------
def _new_run_id(platform):
    return f"gw-{platform}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"


def _route_for_record(rec, route_label=None):
    cls = llm_class_for(rec["label"], rec["api_id"])
    return {"model_type": cls, "vendor": rec["vendor"], "model": rec["label"],
            "route_label": route_label or f"{rec['route']}/{rec['api_id']}"}


def _find_approved(model_id):
    for m in approved_models():
        if m["id"] == model_id or m["api_id"] == model_id:
            return m
    return None


def _model_label(route, api_id):
    for m in approved_models():
        if m["route"] == route and m["api_id"] == api_id:
            return m
    return None


def chat_prometheon(user, message, selection):
    p = pilot()
    mode = (selection or {}).get("mode", "auto")
    run_id = _new_run_id("prometheon")
    if mode == "manual":
        ad = adapter_record((selection or {}).get("model_id", ""))
        if ad is not None:
            # Gateway adapter-registry records route like roster records:
            # S-11 lifecycle check first, then platform dispatch.
            if ad.get("lifecycle") != "Approved":
                raise HTTPException(
                    400, f"manual selection refused: adapter record "
                         f"{ad['id']} is {ad.get('lifecycle')}; only "
                         f"Approved records are routable")
            if ad["route"] == "civilization":
                return chat_civilization(user, message)
            if ad["route"] == "lampas":
                return chat_lampas(user, message)
        rec = _find_approved((selection or {}).get("model_id", ""))
        if rec is None:
            raise HTTPException(
                400, "manual selection refused: model is not an Approved "
                     "roster record (S-11 lifecycle enforcement)")
        cls = p["router"].classify(message)
        decision = {"classification": cls,
                    "chosen": {"route": rec["route"], "api_id": rec["api_id"],
                               "model": rec["label"], "score": None,
                               "tags": ["manual"], "reasons": ["manual"]},
                    "ranking": [], "strict_policy_check": bool(cls.get("sensitive"))}
    else:
        decision = p["router"].rank(message)
        if decision["chosen"] is None:
            raise HTTPException(502, "router: no routable candidate")
        rec = _model_label(decision["chosen"]["route"],
                           decision["chosen"]["api_id"]) or {
            "route": decision["chosen"]["route"],
            "api_id": decision["chosen"]["api_id"],
            "label": decision["chosen"]["model"], "vendor": "",
            "model_type": "", "lifecycle": "Approved", "id": "", "category": ""}
    fence_create_run(run_id, "prometheon", user["email"])
    granted, grant = fence_register(run_id, "S", None, 0, "gateway-supervisor",
                                    rec["route"], rec["api_id"])
    fence_status = "granted" if granted else f"refused: {grant}"
    if not granted:
        raise HTTPException(403, f"fence refused this turn: {grant}")
    try:
        with p["tracing"].run_context(run_id, "prometheon", message) as tr:
            out = p["serve"].serve_task(message, decision=decision)
            tr.output = {"chars": len(out["output"]), "tokens": out["tokens"]}
            trace_id = tr.id
    finally:
        pass
    tokens = int(out["tokens"])
    fence_debit(run_id, "S", tokens)
    fence_complete(run_id, "S", "completed", out["output"][:200])
    final_route, _, final_api = out["final_model"].partition("/")
    final_rec = _model_label(final_route, final_api) or rec
    route = _route_for_record(final_rec,
                              route_label=out["final_model"])
    route["requested_model"] = rec["label"] if mode == "manual" else None
    route["escalated"] = bool(out.get("escalated"))
    return out["output"], route, {"run_id": run_id, "fence_status": fence_status,
                                  "tokens": tokens, "trace_id": trace_id}


def chat_legacy(user, message):
    run_id = _new_run_id("legacy")
    fence_create_run(run_id, "legacy", user["email"])
    granted, grant = fence_register(run_id, "S", None, 0, "gateway-legacy-wrapper",
                                    DECK0[0], DECK0[1])
    fence_status = "granted" if granted else f"refused: {grant}"
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    try:
        proc = subprocess.run(
            [PYTHON, os.path.join(LEGACY_DIR, "supervisor.py"),
             "--task", message],
            cwd=LEGACY_DIR, env=env, capture_output=True, text=True,
            timeout=480)
        text_out = proc.stdout or ""
    except subprocess.TimeoutExpired:
        fence_complete(run_id, "S", "failed", "legacy supervisor timeout")
        raise HTTPException(504, "legacy supervisor timed out (480s)")
    agg = ""
    m = re.search(r"=== AGGREGATE ===\s*(.*?)\s*=== VERIFICATION ===\s*(.*)",
                  text_out, flags=re.S)
    if m:
        agg = m.group(1).strip()
        ver = m.group(2).strip()
        content = agg + ("\n\nVerification: " + ver if ver else "")
    else:
        tail = (text_out or proc.stderr or "")[-2000:]
        content = ("[Legacy Agents SI supervisor run - aggregate section "
                   "not parsed; raw tail follows]\n" + tail)
    fence_complete(run_id, "S", "completed", content[:200])
    route = {"model_type": "collective-intelligence",
             "vendor": "Legacy Agents SI",
             "model": "supervisor.py (LangGraph, 20-lane registry)",
             "route_label": "legacy-supervisor"}
    return content, route, {"run_id": run_id, "fence_status": fence_status,
                            "tokens": 0, "trace_id": None}


def chat_lampas(user, message):
    run_id = _new_run_id("lampas")
    helper = os.path.join(HERE, "lampas_run.py")
    out_path = os.path.join(HERE, "results",
                            f"gateway-lampas-{run_id}.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    try:
        proc = subprocess.run(
            [PYTHON, helper, "--task", message, "--run-id", run_id,
             "--out", out_path],
            cwd=HERE, env=env, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "lampas run timed out (600s)")
    if not os.path.isfile(out_path):
        raise HTTPException(502, "lampas run produced no result: "
                                 + (proc.stderr or "")[-500:])
    with open(out_path, encoding="utf-8") as f:
        rec = json.load(f)
    agents = rec.get("agents", {})
    summary = (f"[Lampas SI bounded recursion - run {rec['run_id']} on the "
               f"Lampas Fence (8798): {rec.get('agent_count')} agent(s), "
               f"max depth {rec.get('max_depth_reached')}, "
               f"{rec.get('run_tokens')} tokens debited of "
               f"{rec.get('run_budget')} budget]\n\n")
    content = summary + rec.get("result", "")
    route = {"model_type": "agentic-evolutionary / recursive agents",
             "vendor": "Lampas SI by Pyr Neural Network",
             "model": "core.run_mission (Lampas Fence, depth<=3)",
             "route_label": "lampas-recursion"}
    return content, route, {"run_id": rec["run_id"],
                            "fence_status": "granted (lampas fence 8798)",
                            "tokens": int(rec.get("run_tokens") or 0),
                            "trace_id": rec.get("trace_id")}


def chat_ignis(user, message):
    run_id = _new_run_id("ignis")
    fence_create_run(run_id, "ignis", user["email"])
    granted, grant = fence_register(run_id, "S", None, 0, "gateway-ignis-wrapper",
                                    DECK0[0], DECK0[1])
    fence_status = "granted" if granted else f"refused: {grant}"
    try:
        with httpx.Client(timeout=320) as c:
            r = c.post(f"{IGNIS_URL}/route", json={"input": message})
        rec = r.json()
    except Exception as e:
        fence_complete(run_id, "S", "failed", f"ignis unreachable: {e}")
        raise HTTPException(502, f"ignis service unreachable: {e}")
    content = rec.get("response", "")
    fence_complete(run_id, "S", "completed", content[:200])
    route = {"model_type": f"ignis-intent:{rec.get('intent')}",
             "vendor": rec.get("brain", "ignis"),
             "model": rec.get("model", ""),
             "route_label": f"ignis/{rec.get('brain')}/{rec.get('model')}"}
    return content, route, {"run_id": run_id, "fence_status": fence_status,
                            "tokens": 0, "trace_id": None}


def chat_civilization(user, message):
    run_id = _new_run_id("civilization")
    try:
        with httpx.Client(timeout=15) as c:
            state = c.get(f"{CIV_URL}/state").json()
    except Exception as e:
        raise HTTPException(502, f"civilization state unavailable: {e}")
    agents = state.get("agents", [])
    lines = [f"- {a.get('name')} ({a.get('id')}): at lat {a.get('lat')}, "
             f"lon {a.get('lon')}, heading to {a.get('target_name')} "
             f"(target {a.get('target_id')}), "
             f"{a.get('distance_traveled_m')} m travelled, "
             f"{a.get('actions_count')} actions"
             for a in agents]
    state_summary = (
        f"Live AICivilization world state - {state.get('tile')}; "
        f"tick {state.get('tick')}; world time {state.get('world_time')}; "
        f"{state.get('feature_count')} features; "
        f"{state.get('action_log_count')} logged actions.\nAgents:\n"
        + "\n".join(lines)
        + f"\nLast action: {json.dumps(state.get('last_action'))}")
    # Society dispatch (integration spec): the civilization society is a
    # callable, lifecycle-governed routing entry carried in the gateway
    # adapter registry. POST the task to the civ service's /task endpoint;
    # societal agents take it up in-world and the society answers. While
    # that endpoint is unavailable (501 at build time), fall through to
    # the grounded-model path below, labeled world-state.
    ad = adapter_record("civilization::society")
    if ad and ad.get("lifecycle") == "Approved":
        fence_create_run(run_id, "civilization", user["email"])
        granted_s, grant_s = fence_register(
            run_id, "S", None, 0, "gateway-civilization-society",
            DECK0[0], DECK0[1])
        if granted_s:
            body = {}
            trace_s = None
            try:
                with pilot()["tracing"].run_context(
                        run_id, "civilization", message) as tr:
                    try:
                        with httpx.Client(timeout=180) as c:
                            resp = c.post(f"{CIV_URL}/task",
                                          json={"task": message,
                                                "context": state_summary})
                        if resp.status_code == 200:
                            body = resp.json()
                    except Exception:
                        body = {}
                    trace_s = tr.id
            except Exception:
                body = {}
            if body.get("answer"):
                fence_complete(run_id, "S", "completed",
                               str(body["answer"])[:200])
                route = {"model_type": "agentic/tool-use",
                         "vendor": "AI Civilization",
                         "model": "AI Civilization Society",
                         "route_label": "AI Civilization / society",
                         "agents_involved": body.get("agents_involved"),
                         "activity_ref": body.get("activity_ref")}
                return body["answer"], route, {
                    "run_id": run_id, "fence_status": "granted",
                    "tokens": 0, "trace_id": trace_s}
    p = pilot()
    decision = p["router"].rank(message + "\n" + state_summary[:1000])
    if decision["chosen"] is None:
        return (state_summary + "\n\n[state-only: no routable model]",
                {"model_type": "world-state", "vendor": "AICivilization SI",
                 "model": "none (state-only)", "route_label": "world-state"},
                {"run_id": run_id, "fence_status": "not-run (state-only)",
                 "tokens": 0, "trace_id": None})
    rec = _model_label(decision["chosen"]["route"],
                       decision["chosen"]["api_id"]) or {
        "route": decision["chosen"]["route"],
        "api_id": decision["chosen"]["api_id"],
        "label": decision["chosen"]["model"], "vendor": "",
        "model_type": "", "lifecycle": "Approved", "id": "", "category": ""}
    fence_create_run(run_id, "civilization", user["email"])
    granted, grant = fence_register(run_id, "S", None, 0,
                                    "gateway-civilization", rec["route"],
                                    rec["api_id"])
    if not granted:
        return (state_summary + f"\n\n[state-only: fence refused model leg: {grant}]",
                {"model_type": "world-state", "vendor": "AICivilization SI",
                 "model": "none (state-only)", "route_label": "world-state"},
                {"run_id": run_id, "fence_status": f"refused: {grant}",
                 "tokens": 0, "trace_id": None})
    grounded = ("Answer the user's question using ONLY the live world "
                "state below as fact about the world.\n\n"
                f"WORLD STATE:\n{state_summary}\n\nQUESTION:\n{message}")
    try:
        with p["tracing"].run_context(run_id, "civilization", message) as tr:
            out = p["serve"].serve_task(grounded, decision=decision)
            trace_id = tr.id
    except Exception as e:
        fence_complete(run_id, "S", "failed", f"model leg failed: {e}")
        return (state_summary + f"\n\n[state-only: model leg failed: {e}]",
                {"model_type": "world-state", "vendor": "AICivilization SI",
                 "model": "none (state-only)", "route_label": "world-state"},
                {"run_id": run_id, "fence_status": "granted",
                 "tokens": 0, "trace_id": None})
    tokens = int(out["tokens"])
    fence_debit(run_id, "S", tokens)
    fence_complete(run_id, "S", "completed", out["output"][:200])
    final_route, _, final_api = out["final_model"].partition("/")
    final_rec = _model_label(final_route, final_api) or rec
    route = _route_for_record(final_rec, route_label="world-state")
    route["grounded_model"] = out["final_model"]
    route["dispatch_mode"] = ("grounded-model (civ POST /task endpoint "
                              "unavailable at call time)")
    return out["output"], route, {"run_id": run_id,
                                  "fence_status": "granted",
                                  "tokens": tokens, "trace_id": trace_id}


class AgentCreateReq(BaseModel):
    name: str | None = None
    role: str
    home: str
    task: str | None = None


@app.post("/agents/create")
def create_agent(req: AgentCreateReq, user=Depends(current_user)):
    """Engine-creation path (role doctrine): Legacy Agents SI is the
    human creation console; Lampas is the creator engine that brings the
    agent into being; EVERY creation clears THE FENCE first - here the
    Lampas Fence (8798), the same registration path core.py uses
    (create run -> register supervisor -> register the new agent as its
    depth-1 child, budget/depth/lifecycle enforced server-side).
    A denial creates nothing. Callable mid-work from any Prometheon chat
    context - same Bearer auth, no separate credential."""
    if req.home not in ("civilization", "platform"):
        raise HTTPException(400, "home must be 'civilization' or 'platform'")
    if not req.role.strip():
        raise HTTPException(400, "role is required")
    agent_id = uuid.uuid4().hex
    name = (req.name or "").strip() or f"agent-{agent_id[:8]}"
    run_id = (f"gw-create-{time.strftime('%Y%m%d-%H%M%S')}-"
              f"{uuid.uuid4().hex[:6]}")
    p = pilot()
    with p["tracing"].run_context(run_id, "agent-create",
                                  req.task or req.role) as tr:
        trace_id = tr.id
        fence_create_run(run_id, "agent-create", user["email"],
                         base_url=LAMPAS_FENCE_URL)
        granted, grant = fence_register(
            run_id, "S", None, 0, "lampas-creator-engine",
            DECK0[0], DECK0[1], base_url=LAMPAS_FENCE_URL)
        if granted:
            granted, grant = fence_register(
                run_id, f"agent-{agent_id[:10]}", "S", 1,
                f"created agent: {req.role} (home={req.home})",
                DECK0[0], DECK0[1], base_url=LAMPAS_FENCE_URL)
        if not granted:
            return {"agent": None, "fence_status": "denied",
                    "reason": grant, "run_id": run_id,
                    "trace_id": trace_id,
                    "engine": "Lampas (creator engine)"}
        civ_agent_id = None
        civ_status = None
        if req.home == "civilization":
            # Instantiation endpoint implemented by the civ builder:
            # POST /agents {name, role} on 18711. Probed at build time:
            # 501 (service has no POST handler yet) - recorded honestly.
            try:
                with httpx.Client(timeout=30) as c:
                    resp = c.post(f"{CIV_URL}/agents",
                                  json={"name": name, "role": req.role})
                if resp.status_code in (200, 201):
                    data = resp.json()
                    civ_agent_id = (data.get("id") or data.get("agent_id")
                                    or (data.get("agent") or {}).get("id"))
                    civ_status = "instantiated"
                else:
                    civ_status = (f"pending-civ-endpoint "
                                  f"(POST /agents -> {resp.status_code})")
            except Exception as e:
                civ_status = f"pending-civ-endpoint ({type(e).__name__})"
            registry_source = "gateway-adapter-registry"
        else:
            civ_status = "platform-record"
            registry_source = ("gateway-adapter-registry (platform agent "
                               "record; runtime = the pilot's agent lanes; "
                               "no running worker is fabricated - the "
                               "record + Fence grant is the deliverable)")
        conn = db()
        conn.execute("INSERT INTO agents VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                     (agent_id, user["id"], name, req.role, req.home,
                      req.task, run_id, grant, "granted", civ_agent_id,
                      civ_status, registry_source, trace_id, time.time()))
        conn.commit()
        conn.close()
        fence_complete(run_id, f"agent-{agent_id[:10]}", "completed",
                       f"created {name} role={req.role} home={req.home}",
                       base_url=LAMPAS_FENCE_URL)
        return {"agent": {"id": agent_id, "name": name, "role": req.role,
                          "home": req.home},
                "fence_status": "granted", "run_id": run_id,
                "trace_id": trace_id,
                "engine": "Lampas (creator engine)",
                "civ_agent_id": civ_agent_id, "civ_status": civ_status,
                "registry_source": registry_source}


@app.get("/agents")
def list_agents(user=Depends(current_user)):
    conn = db()
    rows = conn.execute("SELECT * FROM agents WHERE user_id=? "
                        "ORDER BY created_at", (user["id"],)).fetchall()
    conn.close()
    return [{"id": r["id"], "name": r["name"], "role": r["role"],
             "home": r["home"], "task": r["task"],
             "fence_run_id": r["fence_run_id"],
             "fence_status": r["fence_status"],
             "civ_agent_id": r["civ_agent_id"],
             "civ_status": r["civ_status"],
             "registry_source": r["registry_source"],
             "trace_id": r["trace_id"], "created_at": r["created_at"]}
            for r in rows]


@app.post("/chat")
def chat(req: ChatReq, user=Depends(current_user)):
    message = req.message.strip()
    if not message:
        raise HTTPException(400, "empty message")
    conn = db()
    conv = conn.execute("SELECT * FROM conversations WHERE id=? AND user_id=?",
                        (req.conversation_id, user["id"])).fetchone()
    if conv is None:
        conn.close()
        raise HTTPException(404, "conversation not found")
    platform = req.platform or conv["platform"] or "prometheon"
    if platform == "prometheon":
        content, route, run = chat_prometheon(user, message, req.selection)
    elif platform == "legacy":
        content, route, run = chat_legacy(user, message)
    elif platform == "lampas":
        content, route, run = chat_lampas(user, message)
    elif platform == "ignis":
        content, route, run = chat_ignis(user, message)
    elif platform == "civilization":
        content, route, run = chat_civilization(user, message)
    else:
        conn.close()
        raise HTTPException(400, f"unknown platform: {platform}")
    now = time.time()
    conn.execute("INSERT INTO messages VALUES (?,?,?,?,?,?)",
                 (uuid.uuid4().hex, req.conversation_id, "user", message,
                  None, now))
    conn.execute("INSERT INTO messages VALUES (?,?,?,?,?,?)",
                 (uuid.uuid4().hex, req.conversation_id, "assistant", content,
                  json.dumps(route), now))
    conn.execute("UPDATE conversations SET updated_at=? WHERE id=?",
                 (now, req.conversation_id))
    conn.commit()
    conn.close()
    return {"message": {"role": "assistant", "content": content,
                        "route": route},
            "run": run, "conversation_id": req.conversation_id}


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
@app.get("/health")
def health():
    def ok(url):
        try:
            with httpx.Client(timeout=5) as c:
                return c.get(url).status_code == 200
        except Exception:
            return False
    fence_ok = False
    try:
        with httpx.Client(timeout=5) as c:
            fence_ok = c.get(f"{FENCE_URL}/health").json().get("status") == "ok"
    except Exception:
        fence_ok = False
    platforms = {
        "prometheon": fence_ok,
        "legacy": os.path.isfile(os.path.join(LEGACY_DIR, "supervisor.py")),
        "lampas": ok("http://127.0.0.1:8798/health"),
        "ignis": ok(f"{IGNIS_URL}/health"),
        "civilization": ok(f"{CIV_URL}/health"),
    }
    return {"service": "prometheon-gateway", "status": "ok",
            "version": VERSION, "fence": fence_ok, "platforms": platforms}


init_db()

if __name__ == "__main__":
    import asyncio
    import socket

    import uvicorn
    # Mirror door.py's posture (tailnet IP only) + localhost so Tailscale
    # Funnel and on-box probes can reach it; the LAN never sees 8811.
    socks = []
    for host in ("100.89.231.37", "127.0.0.1"):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, 8811))
        s.listen(128)
        s.setblocking(False)
        socks.append(s)
    config = uvicorn.Config(app, log_level="warning")
    asyncio.run(uvicorn.Server(config).serve(sockets=socks))
