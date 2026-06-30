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
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 100,
        background: '#1e1e1e',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        color: '#e0e0e0',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
