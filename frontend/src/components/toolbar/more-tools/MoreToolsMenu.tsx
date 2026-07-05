import { useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ToolId } from '../../../types/interaction';
import { OVERFLOW_TOOLS } from '../tool-list';
import ToolButton from '../ToolButton';
import { useDismissOnOutsideClick } from '../../../hooks/use-dismiss-on-outside-click';

interface MoreToolsMenuProps {
  tool: ToolId;
  chooseTool: (id: ToolId) => void;
}

export default function MoreToolsMenu({ tool, chooseTool }: MoreToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isOverflowToolActive = OVERFLOW_TOOLS.some((t) => t.id === tool);

  useDismissOnOutsideClick(ref, () => setOpen(false));

  function handleSelect(id: ToolId) {
    chooseTool(id);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <ToolButton
        title="More tools"
        active={open || isOverflowToolActive}
        onClick={() => setOpen((o) => !o)}
        Icon={MoreHorizontal}
      />
      {open && (
        <div
          className="toolbar-scroll"
          role="menu"
          aria-label="More tools"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(72px + env(safe-area-inset-bottom))',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            gap: 4,
            padding: '6px',
            maxWidth: 'calc(100vw - 16px)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            border: '1px solid #e5e7eb',
          }}
        >
          {OVERFLOW_TOOLS.map(({ id, label, Icon }) => (
            <ToolButton
              key={id}
              title={label}
              active={tool === id}
              onClick={() => handleSelect(id)}
              Icon={Icon}
            />
          ))}
        </div>
      )}
    </div>
  );
}
