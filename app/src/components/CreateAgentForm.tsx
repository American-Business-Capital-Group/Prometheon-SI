"use client";

import { useState } from "react";
import Link from "next/link";
import { api, getToken, GatewayUnreachable } from "@/lib/gateway";

/**
 * Legacy Agents SI is the human creation console: the person specifies
 * and commissions; Lampas — the creator engine — creates, if the Fence
 * grants it. The Fence is the single law every creation answers to, and
 * its verdict is the governing step between commission and creation.
 * Contract (gateway): POST /agents/create {name?, role, home, task?}
 *   -> {agent:{id,name,role,home}, fence_status, run_id, trace_id}
 */

interface CreateResponse {
  agent: { id: string; name: string; role: string; home: string };
  fence_status: string;
  fence_reason?: string;
  run_id?: string;
  trace_id?: string;
}

const ROLES = [
  { id: "planner", label: "Planner — directs the society's works" },
  { id: "builder", label: "Builder — constructs the society's projects" },
  { id: "surveyor", label: "Surveyor — charts land and sites" },
  { id: "keeper-of-records", label: "Keeper of Records — holds the society's memory" },
  { id: "citizen", label: "Citizen — a member of the society" },
];

type Phase = "commission" | "sending" | "done" | "error";

export default function CreateAgentForm() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("builder");
  const [home, setHome] = useState<"civilization" | "platform">("civilization");
  const [task, setTask] = useState("");
  const [phase, setPhase] = useState<Phase>("commission");
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!getToken()) {
      setPhase("error");
      setError("Sign in first — commissions are made under your Prometheon SI account.");
      return;
    }
    setPhase("sending");
    try {
      const res = await api<CreateResponse>("/agents/create", {
        method: "POST",
        body: {
          ...(name.trim() ? { name: name.trim() } : {}),
          role,
          home,
          ...(task.trim() ? { task: task.trim() } : {}),
        },
      });
      setResult(res);
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof GatewayUnreachable
          ? "The gateway is unreachable, so the commission cannot reach the Fence. Nothing was created."
          : err instanceof Error
            ? err.message
            : "The commission failed.",
      );
    }
  }

  const granted = result?.fence_status === "GRANTED";

  return (
    <section id="commission" className="commission">
      <h2>Commission a new agent</h2>
      <p>
        This console is where humans create — through the engine, under the
        law. You specify and commission; <strong>Lampas, the creator
        engine</strong>, brings the agent into being — but only if{" "}
        <strong>the Fence</strong> grants it. The Fence is the single law
        every creation answers to: Jon&apos;s law, enforced on every spawn,
        the engine&apos;s included.
      </p>

      <form onSubmit={submit} className="commission-form">
        <label>
          Name <span className="muted">(optional — the engine names it if you don&apos;t)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ada"
            maxLength={60}
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Home
          <select
            value={home}
            onChange={(e) => setHome(e.target.value as "civilization" | "platform")}
          >
            <option value="civilization">AI Civilization — the created world</option>
            <option value="platform">Platform — a Legacy Agents worker</option>
          </select>
        </label>
        <label>
          Purpose <span className="muted">(optional first task for the agent)</span>
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Help build the district's next structure"
            maxLength={300}
          />
        </label>
        <button className="btn" type="submit" disabled={phase === "sending"}>
          {phase === "sending" ? "Before the Fence…" : "Submit commission to the engine"}
        </button>
      </form>

      {phase === "sending" && (
        <div className="fence-box" role="status">
          <h3>The Fence</h3>
          <p>Your commission is with the Fence — the one check every creation clears…</p>
        </div>
      )}

      {phase === "error" && error && (
        <div className="fence-box denied" role="alert">
          <h3>Commission not completed</h3>
          <p className="error">{error}</p>
        </div>
      )}

      {phase === "done" && result && (
        <div className={`fence-box ${granted ? "granted" : "denied"}`} role="status">
          <h3>The Fence: {result.fence_status}</h3>
          {result.fence_reason && <p>{result.fence_reason}</p>}
          {granted ? (
            <>
              <p>
                <strong>
                  The engine created {result.agent.name}
                </strong>{" "}
                — {result.agent.role}, home:{" "}
                {result.agent.home === "civilization"
                  ? "AI Civilization"
                  : "the platform"}
                .
              </p>
              {result.agent.home === "civilization" && (
                <p>
                  <Link href="/agent-world" className="btn secondary">
                    See {result.agent.name} in the Agent World
                  </Link>
                </p>
              )}
              <p className="muted">
                Agent {result.agent.id}
                {result.run_id ? ` · run ${result.run_id}` : ""}
                {result.trace_id ? ` · trace ${result.trace_id}` : ""}
              </p>
            </>
          ) : (
            <p>
              The Fence denied this commission, so the engine did not create
              the agent. Nothing was spawned.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
