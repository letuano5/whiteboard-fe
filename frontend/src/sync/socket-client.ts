import { io, type Socket } from 'socket.io-client';
import { WS_EVENTS } from '../types/shared';
import type { Element, Presence } from '../types/shared';
import { registerMutationHook } from '../store/mutation-pipeline';
import { applyRemoteElements, isApplyingRemote } from './apply-remote';
import { useElementsStore } from '../store/elements.store';
import { useInteractionStore } from '../store/interaction.store';
import { useCameraStore } from '../store/camera.store';
import { saveCamera } from './camera-persistence';
import { LOCAL_PRESENCE } from './presence';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? 'http://localhost:3001';

let _socket: Socket | null = null;
let _lastServerClock = 0;
let _unregisterHook: (() => void) | null = null;
let _unsubCamera: (() => void) | null = null;
let _unsubSelection: (() => void) | null = null;
let _unsubDraft: (() => void) | null = null;
let _viewportThrottle: ReturnType<typeof setTimeout> | null = null;
let _selectionThrottle: ReturnType<typeof setTimeout> | null = null;
let _draftThrottle: ReturnType<typeof setTimeout> | null = null;
let _roomId: string | null = null;

// P3A-03: Reconnect-diff state (T005, T009)
// _hasJoined: true after the first JOIN_ROOM emit so we know subsequent connect events are reconnects.
// _reconnectPending: true while a reconnect JOIN_ROOM has been sent but ROOM_DIFF/ROOM_SNAPSHOT not yet received.
// _pendingQueue: element mutations accumulated while the socket is disconnected.
let _hasJoined = false;
let _reconnectPending = false;
let _pendingQueue: Element[] = [];

/**
 * Returns the most recently received documentClock from the server.
 * Updated on ROOM_SNAPSHOT. Used by P3A-03 reconnect diff protocol.
 */
export function getLastServerClock(): number {
  return _lastServerClock;
}

