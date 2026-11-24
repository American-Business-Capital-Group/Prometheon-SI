# Prometheon SI — Unified App & Site

**LLM Aggregate + Recursive Agents + Agentic Society.** Powering human achievement.

One app: a browser chat where all model types and LLMs flow together through
the Prometheon SI workflow — Input Prompt → Process Manager → Decision
Intelligence → Decision Reasoning → Decision Options (1 Model Type →
2 Vendor → 3 Model) → Output Generator → Model Output — with recursive
agents under the Fence, sub-chats, and projects.

Platforms (one chat, one dropdown labeled **PROMETHEON SI**):
Prometheon SI · Legacy Agents SI · Lampas SI by Pyr Neural Network ·
Ignis by Pyr Neural Network · AI Civilization.

## Layout
- `app/` — Next.js static-export site + chat app (source)
- `docs/` — built static site, served by GitHub Pages (custom domain prometheon.si)
- `desktop/` — Electron wrapper (macOS / Windows / Linux installers via CI)
- `.github/workflows/` — desktop release workflow
- `gateway-ref/` — reference copy of the chat gateway that runs on the
  Prometheon pilot host (the app is a static front end; all chat runs
  through the gateway, behind account login)
- `API_SPEC.md` / `ARCHITECTURE.md` — the contract and the design

v1.00 · Artificial Intelligence Designed Exclusively by the American Business Capital Group, Inc. © 2026 All Rights Reserved
