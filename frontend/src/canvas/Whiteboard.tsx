import { useRef } from 'react';
import { useElementsStore, useInteractionStore, useCameraStore } from '../store';
import ContextMenu from '../components/context-menu/ContextMenu';
import TextEditor from './tools/text-editor';
import SvgLayer from './layers/SvgLayer';
import CursorOverlay from './layers/CursorOverlay';
import Toolbar from '../components/toolbar/Toolbar';
import DetailPanel from '../components/detail-panel/DetailPanel';
import BackToContent from '../components/back-to-content/BackToContent';
import ShareLinkButton from '../components/ShareLinkButton';
import OnlineUsersPanel from '../components/ui/OnlineUsersPanel';
import { AuthMenu } from '../auth/AuthMenu';
import { LoginToSave } from '../local-board/LoginToSave';
import { NativeFileControls } from '../files/NativeFileControls';
import { canEditRoom, useRoomAccessStore } from '../rooms/room-access.store';
import { useSpacePanMode } from './hooks/use-space-pan-mode';
import { useWheelPanZoom } from './hooks/use-wheel-pan-zoom';
import { useWhiteboardPointerHandlers } from './hooks/use-whiteboard-pointer-handlers';
import { useWhiteboardShortcuts } from './hooks/use-whiteboard-shortcuts';

interface WhiteboardProps {
  mode?: 'local' | 'saved';
}

export default function Whiteboard({ mode = 'saved' }: WhiteboardProps) {
  const elements = useElementsStore((s) => s.elements);
  const camera = useCameraStore((s) => s.camera);
  const tool = useInteractionStore((s) => s.tool);
  const draftElement = useInteractionStore((s) => s.draftElement);
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
      : activeTool === 'laser'
        ? 'crosshair'
        : undefined;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor }}
    >
      <SvgLayer
        elements={elements}
        camera={camera}
        draftElement={draftElement}
        editingId={editingId}
        {...svgLayerHandlers}
      />
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
      {canEdit && <Toolbar />}
      {canEdit && <DetailPanel />}
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
