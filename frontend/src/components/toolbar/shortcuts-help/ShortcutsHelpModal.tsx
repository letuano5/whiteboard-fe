import { useEffect } from 'react';
import { SHORTCUT_GROUPS } from './shortcut-list';

interface ShortcutsHelpModalProps {
  onClose: () => void;
}

export default function ShortcutsHelpModal({ onClose }: ShortcutsHelpModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 10,
          padding: '20px 24px',
          maxWidth: 420,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
          Keyboard shortcuts
        </h2>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} style={{ marginBottom: 12 }}>
            <h3
              style={{
                margin: '0 0 4px',
                fontSize: 12,
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {group.title}
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {group.items.map((item) => (
                <li
                  key={item.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '4px 0',
                    fontSize: 13,
                    color: '#374151',
                  }}
                >
                  <span>{item.label}</span>
                  <kbd
                    style={{
                      fontFamily: 'inherit',
                      fontSize: 12,
                      color: '#111827',
                      background: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      padding: '2px 6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
