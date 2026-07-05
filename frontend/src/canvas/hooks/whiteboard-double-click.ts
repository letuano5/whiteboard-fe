import type React from 'react';
import type { Camera, Element } from '../../types/shared';
import type { ToolId } from '../../types/interaction';
import { useInteractionStore } from '../../store';
import { createBoundTextForContainer } from '../tools/select/bind-text-on-container';
import { CONTAINER_TYPES, resolveGroupBinding, resolveGroupMembers } from '../tools/select/group';
import { onCanvasDoubleClick } from '../tools/text-editor';
import { hitTestElementAtWorldPoint } from '../shapes/hit-test';
import { svgWorldPoint } from '../pointer-coordinates';

interface HandleWhiteboardDoubleClickParams {
  canEdit: boolean;
  camera: Camera;
  editingId: string | null;
  elements: Element[];
  event: React.MouseEvent<SVGSVGElement>;
  tool: ToolId;
}

export function handleWhiteboardDoubleClick({
  canEdit,
  camera,
  editingId,
  elements,
  event,
  tool,
}: HandleWhiteboardDoubleClickParams): void {
  if (!canEdit) return;
  if (tool !== 'select') return;
  if (editingId) return;

  const {
    draggingId,
    isRotating,
    resizeSession,
    groupResizeSession,
    setSelectedIds,
    setEditingId,
  } = useInteractionStore.getState();
  if (draggingId || isRotating || resizeSession || groupResizeSession) return;

  const worldPoint = svgWorldPoint(event, camera);
  const hit = elements
    .filter((element) => !element.isDeleted)
    .sort((a, b) => b.zIndex - a.zIndex)
    .find((element) => hitTestElementAtWorldPoint(element, worldPoint));

  if (hit && CONTAINER_TYPES.has(hit.type)) {
    const binding = hit.groupId ? resolveGroupBinding(hit.groupId, elements) : null;
    if (binding && binding.containerId === hit.id) {
      setSelectedIds([binding.textId]);
      setEditingId(binding.textId);
      return;
    }

    const isMergedWithOthers =
      !!hit.groupId && resolveGroupMembers(hit.groupId, elements).length > 1;
    if (isMergedWithOthers) {
      setSelectedIds([hit.id]);
      return;
    }

    const text = createBoundTextForContainer(hit);
    setSelectedIds([text.id]);
    setEditingId(text.id);
    return;
  }

  if (
    hit?.groupId &&
    hit.type !== 'text' &&
    resolveGroupMembers(hit.groupId, elements).length > 1
  ) {
    setSelectedIds([hit.id]);
    return;
  }

  onCanvasDoubleClick(worldPoint);
}
