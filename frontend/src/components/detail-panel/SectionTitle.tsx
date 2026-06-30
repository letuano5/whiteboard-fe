import type { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
  withSpacing?: boolean;
}

export function SectionTitle({ children, withSpacing = false }: SectionTitleProps) {
  return (
    <div
      style={{
        fontWeight: 600,
        fontSize: 12,
        color: '#aaa',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: withSpacing ? 4 : undefined,
      }}
    >
      {children}
    </div>
  );
}
