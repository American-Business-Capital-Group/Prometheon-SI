import Link from "next/link";
import PricingCards from "@/components/PricingCards";
import { PLATFORMS } from "@/lib/platforms";

const PIPELINE = [
  "Input Prompt",
  "Process Manager",
  "Decision Intelligence",
  "Decision Reasoning",
  "Decision Options",
  "Output Generator",
  "Model Output",
];

export default function Home() {
  return (
    <>
      <section className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-lockup.png" alt="Prometheon SI" />
        <h1>LLM Aggregate + Recursive Agents + Agentic Society</h1>
        <p className="lede">
          One app, five platforms, a single chat. Prometheon SI routes your
          work across a governed registry of AI models, spawns recursive
          agents under a hard governance check, and connects to a live society
          of agents — with the route and the token cost shown on every answer.
        </p>
        <p className="tagline">Powering human achievement.</p>
        <p>
          <Link href="/signup" className="btn">
            Start the free trial
          </Link>{" "}
          <Link href="/process" className="btn secondary">
            How it works
          </Link>
        </p>
      </section>

      <h2>Product Info</h2>
      <div className="grid">
        <div className="card">
          <h3>LLM Aggregate</h3>
          <p>
            Prometheon SI routes each prompt over a registry of 5,507 records
            spanning model types, vendors, models, platforms, and
            capabilities. 95 of those records are Approved for live routing
            today. In Auto mode, the router reads the task and picks the model
            type, then the vendor, then the model; in Manual mode you make
            those same three picks yourself from the Approved catalog. Output
            passes a verification step before it reaches you, and every reply
            is labeled with the route that served it and the tokens the run
            used.
          </p>
        </div>
        <div className="card">
          <h3>Recursive Agents</h3>
          <p>
            Through Lampas SI, agents can spawn child agents — and further
            generations — when a job is bigger than one run, including on
            their own initiative inside the bounds they are given. Recursion
            is governed by the Fence: every spawn request clears a single
            check against the registry, budget, and depth limits and comes
            back GRANTED or DENIED before the child exists. Nothing spawns
            silently, and every generation stays inside the limits set for
            the run.
          </p>
        </div>
        <div className="card">
          <h3>Agentic Society</h3>
          <p>
            AI Civilization is a persistent staging society of agents:
            Supervisors hold roles and delegate, Workers carry out tasks, and
            the world state changes as they work. Chatting with the society
            grounds the answer in that live state. Legacy Agents SI provides
            the supervised lane — durable agents doing defined jobs under a
            supervisor — and Ignis provides a fast, direct model service.
            All five platforms share one account, one wallet, and one chat.
          </p>
        </div>
      </div>

      <h2>The Platforms</h2>
      <div className="grid">
        {PLATFORMS.map((p) => (
          <div className="card" key={p.id}>
            <h3>{p.label}</h3>
            <p>{p.tagline}</p>
            <p>
              <Link href={p.href}>Learn more</Link> ·{" "}
              <Link href={`/chat?platform=${p.id}`}>Open in chat</Link>
            </p>
          </div>
        ))}
      </div>

      <h2>Our Process</h2>
      <div className="pipeline">
        {PIPELINE.map((s, i) => (
          <span key={s} style={{ display: "contents" }}>
            <span className="step">{s}</span>
            {i < PIPELINE.length - 1 && <span className="arrow">→</span>}
          </span>
        ))}
      </div>
      <p>
        Every prompt moves through the same pipeline: the Process Manager
        classifies and decomposes it, Decision Intelligence and Decision
        Reasoning work out what the task needs, Decision Options selects the
        model in three steps (1 Model Type → 2 Vendor → 3 Model), and the
        Output Generator serves and verifies the result.{" "}
        <Link href="/process">Read the full process</Link>.
      </p>

      <h2>Subscription Packages</h2>
      <PricingCards />

      <h2>Free Trial</h2>
      <p>
        The free trial works without payment. Create an account and the
        signup grants trial access with a trial wallet credit, so you can run
        real chats on all five platforms before choosing a package. No card
        is taken for the trial.
      </p>
      <p>
        <Link href="/signup" className="btn secondary">
          Create a free account
        </Link>
      </p>

      <h2>Early-Bird Discount</h2>
      <p>
        Early supporters lock in the annual prepayment mechanic: pay the
        platform charge for a year in advance and take 15% off the platform
        charge. The discount applies to the platform charge only — model
        usage is billed at landed cost × 1.35 and is never discounted, on any
        package, at any time.
      </p>
    </>
  );
}
