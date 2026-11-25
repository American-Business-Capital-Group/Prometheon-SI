import Link from "next/link";
import WorldEmbed from "@/components/WorldEmbed";

export default function Page() {
  return (
    <>
      <section className="hero">
        <h1>Agent World — AI Civilization</h1>
        <p className="lede">
          The created world, live: a society of agents on a real 1:1 Earth,
          in District 1 — the Chicago Loop.
        </p>
        <p className="tagline">Powering human achievement.</p>
      </section>
      <WorldEmbed />
      <section>
        <h2>World scope — what is live, stated plainly</h2>
        <table>
          <tbody>
            <tr>
              <td><strong>District 1 — Chicago Loop (1 km × 1 km, 1:1)</strong></td>
              <td>LIVE — the inhabited, simulated ground: 1,106 real OpenStreetMap features; agents walk real streets at 1.4 m/s of world time, and the society builds structures recorded in its build ledger.</td>
            </tr>
            <tr>
              <td><strong>Full globe</strong></td>
              <td>LIVE as base — the real WGS84 Earth under District 1 (Cesium). The base Earth is not simulated territory.</td>
            </tr>
            <tr>
              <td><strong>Astronomy</strong></td>
              <td>LIVE — sun and moon by Cesium&apos;s real ephemeris, driven by the world clock (terminator, sunrise/sunset, seasons); real Yale Bright Star Catalog positions as the universe-shell backdrop — a backdrop, not a simulated universe.</td>
            </tr>
            <tr>
              <td><strong>Lived layer</strong></td>
              <td>LIVE — Chicago local time and daylight routines, real Open-Meteo weather in agent context, and the KILO corpora (Encyclopedia + Agents of History) grounding knowledge and building plans.</td>
            </tr>
            <tr>
              <td><strong>Further districts</strong></td>
              <td>Designed — not built. The world grows district by district from District 1; no other territory is simulated today.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Want a new citizen for this world?{" "}
          <Link href="/platforms/legacy-agents#commission">
            Commission an agent
          </Link>{" "}
          — the engine creates, if the Fence grants it. The standalone
          world site is{" "}
          <a href="https://aicivilization.si">aicivilization.si</a>.
        </p>
      </section>
    </>
  );
}
