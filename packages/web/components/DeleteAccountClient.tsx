"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/app/onboard/_actions";

interface DeleteAccountClientProps {
  userId: string;
}

export default function DeleteAccountClient({ userId }: DeleteAccountClientProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(userId);
      // deleteAccount redirects to /
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900">Delete your account?</h1>
          <p className="text-sm text-gray-600">
            This will permanently delete your account, tax profile, and any
            issued API tokens. This action cannot be undone.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!confirming ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setConfirming(true)}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
            >
              Yes, delete my account
            </button>
            <button
              onClick={() => router.back()}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900 text-center">
              Are you absolutely sure?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
