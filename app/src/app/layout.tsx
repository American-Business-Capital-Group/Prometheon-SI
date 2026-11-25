import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Prometheon SI — Powering human achievement.",
  description:
    "Prometheon SI is one unified app: an LLM aggregate, recursive agents, and an agentic society — five platforms in a single chat, routed over a governed registry.",
  icons: { icon: "/app-icon.png" },
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/process", label: "The Process" },
  { href: "/about", label: "About Us" },
  { href: "/subscribe", label: "Subscribe" },
  { href: "/platforms/prometheon", label: "LLM — Prometheon SI" },
  { href: "/platforms/legacy-agents", label: "Agents" },
  { href: "/platforms/ai-civilization", label: "Agent World" },
  { href: "/login", label: "Login" },
  { href: "/download", label: "Download App" },
  { href: "/support", label: "Support" },
  { href: "/datacenters", label: "Our Datacenters" },
  { href: "/social", label: "Our Social" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <head>
        {/* Gateway discovery candidates; must load before app JS runs. */}
        <script src="/gateway-config.js" />
      </head>
      <body>
        <div className="ticker" role="note">
          Full Beta Release 2/1/2027
        </div>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="Prometheon SI home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-lockup.png" alt="Prometheon SI" />
          </Link>
          <nav className="site-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
            <Link href="/chat" className="nav-cta">
              Open Chat
            </Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p className="tagline">Powering human achievement.</p>
          <p>
            Prometheon SI is a product of the American Business Capital
            Group, Inc.
          </p>
          <p className="version-line">v1.00</p>
          <p className="version-line">
            Artificial Intelligence Designed Exclusively by the American Business Capital Group, Inc. © 2026 All Rights Reserved
          </p>
        </footer>
      </body>
    </html>
  );
}
