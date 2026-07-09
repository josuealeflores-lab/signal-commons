"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-gray">
        The dashboard couldn&apos;t load its demo data. This is usually a data-validation
        problem, not a sign of a real outage.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-deep-teal px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
      >
        Try again
      </button>
    </main>
  );
}