export function initSocketClient(roomId: string): void {
  if (_socket) return;
  _roomId = roomId;

  _socket = io(SERVER_URL);

  // P3A-03 T005: Use 'connect' event for both initial join and every reconnect.
  // _hasJoined tracks whether we have ever sent JOIN_ROOM so we can distinguish reconnects.
  _socket.on('connect', () => {
    if (!_socket || !_roomId) return;

    if (_hasJoined) {
      // Reconnect path: send lastServerClock so server can return a diff (FR-001, AC-1)
      _reconnectPending = true;
    }

    _socket.emit(WS_EVENTS.JOIN_ROOM, {
      roomId: _roomId,
      sessionId: LOCAL_PRESENCE.sessionId,
      name: LOCAL_PRESENCE.name,
      color: LOCAL_PRESENCE.color,
      lastServerClock: _hasJoined ? _lastServerClock : 0, // AC-4: initial join sends 0
    });

    _hasJoined = true;
  });

  // P3A-03 T012: Full room snapshot — handles both initial join and wipe-all reconnect fallback.
  // On wipe-all reconnect: discard pending queue (FR-008 only requires replay for ROOM_DIFF).
  _socket.on(WS_EVENTS.ROOM_SNAPSHOT, (data: { elements: Element[]; documentClock: number }) => {
    _lastServerClock = data.documentClock;
    applyRemoteElements(data.elements);
    if (_reconnectPending) {
      // AC-9: Wipe-all path — server sent full snapshot; discard pending queue
      _pendingQueue = [];
      _reconnectPending = false;
    }
  });

  // P3A-03 T006: Handle incremental diff on reconnect (FR-006, FR-007, FR-008, AC-2, AC-3, AC-11, AC-12)
  _socket.on(
    WS_EVENTS.ROOM_DIFF,
    (data: { changed: Element[]; deleted: Array<{ id: string }>; documentClock: number }) => {
      // AC-11: update lastServerClock to diff documentClock
      _lastServerClock = data.documentClock;
      // AC-3: apply changed elements (upsert via LWW)
      applyRemoteElements(data.changed);
      // AC-2: remove deleted elements from canvas
      useElementsStore.getState().removeElements(data.deleted.map((d) => d.id));
      _reconnectPending = false;
      // T011 AC-5: replay pending queue after diff applied (FR-008)
      if (_pendingQueue.length > 0 && _socket && _roomId) {
        _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId: _roomId, elements: _pendingQueue });
        _pendingQueue = [];
      }
    },
  );

  _socket.on(WS_EVENTS.ELEMENT_UPDATE, (data: { elements: Element[]; sessionId?: string }) => {
    applyRemoteElements(data.elements);
    // Clear the peer's remote draft now that they have committed
    if (data.sessionId) {
      const { setRemoteDrafts } = useInteractionStore.getState();
      const current = new Map(useInteractionStore.getState().remoteDrafts);
      current.delete(data.sessionId);
      setRemoteDrafts(current);
    }
  });

  // Server sends full presence list whenever anyone joins
  _socket.on(WS_EVENTS.USER_JOIN, (data: { presences: Presence[] }) => {
    const { setRemoteCursors } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteCursors);
    for (const p of data.presences) {
      if (p.sessionId === LOCAL_PRESENCE.sessionId) continue; // skip self
      current.set(p.sessionId, p);
    }
    setRemoteCursors(current);
  });

  // Server notifies when a peer leaves
  _socket.on(WS_EVENTS.USER_LEAVE, (data: { sessionId: string }) => {
    const { setRemoteCursors, setRemoteDrafts } = useInteractionStore.getState();
    const current = new Map(useInteractionStore.getState().remoteCursors);
    current.delete(data.sessionId);
    setRemoteCursors(current);
    // Also clear any in-flight draft from the departing peer
    const drafts = new Map(useInteractionStore.getState().remoteDrafts);
    drafts.delete(data.sessionId);
    setRemoteDrafts(drafts);
  });

  // Server relays cursor + viewport from a peer.
  // cursor may be null for viewport-only updates (camera pan/zoom without mouse move).
  // If sessionId === own session (same user, another tab) → sync camera instead of showing remote cursor.
  _socket.on(
    WS_EVENTS.CURSOR_MOVE,
    (data: {
      sessionId: string;
      cursor: { x: number; y: number } | null;
      viewport?: { x: number; y: number; zoom: number };
      selectedIds?: string[];
    }) => {
      if (data.sessionId === LOCAL_PRESENCE.sessionId) {
        // Same user, different tab — apply their camera to ours and persist it
        if (data.viewport && _roomId) {
          useCameraStore.getState().setCamera(data.viewport);
          saveCamera(_roomId, data.viewport);
        }
        return;
      }

      const { setRemoteCursors } = useInteractionStore.getState();
      const current = new Map(useInteractionStore.getState().remoteCursors);
      const existing = current.get(data.sessionId);
      if (existing) {
        current.set(data.sessionId, {
          ...existing,
          // null cursor = viewport-only update; preserve the last known cursor position
          ...(data.cursor !== null ? { cursor: data.cursor } : {}),
          ...(data.viewport !== undefined ? { viewport: data.viewport } : {}),
          // Merge selectedIds when present in the incoming payload
          ...(data.selectedIds !== undefined ? { selectedIds: data.selectedIds } : {}),
        });
        setRemoteCursors(current);
      }
    },
  );

  // Receive element-draft from a peer — store into remoteDrafts (transient only)
  _socket.on(
    WS_EVENTS.ELEMENT_DRAFT,
    (data: { sessionId: string; elements: Element[] }) => {
      const { setRemoteDrafts } = useInteractionStore.getState();
      const current = new Map(useInteractionStore.getState().remoteDrafts);
      if (data.elements.length === 0) {
        current.delete(data.sessionId);
      } else {
        current.set(data.sessionId, data.elements);
      }
      setRemoteDrafts(current);
    },
  );

  _unregisterHook = registerMutationHook((event) => {
    if (isApplyingRemote()) return;
    if (!_socket) return;
    // P3A-03 T010: Guard emit — queue when disconnected to avoid Socket.IO internal buffering (AC-5, AC-6)
    if (_socket.connected) {
      _socket.emit(WS_EVENTS.ELEMENT_UPDATE, { roomId, elements: event.elements });
    } else {
      // AC-5: buffer mutations made while offline; replayed after ROOM_DIFF
      _pendingQueue = [..._pendingQueue, ...event.elements];
    }
  });

  // Broadcast viewport to peers when camera changes without cursor movement (throttled ~200ms)
  _unsubCamera = useCameraStore.subscribe((state, prevState) => {
    if (state.camera === prevState.camera) return;
    if (_viewportThrottle !== null) return;
    _viewportThrottle = setTimeout(() => {
      _viewportThrottle = null;
      if (!_socket || !_roomId) return;
      _socket.emit(WS_EVENTS.CURSOR_MOVE, {
        roomId: _roomId,
        sessionId: LOCAL_PRESENCE.sessionId,
        cursor: null, // viewport-only: receiver preserves existing cursor position
        viewport: useCameraStore.getState().camera,
      });
    }, 200);
  });

  // Broadcast selectedIds to peers when local selection changes (throttled ≤ 50 ms)
  // Merges into the cursor-move event; no second socket.emit call for cursor-move.
  _unsubSelection = useInteractionStore.subscribe((state, prevState) => {
    if (state.selectedIds === prevState.selectedIds) return;
    if (_selectionThrottle !== null) return;
    _selectionThrottle = setTimeout(() => {
      _selectionThrottle = null;
      if (!_socket || !_roomId) return;
      _socket.emit(WS_EVENTS.CURSOR_MOVE, {
        roomId: _roomId,
        sessionId: LOCAL_PRESENCE.sessionId,
        cursor: null, // selection-only: receiver preserves existing cursor position
        viewport: useCameraStore.getState().camera,
        selectedIds: useInteractionStore.getState().selectedIds,
      });
    }, 50);
  });

  // Broadcast in-progress draft state to peers (throttled ≤ 50 ms)
  // Combines draftElement (single drag/resize/create) and draftElements (multi-drag).
  _unsubDraft = useInteractionStore.subscribe((state, prevState) => {
    if (
      state.draftElement === prevState.draftElement &&
      state.draftElements === prevState.draftElements
    )
      return;
    if (_draftThrottle !== null) return;
    _draftThrottle = setTimeout(() => {
      _draftThrottle = null;
      if (!_socket || !_roomId) return;
      const { draftElement, draftElements } = useInteractionStore.getState();
      // Build combined draft array: single element first (if any), then multi-drag elements
      const combined: Element[] = [];
      if (draftElement) combined.push(draftElement);
      // Add draftElements that are not already in combined (avoid duplicates for single-drag)
      const combinedIds = new Set(combined.map((e) => e.id));
      for (const el of draftElements) {
        if (!combinedIds.has(el.id)) combined.push(el);
      }
      _socket.emit(WS_EVENTS.ELEMENT_DRAFT, {
        roomId: _roomId,
        sessionId: LOCAL_PRESENCE.sessionId,
        elements: combined,
      });
    }, 50);
  });
}

