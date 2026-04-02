import type { ReactNode } from "react";

import { classNames } from "@/lib/utils/classnames";

export const primaryButtonClass = "btn btn-primary";
export const secondaryButtonClass = "btn btn-secondary";
export const cardClass = "surface";

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={classNames("surface", className)}>{children}</section>;
}

export function StatPill({
  label,
  value,
  accent = "coral",
}: {
  label: string;
  value: string | number;
  accent?: "coral" | "amber" | "forest";
}) {
  return (
    <div className={`stat-pill stat-pill-${accent}`}>
      <p className="stat-pill-label">{label}</p>
      <p className="stat-pill-value">{value}</p>
    </div>
  );
}
