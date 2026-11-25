import Link from "next/link";
import PlatformPage from "@/components/PlatformPage";
import { platformById } from "@/lib/platforms";

export default function Page() {
  return (
    <>
      <PlatformPage platform={platformById("prometheon")} />
      <section>
        <h2>Call for creation, from here</h2>
        <p>
          Prometheon SI is the aggregator intelligence on top — everything
          works through it, including creation. When the work calls for a new
          agent, commission one: you specify it at the Legacy Agents console,
          the commission goes to Lampas — the creator engine — through the
          Fence, and on a GRANTED verdict the engine creates the agent, in
          the civilization or on the platform.
        </p>
        <p>
          <Link href="/platforms/legacy-agents#commission" className="btn">
            Commission an agent
          </Link>{" "}
          <Link href="/agent-world" className="btn secondary">
            Visit the Agent World
          </Link>
        </p>
      </section>
    </>
  );
}
