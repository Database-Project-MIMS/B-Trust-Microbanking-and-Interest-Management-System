"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MotionSurface } from "@/components/motion-surface";

interface ApiError {
  error?: { message?: string };
}

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiError;
        setError(body.error?.message ?? "We could not sign you in. Please try again.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next && /^\/(?!\/)/.test(next) && !next.includes("\\") ? next : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MotionSurface className="login-stage">
      <aside className="brand-panel">
        <div className="brand-lockup" data-reveal><span className="brand-symbol">b.</span><span>B-Trust<span className="brand-caption">MICROFINANCE BANK</span></span></div>
        <div className="brand-story" data-reveal><span className="light-eyebrow">A stronger financial future</span><h2>Built on trust.<br />Designed for <em>growth.</em></h2><p>Your people, your branches, your operations.<br />One connected workspace.</p></div>
        <div className="orbit-art" aria-hidden="true"><div className="orbital-ring ring-one"/><div className="orbital-ring ring-two"/><div className="orbit-core">b<span>.</span></div><div className="orbit-label">CONNECTED BY TRUST</div></div>
        <div className="brand-bottom" data-reveal><span>Made for the way you bank.</span><span>EST. IN SRI LANKA ↗</span></div>
      </aside>
      <main className="login-content">
      <div className="login-top"><span>B-TRUST WORKSPACE</span><span className="secure-tag">◈ Secure access</span></div>
      <section className="login-form" aria-labelledby="sign-in-title" data-reveal>
        <span className="welcome-icon" aria-hidden="true">↗</span>
        <p className="eyebrow">Welcome to your workspace</p>
        <h1 id="sign-in-title">Good to see you.</h1>
        <p className="login-intro">Sign in to manage your day with confidence.</p>
        <form className="mt-8 space-y-5" onSubmit={submit} method="post">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--text-muted)]" htmlFor="username">Username <span aria-hidden="true">*</span><span className="sr-only"> (required)</span></label>
            <input autoComplete="username" className="input" id="username" name="username" placeholder="Enter your username" required disabled={isSubmitting} />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--text-muted)]" htmlFor="password">Password <span aria-hidden="true">*</span><span className="sr-only"> (required)</span></label>
            <div className="password-field"><input autoComplete="current-password" className="input" id="password" name="password" placeholder="Enter your password" required disabled={isSubmitting} type={showPassword ? "text" : "password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div>
          </div>
          {error ? <p aria-live="polite" className="rounded-md border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">{error}</p> : null}
          <button className="btn btn-primary login-submit w-full" disabled={isSubmitting} type="submit">{isSubmitting ? "Signing in…" : "Sign in to workspace"}<span aria-hidden="true">→</span></button>
        </form>
        <p className="login-help">Need access? Contact your system administrator.</p>
      </section>
      <footer className="login-footer"><span>© {new Date().getFullYear()} B-Trust MIMS</span><span>Microbanking, simplified.</span></footer>
      </main>
    </MotionSurface>
  );
}
