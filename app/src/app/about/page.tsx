import Link from "next/link";
import { PLATFORMS } from "@/lib/platforms";

export default function AboutPage() {
  return (
    <>
      <h1>About Us</h1>
      <p>
        Prometheon SI is built and operated by the American Business Capital
        Group, Inc. It is one unified application with five platforms:
      </p>
      <ul>
        {PLATFORMS.map((p) => (
          <li key={p.id}>
            <Link href={p.href}>{p.label}</Link> — {p.tagline}
          </li>
        ))}
      </ul>
      <p>
        The idea is simple to state and strict in practice: instead of a
        separate account and a separate app for every model and every agent
        system, one composer routes work across a governed registry, one
        Fence governs every agent spawn, and one wallet meters usage at
        landed cost × 1.35 with the route and token count printed on every
        answer.
      </p>
      <p>
        What runs today is a working pilot: routing over a 5,507-record
        registry with 95 Approved records, Fence-governed recursive spawning
        verified in live demonstrations, and a staging agent society of
        Supervisors and Workers. The full beta release is scheduled for
        February 1, 2027. We describe the system as it is — the registry
        counts, the verification step, and the limits are published on this
        site rather than rounded up.
      </p>
      <p className="tagline" style={{ fontFamily: "var(--font-cinzel), serif", color: "var(--flame-gold)" }}>
        Powering human achievement.
      </p>
      <p>
        Contact: <a href="mailto:contact@abc-angels.com">contact@abc-angels.com</a>{" "}
        · (800) 735-7347
      </p>
    </>
  );
}