export function emitCursorMove(cursor: { x: number; y: number }): void {
  if (!_socket || !_roomId) return;
  _socket.emit(WS_EVENTS.CURSOR_MOVE, {
    roomId: _roomId,
    sessionId: LOCAL_PRESENCE.sessionId,
    cursor,
    viewport: useCameraStore.getState().camera,
  });
}

export function stopSocketClient(): void {
  _unregisterHook?.();
  _unregisterHook = null;
  _unsubCamera?.();
  _unsubCamera = null;
  _unsubSelection?.();
  _unsubSelection = null;
  _unsubDraft?.();
  _unsubDraft = null;
  if (_viewportThrottle !== null) {
    clearTimeout(_viewportThrottle);
    _viewportThrottle = null;
  }
  if (_selectionThrottle !== null) {
    clearTimeout(_selectionThrottle);
    _selectionThrottle = null;
  }
  if (_draftThrottle !== null) {
    clearTimeout(_draftThrottle);
    _draftThrottle = null;
  }
  _socket?.disconnect();
  _socket = null;
  _roomId = null;
  _lastServerClock = 0;
  // P3A-03 T013: Reset reconnect-diff state on stop
  _pendingQueue = [];
  _hasJoined = false;
  _reconnectPending = false;
  // Clear all remote cursors and drafts when we leave the room
  const { setRemoteCursors, setRemoteDrafts } = useInteractionStore.getState();
  setRemoteCursors(new Map());
  setRemoteDrafts(new Map());
}
