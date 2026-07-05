import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import { createElements, type ElementDraft } from '../../../store/mutation-pipeline';
import type { Element } from '../../../types/shared';
import { generateId } from '../../../utils/id';
import { onDeleteSelected } from './delete';

function buildGroupIdRemap(elements: Element[]): Map<string, string> {
  const remap = new Map<string, string>();
  for (const el of elements) {
    if (el.groupId && !remap.has(el.groupId)) remap.set(el.groupId, generateId());
  }
  return remap;
}

function cloneAsNewDraft(
  el: Element,
  offsetX: number,
  offsetY: number,
  groupId: string | null,
): ElementDraft {
  return {
    type: el.type,
    x: el.x + offsetX,
    y: el.y + offsetY,
    width: el.width,
    height: el.height,
    angle: el.angle,
    props: el.props.points
      ? { ...el.props, points: el.props.points.map(([px, py]) => [px + offsetX, py + offsetY]) }
      : { ...el.props },
    groupId,
    frameId: el.frameId,
    locked: el.locked,
    createdBy: el.createdBy,
  };
}

// @covers AC-11, AC-12, AC-13
export function onDuplicateSelected(): void {
  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const elements = useElementsStore.getState().elements;
  const originals = elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
  if (originals.length === 0) return;

  const groupIdRemap = buildGroupIdRemap(originals);
  const drafts = originals.map((el) =>
    cloneAsNewDraft(el, 10, 10, el.groupId ? (groupIdRemap.get(el.groupId) ?? null) : null),
  );
  const created = createElements(drafts);
  setSelectedIds(created.map((el) => el.id));
}

// @covers AC-14
export function onCopySelected(): void {
  const { selectedIds, setClipboard, setPasteOffset } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const elements = useElementsStore.getState().elements;
  const originals = elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
  if (originals.length === 0) return;

  setClipboard(originals.map((el) => ({ ...el, props: { ...el.props } })));
  setPasteOffset(0);
}

export function onCutSelected(): void {
  const { selectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  onCopySelected();
  onDeleteSelected();
}

// @covers AC-15, AC-16, AC-17
export function onPasteSelected(): void {
  const { clipboard, pasteOffset, setSelectedIds, setClipboard, setPasteOffset } =
    useInteractionStore.getState();
  if (!clipboard || clipboard.length === 0) return;

  const nextOffset = pasteOffset + 1;
  const delta = nextOffset * 10;
  const groupIdRemap = buildGroupIdRemap(clipboard);
  const drafts = clipboard.map((el) =>
    cloneAsNewDraft(el, delta, delta, el.groupId ? (groupIdRemap.get(el.groupId) ?? null) : null),
  );
  const created = createElements(drafts);
  setSelectedIds(created.map((el) => el.id));
  setClipboard(clipboard);
  setPasteOffset(nextOffset);
}
