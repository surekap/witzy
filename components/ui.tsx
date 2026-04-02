import type { ReactNode } from "react";

import { classNames } from "@/lib/utils/classnames";

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_28px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60";

export const cardClass =
  "rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.32)] backdrop-blur";

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={classNames(cardClass, className)}>{children}</section>;
}

export function StatPill({
  label,
  value,
  accent = "orange",
}: {
  label: string;
  value: string | number;
  accent?: "orange" | "cyan" | "lime";
}) {
  const accentClass =
    accent === "cyan"
      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
      : accent === "lime"
        ? "border-lime-300/30 bg-lime-300/10 text-lime-100"
        : "border-orange-300/30 bg-orange-300/10 text-orange-100";

  return (
    <div className={classNames("rounded-full border px-4 py-2", accentClass)}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
