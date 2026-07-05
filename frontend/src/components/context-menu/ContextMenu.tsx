import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { bringToFront, sendToBack, bringForward, sendBackward } from '../../store/zorder';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { useDismissOnOutsideClick } from '../../hooks/use-dismiss-on-outside-click';
import {
  canMergeSelection,
  canUnmergeSelection,
  onMergeSelected,
  onUnmergeSelected,
} from '../../canvas/tools/select/merge';
import {
  canToggleLockSelection,
  isSelectionLocked,
  onToggleLockSelected,
} from '../../canvas/tools/select/lock';

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

interface MenuItemProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
}

function MenuItem({ label, disabled, onClick }: MenuItemProps) {
  return (
    <button
      style={disabled ? DISABLED_STYLE : BUTTON_STYLE}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      {label}
    </button>
  );
}

export default function ContextMenu({
  x,
  y,
  selectedId,
  selectedCount,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({
    left: x,
    top: y,
    visibility: 'hidden' as CSSProperties['visibility'],
  });
  const disabled = selectedCount !== 1 || !selectedId;
  const elements = useElementsStore((state) => state.elements);
  const selectedIds = useInteractionStore((state) => state.selectedIds);
  const mergeDisabled = !canMergeSelection(elements, selectedIds);
  const unmergeDisabled = !canUnmergeSelection(elements, selectedIds);
  const lockDisabled = !canToggleLockSelection(elements, selectedIds);
  const lockLabel = isSelectionLocked(elements, selectedIds) ? 'Unlock' : 'Lock';

  useDismissOnOutsideClick(ref, onClose);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(x, window.innerWidth - rect.width - margin);
    const top = Math.min(y, window.innerHeight - rect.height - margin);

    setPos({
      left: Math.max(margin, left),
      top: Math.max(margin, top),
      visibility: 'visible',
    });
  }, [x, y]);

  function handle(fn: (id: string) => void) {
    if (disabled || !selectedId) return;
    fn(selectedId);
    onClose();
  }

  function handleMerge() {
    if (mergeDisabled) return;
    onMergeSelected();
    onClose();
  }

  function handleUnmerge() {
    if (unmergeDisabled) return;
    onUnmergeSelected();
    onClose();
  }

  function handleToggleLock() {
    if (lockDisabled) return;
    onToggleLockSelected();
    onClose();
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        visibility: pos.visibility,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        padding: '4px 0',
        minWidth: '160px',
        zIndex: 9999,
      }}
    >
      <MenuItem label="Bring to Front" disabled={disabled} onClick={() => handle(bringToFront)} />
      <MenuItem label="Forward" disabled={disabled} onClick={() => handle(bringForward)} />
      <MenuItem label="Backward" disabled={disabled} onClick={() => handle(sendBackward)} />
      <MenuItem label="Send to Back" disabled={disabled} onClick={() => handle(sendToBack)} />
      <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
      <MenuItem label="Merge" disabled={mergeDisabled} onClick={handleMerge} />
      <MenuItem label="Unmerge" disabled={unmergeDisabled} onClick={handleUnmerge} />
      <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
      <MenuItem label={lockLabel} disabled={lockDisabled} onClick={handleToggleLock} />
    </div>
  );
}
