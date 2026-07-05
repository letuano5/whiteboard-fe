import { useInteractionStore } from '../../store/interaction.store';
import { clearLaserTrail } from '../../canvas/tools/laser-tool';
import { cancelFreehandDraw, cancelHighlighterDraw } from '../../canvas/tools/freehand-tool';
import type { ToolId } from '../../types/interaction';
import { FIXED_TOOLS } from './tool-list';
import ToolButton from './ToolButton';
import MoreToolsMenu from './more-tools/MoreToolsMenu';
import ImageInsertControl from './ImageInsertControl';

export default function Toolbar() {
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
    setTool(id);
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        padding: '6px',
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        border: '1px solid #e5e7eb',
        zIndex: 10,
      }}
    >
      {FIXED_TOOLS.map(({ id, label, Icon }) => (
        <ToolButton key={id} title={label} active={tool === id} onClick={() => chooseTool(id)} Icon={Icon} />
      ))}
      <ImageInsertControl resetInteraction={resetInteraction} />
      <MoreToolsMenu tool={tool} chooseTool={chooseTool} />
    </div>
  );
}
