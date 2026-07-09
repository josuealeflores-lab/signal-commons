/**
 * Original, hand-authored mark inspired by references/brand-guide.png's
 * radar/signal motif (concentric arcs fanning from a beacon point) — not a
 * raster crop of the brand guide image, per docs/DESIGN_SYSTEM.md's
 * explicit instruction. Simple enough to work at favicon size.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 24a11 11 0 0 1 16 0"
        fill="none"
        stroke="var(--color-deep-teal)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M11.5 24a7 7 0 0 1 9 0"
        fill="none"
        stroke="var(--color-soft-green)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="24" r="2.5" fill="var(--color-indigo-navy)" />
      <path d="M16 15 L20 24 L12 24 Z" fill="var(--color-warm-gold)" opacity="0.85" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight text-indigo-navy">
          Signal <span className="text-deep-teal">Commons</span>
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-gray">
          Emerging AI Impact Radar
        </span>
      </span>
    </span>
  );
}
