import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  "aria-labelledby"?: string;
}

export function Card({ children, className = "", as: As = "div", ...rest }: CardProps) {
  return (
    <As
      className={`rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}
