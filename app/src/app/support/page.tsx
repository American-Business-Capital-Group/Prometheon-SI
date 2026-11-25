export default function SupportPage() {
  return (
    <>
      <h1>Support</h1>
      <p>
        Prometheon SI is a product of the American Business Capital Group,
        Inc. Reach the team through ABCG&apos;s published channels:
      </p>
      <div className="grid">
        <div className="card">
          <h3>Email</h3>
          <p>
            <a href="mailto:contact@abc-angels.com">contact@abc-angels.com</a>
          </p>
          <p className="note">
            For account, billing, and product questions. Do not email
            passwords or payment-card details.
          </p>
        </div>
        <div className="card">
          <h3>Phone</h3>
          <p>
            <a href="tel:+18007357347">(800) 735-7347</a>
          </p>
          <p className="note">ABCG&apos;s published main line.</p>
        </div>
      </div>
      <h2>Common questions</h2>
      <p>
        <strong>The chat says the gateway is unreachable.</strong> The chat
        runs through the Prometheon gateway service. If no gateway answers,
        the app says so plainly and never fakes answers — try again shortly,
        and contact support if it persists.
      </p>
      <p>
        <strong>How is usage billed?</strong> At landed supplier cost × 1.35,
        metered per run against your wallet, with a $25 minimum top-up. The
        route and token count are printed on every assistant reply.
      </p>
      <p>
        <strong>Is paid checkout live?</strong> Not yet — checkout is in test
        mode and activating soon. The free trial works without payment in
        the meantime.
      </p>
    </>
  );
}
