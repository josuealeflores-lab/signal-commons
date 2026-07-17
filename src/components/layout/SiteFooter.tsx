import Link from "next/link";
import { CORRECTIONS_EMAIL } from "@/lib/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-gray sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Signal Commons is a public-interest intelligence platform. Independent.
          Transparent. Built for the public good.
        </p>
        <div className="flex flex-col gap-1 sm:items-end">
          <p className="font-medium text-ink">signal-commons.org</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-3 text-xs">
            <Link href="/about" className="underline underline-offset-2 hover:text-deep-teal">
              About
            </Link>
            <a
              href={`mailto:${CORRECTIONS_EMAIL}`}
              className="underline underline-offset-2 hover:text-deep-teal"
            >
              Report an issue
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
