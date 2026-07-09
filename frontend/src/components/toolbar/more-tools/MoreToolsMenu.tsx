import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import type { ToolId } from '../../../types/interaction';
import { OVERFLOW_TOOLS } from '../tool-list';
import ToolButton from '../ToolButton';
import { useDismissOnOutsideClick } from '../../../hooks/use-dismiss-on-outside-click';

interface MoreToolsMenuProps {
  tool: ToolId;
  open?: boolean;
  showToolActive?: boolean;
  chooseTool: (id: ToolId) => void;
  resetInteraction?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export default function MoreToolsMenu({
  tool,
  open,
  showToolActive,
  chooseTool,
  resetInteraction,
  onOpenChange,
}: MoreToolsMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOverflowToolActive = OVERFLOW_TOOLS.some((t) => t.id === tool);
  const isOpen = open ?? uncontrolledOpen;
  const shouldShowToolActive = showToolActive ?? true;

  function setOpen(nextOpen: boolean) {
    if (onOpenChange) {
      onOpenChange(nextOpen);
      return;
    }

    setUncontrolledOpen(nextOpen);
  }

  useDismissOnOutsideClick([ref, menuRef], () => {
    if (isOpen) setOpen(false);
  });

  function handleSelect(id: ToolId) {
    chooseTool(id);
    setOpen(false);
  }

  function handleToggle() {
    resetInteraction?.();
    setOpen(!isOpen);
  }

  return (
    <div ref={ref} className="relative">
      <ToolButton
        title="More tools"
        active={isOpen || (shouldShowToolActive && isOverflowToolActive)}
        onClick={handleToggle}
        Icon={MoreHorizontal}
      />
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
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
          </div>,
          document.body,
        )}
    </div>
  );
}
