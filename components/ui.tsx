import type { ReactNode } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {hint ? <div className="hint">{hint}</div> : null}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  kind = "default",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "default" | "primary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} className={`btn ${kind}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
