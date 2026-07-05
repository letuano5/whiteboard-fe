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
    <div ref={ref} className="relative">
      <ToolButton
        title="More tools"
        active={open || isOverflowToolActive}
        onClick={() => setOpen((o) => !o)}
        Icon={MoreHorizontal}
      />
      {open && (
        <div
          className="toolbar-scroll fixed left-1/2 z-[1000] flex max-w-[calc(100vw-16px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-xl border border-rule bg-paper p-1.5 shadow-md"
          role="menu"
          aria-label="More tools"
          style={{
            bottom: 'calc(72px + env(safe-area-inset-bottom))',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
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
