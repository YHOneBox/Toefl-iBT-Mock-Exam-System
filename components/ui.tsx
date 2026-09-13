"use client";

import type { ReactNode } from "react";

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="whitespace-nowrap rounded bg-[#1f4e79] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-[#9aa8b5] bg-white px-4 py-2 text-sm text-[#1b2430] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Band({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-[#5b6775]">—</span>;
  return <span className="font-semibold">{value.toFixed(1).replace(/\.0$/, "")}</span>;
}
