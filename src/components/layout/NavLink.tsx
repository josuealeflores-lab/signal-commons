"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLinkProps {
  href: string;
  children: string;
}

/**
 * The only reason this is a client component: a persistent root-layout
 * header has no other way to know the current route than usePathname().
 * It exists solely to set aria-current="page" on the matching nav link —
 * unrelated to filtering, which remains fully server-rendered (see
 * docs/DECISIONS.md D-027/D-028).
 */
export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "inline-block border-b-2 border-deep-teal px-1 py-2 text-sm font-semibold text-deep-teal"
          : "inline-block border-b-2 border-transparent px-1 py-2 text-sm font-medium text-ink hover:text-deep-teal"
      }
    >
      {children}
    </Link>
  );
}
