"use client";

import { useState } from "react";
import { makeBrowserClient } from "@/lib/supabase/client";

export default function OnboardPage() {
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="text-gray-600">
            We sent a magic link to <strong>{email}</strong>. Click the link to
            continue setting up ato-mcp.
          </p>
          <p className="text-sm text-gray-400">
            The link expires in 1 hour. Check your spam folder if it doesn&apos;t
            arrive.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Get started</h1>
          <p className="text-gray-600">
            Create a free account to save your tax context and generate an MCP
            config snippet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-amber-900 text-sm">Disclaimer</h2>
            <p className="text-sm text-amber-800">
              ato-mcp.com is an independent tool that retrieves publicly
              available ATO information. It is{" "}
              <strong>not affiliated with the Australian Taxation Office</strong>
              . Information provided is for general guidance only and does not
              constitute tax advice. Always consult a registered tax agent for
              advice specific to your situation.
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-amber-900 font-medium">
                I understand and accept this disclaimer
              </span>
            </label>
          </div>

          {/* Email input */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Already have an account?{" "}
          <a href="/account" className="text-blue-600 hover:underline">
            Go to your account
          </a>
        </p>
      </div>
    </main>
  );
}
