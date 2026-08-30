"use client";

import type { ReactNode } from 'react';

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function PageShell({
  title,
  description,
  actions,
  children,
  className = '',
}: PageShellProps) {
  return (
    <main className="flex min-h-full w-full flex-col bg-transparent px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className={`w-full space-y-6 ${className}`.trim()}>
        <header className="occ-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h1 className="font-headline text-3xl font-semibold uppercase tracking-wide text-primary">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}