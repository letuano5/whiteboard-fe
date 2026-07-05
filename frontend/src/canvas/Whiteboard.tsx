import { useRef } from 'react';
import { Menu } from 'lucide-react';
import { useElementsStore, useInteractionStore, useCameraStore } from '../store';
import ContextMenu from '../components/context-menu/ContextMenu';
import TextEditor from './tools/text-editor';
import SvgLayer from './layers/SvgLayer';
import CursorOverlay from './layers/CursorOverlay';
import Toolbar from '../components/toolbar/Toolbar';
import ActionToolbar from '../components/toolbar/ActionToolbar';
import DetailPanel from '../components/detail-panel/DetailPanel';
import DefaultStylePanel from '../components/detail-panel/DefaultStylePanel';
import BackToContent from '../components/back-to-content/BackToContent';
import ShareLinkButton from '../components/ShareLinkButton';
import OnlineUsersPanel from '../components/ui/OnlineUsersPanel';
import { AuthMenu } from '../auth/AuthMenu';
import { LoginToSave } from '../local-board/LoginToSave';
import { NativeFileControls } from '../files/NativeFileControls';
import { canEditRoom, useRoomAccessStore } from '../rooms/room-access.store';
import { RoomHistoryButton } from '../rooms/RoomHistoryButton';
import { useSpacePanMode } from './hooks/use-space-pan-mode';
import { useWheelPanZoom } from './hooks/use-wheel-pan-zoom';
import { useWhiteboardPointerHandlers } from './hooks/use-whiteboard-pointer-handlers';
import { useWhiteboardShortcuts } from './hooks/use-whiteboard-shortcuts';
import { waitForSyncIdle } from '../sync/socket-client';
import { dashboardPath, navigate } from '../app/routing';

interface WhiteboardProps {
  mode?: 'local' | 'saved';
}

async function openDashboard(isLocalBoard: boolean): Promise<void> {
  // Wait for any pending delete/patch to reach the server first, so the
  // dashboard's fresh fetch doesn't race ahead of a just-issued mutation.
  if (!isLocalBoard) {
    await waitForSyncIdle();
  }
  navigate(dashboardPath());
}

export default function Whiteboard({ mode = 'saved' }: WhiteboardProps) {
  const elements = useElementsStore((s) => s.elements);
  const camera = useCameraStore((s) => s.camera);
  const tool = useInteractionStore((s) => s.tool);
  const editingId = useInteractionStore((s) => s.editingId);
  const selectedIds = useInteractionStore((s) => s.selectedIds);
  const role = useRoomAccessStore((s) => s.effectiveRole);
  const isLocalBoard = mode === 'local';
  const canEdit = isLocalBoard || canEditRoom(role);
  const roomId = new URLSearchParams(window.location.search).get('room');
  const activeTool = canEdit ? tool : 'select';
  const editingElement = editingId
    ? (elements.find((el) => el.id === editingId && !el.isDeleted) ?? null)
    : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const spaceDown = useSpacePanMode();
  useWheelPanZoom(containerRef);
  useWhiteboardShortcuts(activeTool, canEdit);
  const { contextMenu, isPanning, onCloseContextMenu, svgLayerHandlers } =
    useWhiteboardPointerHandlers({
      canEdit,
      camera,
      elements,
      editingId,
      spaceDown,
      tool: activeTool,
    });

  // T023: cursor style based on pan/zoom mode
  const cursor = isPanning
    ? 'grabbing'
    : activeTool === 'hand' || spaceDown
      ? 'grab'
      : activeTool === 'laser' ||
          activeTool === 'freehand' ||
          activeTool === 'highlighter' ||
          activeTool === 'eraser'
        ? 'crosshair'
        : undefined;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor,
        touchAction: 'none',
      }}
    >
      <button
        type="button"
        onClick={() => {
          void openDashboard(isLocalBoard);
        }}
        className="absolute left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-[#cbd9cb] bg-white text-[#173f35] shadow-[0_8px_24px_rgba(23,63,53,0.12)] hover:bg-[#edf5ef] focus:outline-none focus:ring-2 focus:ring-[#2457c5] focus:ring-offset-2"
        aria-label="Open dashboard"
        title="Open dashboard"
      >
        <Menu className="h-5 w-5" />
      </button>
      <SvgLayer elements={elements} camera={camera} editingId={editingId} {...svgLayerHandlers} />
      {/* T015: CursorOverlay — sibling div after SvgLayer, pointer-events: none, zIndex: 10 */}
      <CursorOverlay />
      {/* T012: Context menu — rendered above all canvas elements */}
      {canEdit && contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedId={contextMenu.id}
          selectedCount={selectedIds.includes(contextMenu.id) ? selectedIds.length : 1}
          onClose={onCloseContextMenu}
        />
      )}
      {canEdit && editingElement && <TextEditor element={editingElement} camera={camera} />}
      {canEdit && <ActionToolbar />}
      {canEdit && <Toolbar />}
      {canEdit && <DetailPanel />}
      {canEdit && <DefaultStylePanel />}
      <BackToContent containerRef={containerRef} />
      {/* T021: Online users panel + share button stacked in top-right */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        {isLocalBoard ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NativeFileControls mode="local" roomId={null} canImport={canEdit} />
            <LoginToSave />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NativeFileControls mode="saved" roomId={roomId} canImport={canEdit} />
              <RoomHistoryButton roomId={roomId} canRestore={role === 'owner'} />
              <ShareLinkButton />
              <AuthMenu />
            </div>
            <OnlineUsersPanel />
          </>
        )}
      </div>
      {activeTool === 'select' && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            fontSize: '12px',
            color: '#aaa',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          Click chuột giữa để scroll canvas
        </div>
      )}
    </div>
  );
}
