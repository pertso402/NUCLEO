import type { ReactNode } from "react";

export function PageHeader({ title, kicker }: { title: string; kicker?: ReactNode }) {
  return (
    <header className="mb-6">
      {kicker && <p className="label-instrument mb-1">{kicker}</p>}
      <h1 className="font-display text-xl font-semibold text-text-0">{title}</h1>
    </header>
  );
}
