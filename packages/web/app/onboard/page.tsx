"use client";

import { useEffect, useState } from "react";
import { makeBrowserClient } from "@/lib/supabase/client";

export default function OnboardPage() {
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Surface ?error=... from /onboard/verify when a magic link expires / fails.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const e = params.get("error");
    if (e) setError(decodeURIComponent(e));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      setError("Please accept the disclaimer before continuing.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = makeBrowserClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/onboard/verify`
        : "/onboard/verify";
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="eyebrow">Check your email</p>
          <h1 className="text-2xl font-normal tracking-tight1 text-zinc-900">
            Magic link sent
          </h1>
          <p className="text-[15px] text-zinc-500">
            We sent a magic link to{" "}
            <span className="font-medium text-zinc-900">{email}</span>. Click
            the link to continue setting up ato-mcp.
          </p>
          <p className="text-sm text-zinc-400">
            The link expires in 1 hour. Check your spam folder if it doesn&apos;t
            arrive.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-normal tracking-tight1 text-zinc-900">Get started</h1>
          <p className="text-[15px] text-zinc-500">
            Create a free account to save your tax context and generate an MCP
            config snippet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Disclaimer */}
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-[13px] font-medium text-zinc-900">Disclaimer</h2>
            <p className="text-[13px] leading-relaxed text-zinc-600">
              ato-mcp.com.au is an independent tool that retrieves publicly
              available ATO information. It is{" "}
              <span className="font-medium text-zinc-900">
                not affiliated with the Australian Taxation Office
              </span>
              . Information provided is for general guidance only and does not
              constitute tax advice. Always consult a registered tax agent for
              advice specific to your situation.
            </p>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900"
              />
              <span className="text-[13px] font-medium text-zinc-900">
                I understand and accept this disclaimer
              </span>
            </label>
          </div>

          {/* Email input */}
          <div className="space-y-2">
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </div>

          {error && (
            <p className="rounded-[10px] border border-[#dc2626]/30 px-3 py-2 text-[13px] text-[#dc2626]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400">
          Already have an account?{" "}
          <a
            href="/account"
            className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
          >
            Go to your account
          </a>
        </p>
      </div>
    </main>
  );
}
