import Link from "next/link";

export default function NotFound() {
  return (
    <main className="px-3 pb-4 pt-2 sm:px-4">
      <div className="mesh-night grain relative flex min-h-[70vh] items-center justify-center overflow-hidden rounded-[1.6rem] px-6 text-center">
        <div className="relative z-10">
          <p className="font-mono text-[0.78rem] text-ember">404 · not assessable</p>
          <h1 className="mt-4 text-[clamp(2rem,5vw,3.4rem)] font-medium tracking-snugger text-[#f4f2f7]">
            This page is <i className="font-serif italic text-brand-soft">not deductible</i>.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/65">
            Whatever you were looking for isn&apos;t in the corpus. Try the docs, or head home.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="btn btn-solid px-6 py-3 text-sm">Back home</Link>
            <Link href="/docs" className="btn btn-ghost-dark px-6 py-3 text-sm">Read the docs</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
