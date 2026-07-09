import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";
import { NavLink } from "@/components/layout/NavLink";

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/" },
  { label: "Sectors", href: "/sectors" },
  { label: "Companies", href: "/companies" },
  { label: "Signals", href: "/signals" },
  { label: "Methodology", href: "/methodology" },
];

function NavList() {
  return (
    <ul className="flex flex-col gap-1 md:flex-row md:items-center md:gap-6">
      {NAV_ITEMS.map((item) => (
        <li key={item.href}>
          <NavLink href={item.href}>{item.label}</NavLink>
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
          <NavList />
        </nav>
        <MobileNavToggle>
          <nav aria-label="Primary (mobile)">
            <NavList />
          </nav>
        </MobileNavToggle>
      </div>
    </header>
  );
}
