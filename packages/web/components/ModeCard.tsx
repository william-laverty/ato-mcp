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
      className={`relative flex flex-col rounded-xl border-2 p-6 transition-colors cursor-pointer hover:border-blue-400 ${
        recommended ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
      }`}
      onClick={handleSelect}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Recommended
          </span>
        </div>
      )}

      <div className="space-y-3 flex-1">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>

        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        disabled={loading}
        className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          recommended
            ? "bg-blue-600 text-white hover:bg-blue-500"
            : "bg-gray-900 text-white hover:bg-gray-700"
        }`}
      >
        {loading ? "Setting up…" : `Choose ${title}`}
      </button>
    </div>
  );
}
