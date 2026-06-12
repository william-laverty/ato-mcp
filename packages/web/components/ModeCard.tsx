"use client";

import { useState } from "react";
import { setMode } from "@/app/onboard/_actions";

interface ModeCardProps {
  userId: string;
  mode: "hosted" | "local";
  title: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

export default function ModeCard({
  userId,
  mode,
  title,
  description,
  features,
  recommended = false,
}: ModeCardProps) {
  const [loading, setLoading] = useState(false);

  const handleSelect = async () => {
    setLoading(true);
    await setMode(userId, mode);
    // setMode redirects, so we don't need to do anything here
  };

  return (
    <div
      className={`relative flex cursor-pointer flex-col rounded-xl border bg-white p-6 transition-colors ${
        recommended
          ? "border-zinc-900"
          : "border-zinc-200 hover:border-zinc-400"
      }`}
      onClick={handleSelect}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-zinc-900 px-3 py-1 font-mono text-[0.625rem] uppercase tracking-[0.05em] text-white">
            Recommended
          </span>
        </div>
      )}

      <div className="flex-1 space-y-3">
        <h3 className="text-lg font-medium tracking-tight1 text-zinc-900">{title}</h3>
        <p className="text-sm text-zinc-500">{description}</p>

        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-zinc-700">
              <span className="mt-0.5 text-zinc-400">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        disabled={loading}
        className="btn btn-primary mt-6 w-full px-4 py-2.5 text-sm disabled:opacity-50"
      >
        {loading ? "Setting up…" : `Choose ${title}`}
      </button>
    </div>
  );
}
