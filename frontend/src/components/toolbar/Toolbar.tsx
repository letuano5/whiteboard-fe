import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  Diamond,
  Triangle,
  Hexagon,
  Minus,
  ArrowRight,
  Type,
  Zap,
  Pencil,
  Eraser,
} from 'lucide-react';
import { useInteractionStore } from '../../store/interaction.store';
import { clearLaserTrail } from '../../canvas/tools/laser-tool';
import type { ToolId } from '../../types/interaction';
import ImageInsertControl from './ImageInsertControl';

interface ToolButton {
  id: ToolId;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
}

const TOOLS: ToolButton[] = [
  { id: 'select', label: 'Select', Icon: MousePointer2 },
  { id: 'hand', label: 'Hand', Icon: Hand },
  { id: 'rectangle', label: 'Rectangle', Icon: Square },
  { id: 'ellipse', label: 'Ellipse', Icon: Circle },
  { id: 'diamond', label: 'Diamond', Icon: Diamond },
  { id: 'triangle', label: 'Triangle', Icon: Triangle },
  { id: 'polygon', label: 'Polygon', Icon: Hexagon },
  { id: 'line', label: 'Line', Icon: Minus },
  { id: 'arrow', label: 'Arrow', Icon: ArrowRight },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'freehand', label: 'Freehand', Icon: Pencil },
  { id: 'eraser', label: 'Eraser', Icon: Eraser },
  { id: 'laser', label: 'Laser', Icon: Zap },
];

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
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          title={label}
          onClick={() => chooseTool(id)}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: tool === id ? '#2563eb' : 'transparent',
            color: tool === id ? 'white' : '#374151',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            if (tool !== id) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            if (tool !== id)
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <Icon size={18} />
        </button>
      ))}
      <ImageInsertControl resetInteraction={resetInteraction} />
    </div>
  );
}
