import PricingCards from "@/components/PricingCards";

export default function SubscribePage() {
  return (
    <>
      <h1>Subscribe</h1>
      <p>
        Four packages, one rule set: the platform charge buys the workspace,
        and model usage is metered separately at landed cost × 1.35 against
        your wallet, with a $25 minimum top-up. Annual prepayment of the
        platform charge earns 15% off the platform charge. Usage is never
        discounted.
      </p>
      <PricingCards />
      <h2>Free trial first</h2>
      <p>
        You do not need a package to start. Signup grants trial access with a
        trial wallet credit — no payment details taken. Paid checkout is
        currently in test mode and activating soon; when it opens, package
        activation will happen from this page.
      </p>
    </>
  );
}
