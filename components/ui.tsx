import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
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
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-head row between">
        <div>
          <h3>{title}</h3>
          {hint ? <div className="hint">{hint}</div> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  kind = "default",
  size,
  disabled,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "default" | "primary" | "ghost" | "danger";
  size?: "sm";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const className = ["btn", kind === "default" ? "" : kind, size ?? ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={className} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Method({ verb }: { verb: "GET" | "POST" | "PUT" | "DELETE" }) {
  return <span className={`method ${verb.toLowerCase()}`}>{verb}</span>;
}

const paths = {
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.6-.7L3 21l1.9-4.6A8.3 8.3 0 0 1 3 11.5C3 6.8 7 3 12 3s9 3.8 9 8.5Z",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8Zm-9 5L3 8m9 5 9-5m-9 5v8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 6 6 6-6 6",
  copy: "M8 8h12v12H8zM4 16V4h12",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
};

export function Icon({ name, className }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
