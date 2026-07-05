import type { ReactNode } from 'react';

interface PanelShellProps {
  children: ReactNode;
}

export function PanelShell({ children }: PanelShellProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        right: 16,
        top: 88,
        zIndex: 100,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: '12px 16px',
        minWidth: 220,
        maxWidth: 'min(320px, calc(100vw - 32px))',
        maxHeight: '60vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        color: '#111827',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
