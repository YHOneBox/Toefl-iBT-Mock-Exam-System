"use client";

import type { ReactNode } from "react";

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  tone = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  tone?: "primary" | "accent";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ui-btn ${tone === "accent" ? "ui-accent" : "ui-primary"}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="ui-btn ui-ghost">
      {children}
    </button>
  );
}

export function Band({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-[#5b6775]">—</span>;
  return <span className="font-semibold">{value.toFixed(1).replace(/\.0$/, "")}</span>;
}
