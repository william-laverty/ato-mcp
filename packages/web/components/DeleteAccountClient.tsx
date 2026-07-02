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
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="card w-full max-w-md space-y-6 p-8">
        <div className="space-y-3 text-center">
          <p className="eyebrow">Delete account</p>
          <h1 className="text-2xl font-normal tracking-tight1 text-zinc-900">
            Delete your account?
          </h1>
          <p className="text-sm text-zinc-500">
            This will permanently delete your account, tax profile, and any
            issued API tokens. This action cannot be undone.
          </p>
        </div>

        {error && (
          <p className="rounded-[10px] border border-[#dc2626]/30 px-3 py-2 text-[13px] text-[#dc2626]">
            {error}
          </p>
        )}

        {!confirming ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setConfirming(true)}
              className="btn w-full rounded-full bg-[#dc2626] px-4 py-2.5 text-sm text-white hover:bg-[#b91c1c]"
            >
              Yes, delete my account
            </button>
            <button
              onClick={() => router.back()}
              className="btn btn-outline w-full px-4 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-zinc-900">
              Are you absolutely sure?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn w-full rounded-full bg-[#b91c1c] px-4 py-2.5 text-sm text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="btn btn-outline w-full px-4 py-2.5 text-sm"
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
