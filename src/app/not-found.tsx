import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-md text-sm text-slate-gray">
        We couldn&apos;t find that page. It may not exist in this demo dataset, or the link
        may be out of date.
      </p>
      <Link
        href="/"
        className="rounded-md bg-deep-teal px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
