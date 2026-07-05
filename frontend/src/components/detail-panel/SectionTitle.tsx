import type { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
  withSpacing?: boolean;
}

export function SectionTitle({ children, withSpacing = false }: SectionTitleProps) {
  return (
    <div
      className={`text-[12px] font-semibold uppercase tracking-wide text-muted ${withSpacing ? 'mt-1' : ''}`}
    >
      {children}
    </div>
  );
}
