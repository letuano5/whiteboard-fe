import type { ReactNode } from 'react';

interface PanelShellProps {
  children: ReactNode;
}

export function PanelShell({ children }: PanelShellProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed right-4 top-[88px] z-[100] flex min-w-[220px] max-w-[min(320px,calc(100vw-32px))] flex-col gap-2.5 rounded-2xl border border-rule bg-paper/90 px-4 py-3 text-[13px] text-ink shadow-lg backdrop-blur-md"
      style={{ maxHeight: '60vh', overflowY: 'auto' }}
    >
      {children}
    </div>
  );
}
