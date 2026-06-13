import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 text-center">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-brand-text">
          404 · not assessable
        </p>
        <h1 className="mt-4 text-[clamp(2rem,4.5vw,3rem)] font-normal tracking-tight2 text-zinc-900">
          This page is not deductible.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-zinc-500">
          Whatever you were looking for isn&apos;t in the corpus. Try the docs,
          or head home.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn btn-primary px-6 py-3 text-sm">
            Back home
          </Link>
          <Link href="/docs" className="btn btn-outline px-6 py-3 text-sm">
            Read the docs
          </Link>
        </div>
      </div>
    </main>
  );
}
