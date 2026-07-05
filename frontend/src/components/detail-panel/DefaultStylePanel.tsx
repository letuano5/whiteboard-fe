import { useInteractionStore } from '../../store/interaction.store';
import { useDefaultStyleStore } from '../../store/default-style.store';
import { SHAPE_TOOLS } from '../../canvas/tools/create-shape-tool';
import type { ToolId } from '../../types/interaction';
import { PanelShell } from './PanelShell';
import { SectionTitle } from './SectionTitle';
import { StyleControls } from './StyleControls';

const STYLE_DRAW_TOOLS: readonly ToolId[] = [...SHAPE_TOOLS, 'freehand'];

function isStyleDrawTool(tool: ToolId): boolean {
  return STYLE_DRAW_TOOLS.includes(tool);
}

export default function DefaultStylePanel() {
  const tool = useInteractionStore((state) => state.tool);
  const selectedIds = useInteractionStore((state) => state.selectedIds);
  const strokeColor = useDefaultStyleStore((state) => state.strokeColor);
  const fillColor = useDefaultStyleStore((state) => state.fillColor);
  const strokeWidth = useDefaultStyleStore((state) => state.strokeWidth);
  const strokeStyle = useDefaultStyleStore((state) => state.strokeStyle);
  const opacity = useDefaultStyleStore((state) => state.opacity);
  const setDefaultStyle = useDefaultStyleStore((state) => state.setDefaultStyle);

  if (selectedIds.length > 0) return null;
  if (!isStyleDrawTool(tool)) return null;

  return (
    <PanelShell>
      <SectionTitle>Default style</SectionTitle>
      <StyleControls
        canFill={tool !== 'line'}
        isText={tool === 'text'}
        props={{ strokeColor, fillColor, strokeWidth, strokeStyle, opacity }}
        onPatchProps={setDefaultStyle}
      />
    </PanelShell>
  );
}
