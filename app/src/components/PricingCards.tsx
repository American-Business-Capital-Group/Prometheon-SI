import Link from "next/link";
import { TIERS } from "@/lib/pricing";

export default function PricingCards() {
  return (
    <>
      <div className="grid">
        {TIERS.map((t) => (
          <div className="card" key={t.id}>
            <h3>{t.name}</h3>
            <p className="price">{t.priceNote}</p>
            <p>{t.blurb}</p>
            <p className="note">
              Platform charge from ${t.monthlyPlatformUsd.toLocaleString()}/mo
              at the minimum of {t.minSeats} seat{t.minSeats > 1 ? "s" : ""}.
            </p>
          </div>
        ))}
      </div>
      <p className="note muted">
        On every package, model usage is billed separately at landed supplier
        cost × 1.35, metered per run against your wallet. The minimum wallet
        top-up is $25. Paying the platform charge annually in advance earns a
        15% discount on the platform charge; usage is never discounted.
      </p>
      <p>
        <Link href="/signup" className="btn">
          Start the free trial
        </Link>{" "}
        <span className="muted">
          Paid checkout is in test mode and activating soon — the trial works
          without any payment.
        </span>
      </p>
    </>
  );
}
