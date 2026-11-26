export type PlatformId =
  | "prometheon"
  | "legacy"
  | "lampas"
  | "ignis"
  | "civilization";

export interface Platform {
  id: PlatformId;
  /** Exact label used in the chat platform dropdown. */
  label: string;
  name: string;
  href: string;
  tagline: string;
  description: string[];
}

export const PLATFORMS: Platform[] = [
  {
    id: "prometheon",
    label: "Prometheon SI",
    name: "Prometheon SI",
    href: "/platforms/prometheon",
    tagline: "The routed aggregate: one composer over a governed model registry.",
    description: [
      "Prometheon SI is the flagship platform: a single chat composer over a governed registry of AI models and capabilities. Every prompt runs the full pipeline — Process Manager, Decision Intelligence, Decision Reasoning, Decision Options, Output Generator — and every run is registered with the Fence and traced end to end.",
      "Routing draws on a registry of 5,507 records, of which 95 are Approved for live routing today. In Auto mode the router picks the model type, vendor, and model for the task; in Manual mode you make those three picks yourself from the same Approved catalog. Assistant messages show the route that served them and the tokens the run used, so the work is auditable rather than a black box.",
    ],
  },
  {
    id: "legacy",
    label: "Legacy Agents SI",
    name: "Legacy Agents SI",
    href: "/platforms/legacy-agents",
    tagline: "The supervised agent pilot: durable agents working under a supervisor.",
    description: [
      "Legacy Agents SI is the supervised-agents platform. A supervisor agent plans and delegates work to durable worker agents, keeps the task state, and reports results back into the same chat surface as every other platform.",
      "It is the straightforward, dependable lane of the family: agents with defined jobs, supervised execution, and a clear record of what each agent did. Choose it when the work is a defined job to be carried out rather than an open-ended model task.",
    ],
  },
  {
    id: "lampas",
    label: "Lampas SI by Pyr Neural Network",
    name: "Lampas SI",
    href: "/platforms/lampas",
    tagline: "The recursive engine: agents that spawn governed generations of agents.",
    description: [
      "Lampas SI is the recursive engine, built on the Pyr Neural Network. A Lampas run can spawn child agents — and those children can spawn further generations — when the work calls for it, including on the agents' own initiative inside the bounds they are given.",
      "Recursion is governed, not open-ended: every spawn clears the Fence with a single GRANTED or DENIED check against the registry, budget, and depth limits before it exists. A Lampas chat returns a summary of the spawn tree it created alongside its answer.",
    ],
  },
  {
    id: "ignis",
    label: "Ignis by Pyr Neural Network",
    name: "Ignis",
    href: "/platforms/ignis",
    tagline: "The fast lane: a direct model service on the Pyr Neural Network.",
    description: [
      "Ignis is the direct-service lane of the Pyr Neural Network family: a lightweight HTTP model service for fast, focused work where the full routing pipeline is more than the task needs.",
      "Ignis answers through the same chat, under the same account and wallet, with its route labeled on every reply so you always know which service produced the answer.",
    ],
  },
  {
    id: "civilization",
    label: "AI Civilization",
    name: "AI Civilization",
    href: "/platforms/ai-civilization",
    tagline: "The agentic society: a live world of supervisors and workers.",
    description: [
      "AI Civilization is the agentic-society platform: a persistent staging world populated by Supervisor and Worker agents that hold roles, take on work, and coordinate with each other over time.",
      "Chatting with AI Civilization grounds the model's answer in the live state of that world — who is doing what, and what has changed. If the model leg is unavailable, the platform returns the live state summary labeled as such; it never invents world state.",
    ],
  },
];

export function platformById(id: string): Platform {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}
