import type { Element } from '../../types/shared';
import { WS_EVENTS } from '../../types/shared';
import { useCameraStore } from '../../store/camera.store';
import { useInteractionStore } from '../../store/interaction.store';
import { registerMutationHook } from '../../store/mutation-pipeline';
import { isApplyingRemote } from '../apply-remote';
import { LOCAL_PRESENCE } from '../presence';
import { queuePendingElements } from './pending-queue';
import { getSocketState } from './state';

export function registerSocketSubscriptions(roomId: string): void {
  const state = getSocketState();

  state.unregisterHook = registerMutationHook((event) => {
    const current = getSocketState();
    if (isApplyingRemote()) return;
    if (!current.socket) return;
    if (current.socket.connected) {
      current.socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: event.elements });
    } else {
      queuePendingElements(event.elements);
    }
  });

  state.unsubCamera = useCameraStore.subscribe((cameraState, prevState) => {
    const current = getSocketState();
    if (cameraState.camera === prevState.camera) return;
    if (current.viewportThrottle !== null) return;
    current.viewportThrottle = setTimeout(() => {
      const latest = getSocketState();
      latest.viewportThrottle = null;
      if (!latest.socket || !latest.roomId) return;
      latest.socket.emit(WS_EVENTS.CURSOR_MOVE, {
        roomId: latest.roomId,
        sessionId: LOCAL_PRESENCE.sessionId,
        cursor: null,
        viewport: useCameraStore.getState().camera,
      });
    }, 200);
  });

  state.unsubSelection = useInteractionStore.subscribe((interactionState, prevState) => {
    const current = getSocketState();
    if (interactionState.selectedIds === prevState.selectedIds) return;
    if (current.selectionThrottle !== null) return;
    current.selectionThrottle = setTimeout(() => {
      const latest = getSocketState();
      latest.selectionThrottle = null;
      if (!latest.socket || !latest.roomId) return;
      latest.socket.emit(WS_EVENTS.CURSOR_MOVE, {
        roomId: latest.roomId,
        sessionId: LOCAL_PRESENCE.sessionId,
        cursor: null,
        viewport: useCameraStore.getState().camera,
        selectedIds: useInteractionStore.getState().selectedIds,
      });
    }, 50);
  });

  state.unsubDraft = useInteractionStore.subscribe((interactionState, prevState) => {
    const current = getSocketState();
    if (
      interactionState.draftElement === prevState.draftElement &&
      interactionState.draftElements === prevState.draftElements
    ) {
      return;
    }
    if (current.draftThrottle !== null) return;
    current.draftThrottle = setTimeout(() => {
      const latest = getSocketState();
      latest.draftThrottle = null;
      if (!latest.socket || !latest.roomId) return;
      const { draftElement, draftElements } = useInteractionStore.getState();
      const combined: Element[] = [];
      if (draftElement) combined.push(draftElement);

      const combinedIds = new Set(combined.map((e) => e.id));
      for (const el of draftElements) {
        if (!combinedIds.has(el.id)) combined.push(el);
      }

      latest.socket.emit(WS_EVENTS.ELEMENT_DRAFT, {
        roomId: latest.roomId,
        sessionId: LOCAL_PRESENCE.sessionId,
        elements: combined,
      });
    }, 50);
  });
}

export function clearSocketSubscriptions(): void {
  const state = getSocketState();
  state.unregisterHook?.();
  state.unregisterHook = null;
  state.unsubCamera?.();
  state.unsubCamera = null;
  state.unsubSelection?.();
  state.unsubSelection = null;
  state.unsubDraft?.();
  state.unsubDraft = null;

  if (state.viewportThrottle !== null) {
    clearTimeout(state.viewportThrottle);
    state.viewportThrottle = null;
  }
  if (state.selectionThrottle !== null) {
    clearTimeout(state.selectionThrottle);
    state.selectionThrottle = null;
  }
  if (state.draftThrottle !== null) {
    clearTimeout(state.draftThrottle);
    state.draftThrottle = null;
  }
}
