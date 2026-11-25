/**
 * Gateway client per API_SPEC.md (v1.00).
 * Discovers the gateway from window.PROMETHEON_GATEWAYS (gateway-config.js,
 * loaded by the root layout before app JS), probing GET /health on each
 * candidate in order. Falls back to the built-in candidate list if the
 * config script has not landed yet. If no candidate answers, callers get a
 * GatewayUnreachable error and the UI shows an explicit unreachable state.
 */

export const DEFAULT_GATEWAYS = [
  "https://FUNNEL_URL_PENDING",
  "http://100.89.231.37:8811",
];

const TOKEN_KEY = "prometheon_token";

declare global {
  interface Window {
    PROMETHEON_GATEWAYS?: string[];
  }
}

export class GatewayUnreachable extends Error {
  constructor() {
    super("gateway unreachable");
    this.name = "GatewayUnreachable";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

let basePromise: Promise<string> | null = null;

async function probe(base: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return !!body && body.service === "prometheon-gateway";
  } catch {
    return false;
  }
}

async function discover(): Promise<string> {
  // gateway-config.js is a plain script loaded before app JS, but wait a
  // beat in case it is still in flight; then fall back to the defaults.
  let candidates = window.PROMETHEON_GATEWAYS;
  if (!candidates || candidates.length === 0) {
    await new Promise((r) => setTimeout(r, 1200));
    candidates = window.PROMETHEON_GATEWAYS ?? DEFAULT_GATEWAYS;
  }
  for (const base of candidates) {
    if (await probe(base)) return base.replace(/\/$/, "");
  }
  throw new GatewayUnreachable();
}

export function gatewayBase(): Promise<string> {
  if (!basePromise) {
    basePromise = discover().catch((e) => {
      basePromise = null; // allow retry after a failure
      throw e;
    });
  }
  return basePromise;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const base = await gatewayBase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && (body.detail || body.error)) detail = body.detail ?? body.error;
    } catch {
      /* keep the status line */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/* ---- API types (API_SPEC.md) ---- */

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CatalogModel {
  id: string;
  label: string;
  vendor: string;
  model_type: string;
  route: string;
  lifecycle: string;
}

export interface Catalog {
  model_types: { id: string; label: string; group: string }[];
  vendors: { id: string; label: string }[];
  models: CatalogModel[];
}

export interface Conversation {
  id: string;
  title: string;
  platform: string;
  parent_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  pinned_app?: boolean;
}

export interface RouteInfo {
  model_type?: string;
  vendor?: string;
  model?: string;
  route_label?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  route?: RouteInfo | null;
  tokens?: number | null;
  created_at?: string;
}

export interface ChatResponse {
  message: {
    role: "assistant";
    content: string;
    route: RouteInfo;
  };
  run: {
    run_id: string;
    fence_status: string;
    tokens: number;
    trace_id: string;
  };
  conversation_id: string;
}
