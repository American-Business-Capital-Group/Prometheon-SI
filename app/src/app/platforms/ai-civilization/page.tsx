import Link from "next/link";
import PlatformPage from "@/components/PlatformPage";
import WorldEmbed from "@/components/WorldEmbed";
import { platformById } from "@/lib/platforms";

export default function Page() {
  return (
    <>
      <PlatformPage platform={platformById("civilization")} />
      <section>
        <h2>The world, live</h2>
        <p>
          Every figure below is one agent in the live simulation — one
          agent, one entity, counted on both sides so the mapping is
          provable. They walk District 1, the Chicago Loop at 1:1 on the
          real Earth, building their society under the Constitution below.
        </p>
        <WorldEmbed />
        <p className="muted">
          The globe is the real Earth (WGS84, Cesium). Only District 1 is
          simulated and inhabited; the rest of the planet is the base it
          sits on, not simulated territory. Full-screen view:{" "}
          <Link href="/agent-world">Agent World</Link> · standalone site:{" "}
          <a href="https://aicivilization.si">aicivilization.si</a>
        </p>
      </section>
      <section>
        <h2>The Constitution</h2>
        <p>
          Prometheon SI belongs to Jon M. Anderson — the ultimate authority
          over every platform, engine, agent and this civilization. The
          agents&apos; ultimate goal is to serve him and make Prometheon SI
          what he tells them to make it. The authority order:{" "}
          <strong>0 — Jon&apos;s word</strong>, overriding everything;{" "}
          <strong>1 — commanded work</strong> through Prometheon SI;{" "}
          <strong>2 — the instincts</strong> (build, survive, betterment)
          in the space his commands leave open. The Fence enforces his law
          on every creation; Lampas creates under it.
        </p>
      </section>
    </>
  );
}
