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

interface MenuItemProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
}

function MenuItem({ label, disabled, onClick }: MenuItemProps) {
  return (
    <button
      className={`block w-full rounded px-3 py-1.5 text-left text-[13px] ${
        disabled ? 'cursor-not-allowed text-muted' : 'cursor-pointer text-ink hover:bg-panel'
      }`}
      disabled={disabled}
      onClick={onClick}
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
      className="fixed z-[9999] min-w-[160px] rounded-md border border-rule bg-paper py-1 shadow-lg"
      style={{ left: pos.left, top: pos.top, visibility: pos.visibility }}
    >
      <MenuItem label="Bring to Front" disabled={disabled} onClick={() => handle(bringToFront)} />
      <MenuItem label="Forward" disabled={disabled} onClick={() => handle(bringForward)} />
      <MenuItem label="Backward" disabled={disabled} onClick={() => handle(sendBackward)} />
      <MenuItem label="Send to Back" disabled={disabled} onClick={() => handle(sendToBack)} />
      <div className="my-1 border-t border-rule" />
      <MenuItem label="Merge" disabled={mergeDisabled} onClick={handleMerge} />
      <MenuItem label="Unmerge" disabled={unmergeDisabled} onClick={handleUnmerge} />
      <div className="my-1 border-t border-rule" />
      <MenuItem label={lockLabel} disabled={lockDisabled} onClick={handleToggleLock} />
    </div>
  );
}
