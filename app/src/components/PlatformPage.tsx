import Link from "next/link";
import type { Platform } from "@/lib/platforms";

export default function PlatformPage({ platform }: { platform: Platform }) {
  return (
    <>
      <section className="hero">
        <h1>{platform.name}</h1>
        <p className="lede">{platform.tagline}</p>
        <p className="tagline">Powering human achievement.</p>
      </section>
      {platform.description.map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      <p>
        <Link href={`/chat?platform=${platform.id}`} className="btn">
          Open in chat
        </Link>{" "}
        <Link href="/subscribe" className="btn secondary">
          See packages
        </Link>
      </p>
      <p className="muted">
        {platform.label} is one of the five platforms in the unified
        Prometheon SI app. Chats can be grouped into projects, pinned to your
        app shelf as internal apps, and branched into sub-chats.
      </p>
    </>
  );
}
