import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";

const DISABLED_NAV_ITEMS = ["Sectors", "Companies", "Signals", "Methodology"];

function NavList({ idPrefix }: { idPrefix: string }) {
  return (
    <ul className="flex flex-col gap-1 md:flex-row md:items-center md:gap-6">
      <li>
        <Link
          href="/"
          aria-current="page"
          className="inline-block border-b-2 border-deep-teal px-1 py-2 text-sm font-semibold text-deep-teal"
        >
          Dashboard
        </Link>
      </li>
      {DISABLED_NAV_ITEMS.map((label) => (
        <li key={`${idPrefix}-${label}`}>
          <span
            aria-disabled="true"
            className="inline-block px-1 py-2 text-sm font-medium text-slate-gray"
            title="Not yet available — coming in a future milestone"
          >
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <NavList idPrefix="desktop" />
        </nav>
        <MobileNavToggle>
          <nav aria-label="Primary (mobile)">
            <NavList idPrefix="mobile" />
          </nav>
        </MobileNavToggle>
      </div>
    </header>
  );
}
