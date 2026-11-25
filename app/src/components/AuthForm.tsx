"use client";

import { useState } from "react";
import Link from "next/link";
import { api, setToken, GatewayUnreachable, type AuthResponse } from "@/lib/gateway";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<AuthResponse>(
        mode === "signup" ? "/auth/signup" : "/auth/login",
        {
          method: "POST",
          auth: false,
          body:
            mode === "signup"
              ? { email, password, name }
              : { email, password },
        },
      );
      setToken(res.token);
      window.location.href = "/chat";
    } catch (err) {
      if (err instanceof GatewayUnreachable) {
        setError(
          "The Prometheon gateway is unreachable right now, so sign-in is unavailable. The app never fakes a session — please try again shortly.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      }
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{mode === "signup" ? "Create your account" : "Login"}</h1>
      {mode === "signup" && (
        <p>
          Signup grants free-trial access with a trial wallet credit — no
          payment is taken. Paid checkout is in test mode and activating
          soon.
        </p>
      )}
      <form className="auth" onSubmit={submit}>
        {mode === "signup" && (
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>
          {busy
            ? "Working…"
            : mode === "signup"
              ? "Sign up — start free trial"
              : "Log in"}
        </button>
      </form>
      <p style={{ textAlign: "center" }}>
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login">Login</Link>
          </>
        ) : (
          <>
            New to Prometheon SI? <Link href="/signup">Create an account</Link>{" "}
            — the free trial needs no payment.
          </>
        )}
      </p>
    </>
  );
}
