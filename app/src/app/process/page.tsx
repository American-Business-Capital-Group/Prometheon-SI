import Link from "next/link";

const STEPS = [
  {
    title: "1. Input Prompt",
    body: "Your prompt enters through the single composer in the chat app, tagged with the platform you selected — Prometheon SI, Legacy Agents SI, Lampas SI, Ignis, or AI Civilization — and with your Decision Options: Auto, or a manual Model Type → Vendor → Model selection.",
  },
  {
    title: "2. Process Manager",
    body: "The Process Manager classifies the task and decomposes it into the work that needs doing. It is the front door of the pilot router: every turn becomes a registered run here, before any model is called.",
  },
  {
    title: "3. Decision Intelligence",
    body: "Decision Intelligence reads the decomposed task against the governed registry — 5,507 records covering model types, vendors, models, platforms, and capabilities, with lifecycle status enforced so only Approved records can serve live work.",
  },
  {
    title: "4. Decision Reasoning",
    body: "Decision Reasoning weighs the candidate routes for the task: what kind of model the work needs, which vendors offer it, and which specific model fits — using a difficulty rubric rather than a fixed default.",
  },
  {
    title: "5. Decision Options — 1 Model Type → 2 Vendor → 3 Model",
    body: "The selection is made in three cascading steps: first the model type, then the vendor that offers it, then the model itself. In Auto mode the router decides; in Manual mode you decide, in the chat composer, from the same Approved catalog the router uses.",
  },
  {
    title: "6. Output Generator",
    body: "The Output Generator serves the selected model's answer through the pilot serving path, applies an output contract, and runs a verification pass with completeness audits. When an answer fails verification, the run escalates to a fresh generation instead of shipping the failed output.",
  },
  {
    title: "7. Model Output",
    body: "You receive the answer labeled with the route that served it — model type, vendor, and model — plus the run's token count, its Fence status, and its trace id. Every run is traced end to end, so any answer can be audited after the fact.",
  },
];

export default function ProcessPage() {
  return (
    <>
      <h1>The Process</h1>
      <p>
        Every prompt on Prometheon SI moves through the same seven-stage
        pipeline — the Workflow Map. Nothing bypasses it: not a manual model
        pick, not an agent spawn, not a sub-chat.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/workflow-map.png"
        alt="Prometheon SI Workflow Map v1.00"
        className="workflow-map"
      />
      {STEPS.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <p>{s.body}</p>
        </section>
      ))}

      <h2>THE FENCE</h2>
      <p>
        Every spawn clears the Fence. When an agent — or a sub-chat you
        create — wants to bring another agent into existence, the request
        goes through one governance check against the registry, the budget,
        and the depth limits, and comes back with exactly one of two answers:
      </p>
      <div className="grid">
        <div className="card">
          <h3>GRANTED</h3>
          <p>
            The spawn is inside the registered limits. The child run is
            created, linked to its parent run and conversation, and traced
            like any other run.
          </p>
        </div>
        <div className="card">
          <h3>DENIED</h3>
          <p>
            The spawn would break a limit — depth, budget, or lifecycle. It
            does not happen, and the parent run continues or closes with the
            denial on its record.
          </p>
        </div>
      </div>

      <h2>The Agentic Engine</h2>
      <p>
        The agent platforms run a ROMA-pattern engine — recursive,
        open-ended agent work organized as planner, executor, and verifier
        roles — across two lanes. The OpenClaw lane is the always-on front
        door for shallow, fast agent work. The Hermes lane is the deep lane
        for multi-generation work, bounded by the Fence at every level.
        Lampas SI exposes that recursion directly: agents that spawn further
        generations, on task or on their own initiative inside their bounds.
        AI Civilization keeps a separate society of Supervisors and Workers
        whose live state grounds its answers.
      </p>
      <p>
        <Link href="/chat" className="btn">
          Open the chat
        </Link>{" "}
        <Link href="/subscribe" className="btn secondary">
          See packages
        </Link>
      </p>
    </>
  );
}
