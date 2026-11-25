interface SocialLink {
  platform: string;
  href: string;
  label: string;
  note: string;
}

// Verification (2026-11-23): only profiles that could be verified for
// ABCG / Prometheon SI are linked directly. Every other platform links to
// the platform root — no handle is ever invented. See SITE_NOTES.md.
const LINKS: SocialLink[] = [
  {
    platform: "GitHub",
    href: "https://github.com/American-Business-Capital-Group",
    label: "American-Business-Capital-Group",
    note: "Verified organization — source code, releases, and the desktop app builds.",
  },
  {
    platform: "Instagram",
    href: "https://www.instagram.com/prometheon_si/",
    label: "@prometheon_si",
    note: "Verified Prometheon SI profile — brand and release announcements.",
  },
  {
    platform: "X",
    href: "https://x.com",
    label: "X",
    note: "Find us on X.",
  },
  {
    platform: "Facebook",
    href: "https://www.facebook.com",
    label: "Facebook",
    note: "Find us on Facebook.",
  },
  {
    platform: "LinkedIn",
    href: "https://www.linkedin.com",
    label: "LinkedIn",
    note: "Find us on LinkedIn.",
  },
  {
    platform: "Discord",
    href: "https://discord.com",
    label: "Discord",
    note: "Find our community on Discord.",
  },
  {
    platform: "Bluesky",
    href: "https://bsky.app",
    label: "Bluesky",
    note: "Find us on Bluesky.",
  },
  {
    platform: "Mastodon",
    href: "https://mastodon.social",
    label: "Mastodon",
    note: "Find us on Mastodon.",
  },
];

export default function SocialPage() {
  return (
    <>
      <h1>Our Social</h1>
      <p>
        Prometheon SI is a product of the American Business Capital Group,
        Inc. Follow the work where it is published:
      </p>
      <div className="grid">
        {LINKS.map((l) => (
          <div className="card" key={l.platform}>
            <h3>{l.platform}</h3>
            <p>
              <a href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            </p>
            <p className="note">{l.note}</p>
          </div>
        ))}
      </div>
    </>
  );
}
