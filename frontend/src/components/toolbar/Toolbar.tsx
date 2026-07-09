import { useState } from 'react';
import { useInteractionStore } from '../../store/interaction.store';
import { clearLaserTrail } from '../../canvas/tools/laser-tool';
import { cancelFreehandDraw, cancelHighlighterDraw } from '../../canvas/tools/freehand-tool';
import type { ToolId } from '../../types/interaction';
import { FIXED_TOOLS } from './tool-list';
import ToolButton from './ToolButton';
import MoreToolsMenu from './more-tools/MoreToolsMenu';
import ImageInsertControl from './ImageInsertControl';

type ActiveToolbarPanel = 'image' | 'more' | null;

export default function Toolbar() {
  const [activeToolbarPanel, setActiveToolbarPanel] = useState<ActiveToolbarPanel>(null);
  const tool = useInteractionStore((s) => s.tool);
  const setTool = useInteractionStore((s) => s.setTool);
  const setSelectedIds = useInteractionStore((s) => s.setSelectedIds);
  const setDraggingId = useInteractionStore((s) => s.setDraggingId);
  const setDragStart = useInteractionStore((s) => s.setDragStart);
  const setDraftElement = useInteractionStore((s) => s.setDraftElement);
  const setResizeHandle = useInteractionStore((s) => s.setResizeHandle);
  const setResizeSession = useInteractionStore((s) => s.setResizeSession);

  function resetInteraction() {
    clearLaserTrail();
    cancelFreehandDraw();
    cancelHighlighterDraw();
    setSelectedIds([]);
    setDraggingId(null);
    setDragStart(null);
    setDraftElement(null);
    setResizeHandle(null);
    setResizeSession(null);
  }

  function chooseTool(id: ToolId) {
    resetInteraction();
    setActiveToolbarPanel(null);
    setTool(id);
  }

  function setToolbarPanel(nextPanel: ActiveToolbarPanel) {
    setActiveToolbarPanel(nextPanel);
  }

  return (
    <div
      className="toolbar-scroll absolute left-1/2 z-10 flex max-w-[calc(100vw-16px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-xl border border-rule bg-paper p-1.5 shadow-md"
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {FIXED_TOOLS.map(({ id, label, Icon }) => (
        <ToolButton
          key={id}
          title={label}
          active={activeToolbarPanel === null && tool === id}
          onClick={() => chooseTool(id)}
          Icon={Icon}
        />
      ))}
      <ImageInsertControl
        open={activeToolbarPanel === 'image'}
        onOpen={() => setToolbarPanel('image')}
        onClose={() => setToolbarPanel(null)}
        resetInteraction={resetInteraction}
      />
      <MoreToolsMenu
        tool={tool}
        open={activeToolbarPanel === 'more'}
        showToolActive={activeToolbarPanel === null}
        chooseTool={chooseTool}
        resetInteraction={resetInteraction}
        onOpenChange={(open) => setToolbarPanel(open ? 'more' : null)}
      />
    </div>
  );
}
