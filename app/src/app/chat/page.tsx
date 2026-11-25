"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  getToken,
  setToken,
  GatewayUnreachable,
  type Catalog,
  type ChatResponse,
  type Conversation,
  type Message,
  type Project,
} from "@/lib/gateway";
import { PLATFORMS, platformById, type PlatformId } from "@/lib/platforms";

type Status = "checking" | "ready" | "unreachable";

export default function ChatPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [platform, setPlatform] = useState<PlatformId>("prometheon");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decision Options (manual mode)
  const [selType, setSelType] = useState("");
  const [selVendor, setSelVendor] = useState("");
  const [selModel, setSelModel] = useState("");

  const messagesRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const list = await api<Conversation[]>("/conversations");
    setConversations(list);
    return list;
  }, []);

  const loadProjects = useCallback(async () => {
    const list = await api<Project[]>("/projects").catch(() => []);
    setProjects(list);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setError(null);
    const msgs = await api<Message[]>(`/conversations/${id}/messages`);
    setMessages(msgs);
  }, []);

  // Boot: login gate, gateway discovery, initial data.
  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const p = params.get("platform");
    if (p && PLATFORMS.some((x) => x.id === p)) setPlatform(p as PlatformId);

    (async () => {
      try {
        const [list] = await Promise.all([
          loadConversations(),
          loadProjects(),
          api<Catalog>("/catalog")
            .then(setCatalog)
            .catch(() => setCatalog(null)),
        ]);
        setStatus("ready");
        if (list.length > 0) {
          const first = list.find((c) => !c.parent_id) ?? list[0];
          await openConversation(first.id);
          setPlatform(platformById(first.platform).id);
        }
      } catch (err) {
        if (err instanceof GatewayUnreachable) setStatus("unreachable");
        else {
          setStatus("ready");
          setError(err instanceof Error ? err.message : "Failed to load.");
        }
      }
    })();
  }, [loadConversations, loadProjects, openConversation]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const vendorOptions = useMemo(() => {
    if (!catalog) return [];
    if (!selType) return catalog.vendors;
    const vendorIds = new Set(
      catalog.models.filter((m) => m.model_type === selType).map((m) => m.vendor),
    );
    return catalog.vendors.filter((v) => vendorIds.has(v.id));
  }, [catalog, selType]);

  const modelOptions = useMemo(() => {
    if (!catalog) return [];
    return catalog.models.filter(
      (m) =>
        (!selType || m.model_type === selType) &&
        (!selVendor || m.vendor === selVendor),
    );
  }, [catalog, selType, selVendor]);

  async function newChat(projectId?: string | null) {
    setError(null);
    try {
      const conv = await api<Conversation>("/conversations", {
        method: "POST",
        body: { platform, project_id: projectId ?? undefined },
      });
      await loadConversations();
      setMessages([]);
      setActiveId(conv.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create chat.");
    }
  }

  async function spawnSubChat(parent: Conversation) {
    setError(null);
    try {
      const conv = await api<Conversation>("/conversations", {
        method: "POST",
        body: {
          platform: parent.platform,
          parent_id: parent.id,
          project_id: parent.project_id ?? undefined,
        },
      });
      await loadConversations();
      await openConversation(conv.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not spawn sub-chat.",
      );
    }
  }

  async function createProject() {
    const name = window.prompt("Project name");
    if (!name) return;
    await api<Project>("/projects", { method: "POST", body: { name } }).catch(
      () => null,
    );
    await loadProjects();
  }

  async function renameProject(p: Project) {
    const name = window.prompt("Rename project", p.name);
    if (!name || name === p.name) return;
    await api<Project>(`/projects/${p.id}`, {
      method: "PATCH",
      body: { name },
    }).catch(() => null);
    await loadProjects();
  }

  async function togglePin(p: Project) {
    await api<Project>(`/projects/${p.id}`, {
      method: "PATCH",
      body: { pinned_app: !p.pinned_app },
    }).catch(() => null);
    await loadProjects();
  }

  async function assignProject(conv: Conversation, projectId: string) {
    await api<Conversation>(`/conversations/${conv.id}`, {
      method: "PATCH",
      body: { project_id: projectId || null },
    }).catch(() => null);
    await loadConversations();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      let convId = activeId;
      if (!convId) {
        const conv = await api<Conversation>("/conversations", {
          method: "POST",
          body: { platform },
        });
        convId = conv.id;
        setActiveId(conv.id);
        await loadConversations();
      }
      setMessages((m) => [
        ...m,
        { id: `local-${Date.now()}`, role: "user", content: text },
      ]);
      setDraft("");
      const selection =
        selModel && selType && selVendor
          ? {
              mode: "manual" as const,
              model_type: selType,
              vendor: selVendor,
              model_id: selModel,
            }
          : { mode: "auto" as const };
      const res = await api<ChatResponse>("/chat", {
        method: "POST",
        body: {
          conversation_id: convId,
          message: text,
          platform,
          selection,
        },
      });
      setMessages((m) => [
        ...m,
        {
          id: `run-${res.run.run_id}`,
          role: "assistant",
          content: res.message.content,
          route: res.message.route,
          tokens: res.run.tokens,
        },
      ]);
      await loadConversations();
    } catch (err) {
      if (err instanceof GatewayUnreachable) setStatus("unreachable");
      else setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  function logout() {
    setToken(null);
    window.location.href = "/login";
  }

  const roots = conversations.filter((c) => !c.parent_id);
  const childrenOf = (id: string) =>
    conversations.filter((c) => c.parent_id === id);
  const pinned = projects.filter((p) => p.pinned_app);
  const active = conversations.find((c) => c.id === activeId) ?? null;

  const renderConv = (c: Conversation, depth: number) => (
    <div key={c.id}>
      <div
        className={`conv-item ${c.id === activeId ? "active" : ""}`}
        style={{ marginLeft: depth ? "1rem" : 0 }}
        onClick={() => openConversation(c.id)}
      >
        <div>{c.title || "Untitled chat"}</div>
        <div className="muted" style={{ fontSize: "0.78rem" }}>
          {platformById(c.platform).label}
          {c.project_id
            ? ` · ${projects.find((p) => p.id === c.project_id)?.name ?? "Project"}`
            : ""}
        </div>
        <div className="conv-actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              spawnSubChat(c);
            }}
          >
            Spawn sub-chat
          </button>
          {projects.length > 0 && (
            <select
              value={c.project_id ?? ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => assignProject(c, e.target.value)}
              aria-label="Assign to project"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {childrenOf(c.id).map((child) => renderConv(child, depth + 1))}
    </div>
  );

  return (
    <div className="chat-shell">
      <aside className="chat-sidebar">
        <button className="btn" style={{ width: "100%" }} onClick={() => newChat()}>
          New chat
        </button>
        <a
          className="btn secondary"
          style={{ width: "100%", marginTop: "0.5rem", textAlign: "center" }}
          href="/platforms/legacy-agents#commission"
        >
          Commission an agent
        </a>
        <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
          Creation runs through Lampas, the creator engine — and clears the
          Fence, the single law every spawn answers to.
        </p>

        {pinned.length > 0 && (
          <>
            <h3>App shelf</h3>
            {pinned.map((p) => (
              <div key={p.id} className="conv-item" onClick={() => newChat(p.id)}>
                {p.name}
                <div className="muted" style={{ fontSize: "0.78rem" }}>
                  Internal app — new chat in this project
                </div>
              </div>
            ))}
          </>
        )}

        <h3>Projects</h3>
        {projects.map((p) => (
          <div key={p.id} className="conv-item">
            {p.name}
            <div className="conv-actions">
              <button type="button" onClick={() => renameProject(p)}>
                Rename
              </button>
              <button type="button" onClick={() => togglePin(p)}>
                {p.pinned_app ? "Unpin from shelf" : "Pin to app shelf"}
              </button>
              <button type="button" onClick={() => newChat(p.id)}>
                New chat
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="link-btn" onClick={createProject}>
          + Create project
        </button>

        <h3>Conversations</h3>
        {roots.length === 0 && (
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            No conversations yet. Start a new chat.
          </p>
        )}
        {roots.map((c) => renderConv(c, 0))}

        <h3>Account</h3>
        <button type="button" className="link-btn" onClick={logout}>
          Log out
        </button>
      </aside>

      <section className="chat-main">
        {status === "checking" && (
          <div className="banner">Connecting to the Prometheon gateway…</div>
        )}
        {status === "unreachable" && (
          <div className="banner error-banner">
            <strong>Gateway unreachable.</strong> The Prometheon chat gateway
            did not answer on any known address, so chat is unavailable right
            now. This app never fakes answers — please try again shortly, or
            contact support at contact@abc-angels.com / (800) 735-7347.
          </div>
        )}
        {error && (
          <div className="banner error-banner">
            <strong>Something went wrong:</strong> {error}
          </div>
        )}

        <div className="chat-messages" ref={messagesRef}>
          {messages.length === 0 && status === "ready" && (
            <p className="muted">
              {active
                ? "This conversation is empty. Send the first message below."
                : "Start a new chat, pick a platform, and send your first prompt. In Auto mode Prometheon routes it; or make the Decision Options picks yourself."}
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.content}
              {m.role === "assistant" && m.route && (
                <span className="route">
                  Route:{" "}
                  {m.route.route_label ??
                    [m.route.model_type, m.route.vendor, m.route.model]
                      .filter(Boolean)
                      .join(" · ")}
                  {typeof m.tokens === "number"
                    ? ` · ${m.tokens.toLocaleString()} tokens`
                    : ""}
                </span>
              )}
            </div>
          ))}
          {sending && <p className="muted">Running through the pipeline…</p>}
        </div>

        <form className="composer" onSubmit={send}>
          <div className="row">
            <label>
              PROMETHEON SI
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PlatformId)}
                aria-label="PROMETHEON SI"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decision Options — Model Type
              <select
                value={selType}
                onChange={(e) => {
                  setSelType(e.target.value);
                  setSelVendor("");
                  setSelModel("");
                }}
              >
                <option value="">Auto (Prometheon routes)</option>
                {catalog?.model_types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vendor
              <select
                value={selVendor}
                onChange={(e) => {
                  setSelVendor(e.target.value);
                  setSelModel("");
                }}
                disabled={!selType}
              >
                <option value="">Select vendor</option>
                {vendorOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                value={selModel}
                onChange={(e) => setSelModel(e.target.value)}
                disabled={!selVendor}
              >
                <option value="">Select model</option>
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message Prometheon SI…"
              disabled={status !== "ready"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
            />
            <button
              className="btn"
              type="submit"
              disabled={status !== "ready" || sending || !draft.trim()}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.8rem", margin: "0.5rem 0 0" }}>
            {selModel
              ? "Manual route selected — it is validated against the Approved catalog before the run."
              : "Auto (Prometheon routes): the router picks Model Type → Vendor → Model for each prompt."}{" "}
            Every reply shows its route and token count.
          </p>
        </form>
      </section>
    </div>
  );
}
