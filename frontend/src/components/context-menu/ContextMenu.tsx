import { useEffect, useRef } from 'react';
import { bringToFront, sendToBack, bringForward, sendBackward } from '../../store/zorder';

interface ContextMenuProps {
  x: number;
  y: number;
  selectedId: string | null;
  selectedCount: number;
  onClose: () => void;
}

const BUTTON_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '6px 12px',
  background: 'none',
  border: 'none',
  fontSize: '13px',
  cursor: 'pointer',
  borderRadius: '4px',
  color: '#1a1a1a',
};

const DISABLED_STYLE: React.CSSProperties = {
  ...BUTTON_STYLE,
  color: '#aaa',
  cursor: 'not-allowed',
};

export default function ContextMenu({ x, y, selectedId, selectedCount, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const disabled = selectedCount !== 1 || !selectedId;

  // Dismiss on click-outside or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  function handle(fn: (id: string) => void) {
    if (disabled || !selectedId) return;
    fn(selectedId);
    onClose();
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        padding: '4px 0',
        minWidth: '160px',
        zIndex: 9999,
      }}
    >
      <button
        style={disabled ? DISABLED_STYLE : BUTTON_STYLE}
        disabled={disabled}
        onClick={() => handle(bringToFront)}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
      >
        Bring to Front
      </button>
      <button
        style={disabled ? DISABLED_STYLE : BUTTON_STYLE}
        disabled={disabled}
        onClick={() => handle(bringForward)}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
      >
        Forward
      </button>
      <button
        style={disabled ? DISABLED_STYLE : BUTTON_STYLE}
        disabled={disabled}
        onClick={() => handle(sendBackward)}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
      >
        Backward
      </button>
      <button
        style={disabled ? DISABLED_STYLE : BUTTON_STYLE}
        disabled={disabled}
        onClick={() => handle(sendToBack)}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
      >
        Send to Back
      </button>
    </div>
  );
}
