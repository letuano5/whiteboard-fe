import type { ReactNode } from 'react';

interface PanelShellProps {
  children: ReactNode;
}

export function PanelShell({ children }: PanelShellProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-[100] flex min-w-[220px] max-w-[min(320px,calc(100vw-32px))] flex-col gap-2.5 rounded-2xl border border-rule bg-paper/90 px-4 py-3 text-[13px] text-ink shadow-lg backdrop-blur-md"
      style={{
        top: 'calc(64px + env(safe-area-inset-top))',
        left: 'calc(12px + env(safe-area-inset-left))',
        maxHeight: 'calc(100vh - 88px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}
    >
      {children}
    </div>
  );
}
