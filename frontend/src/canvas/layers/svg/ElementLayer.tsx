import type { Element } from '../../../types/shared';
import { getShapeUtil } from '../../shapes';

interface ElementLayerProps {
  elements: Element[];
  editingId?: string | null;
}

export default function ElementLayer({ elements, editingId }: ElementLayerProps) {
  return (
    <>
      {elements.map((el) => {
        const util = getShapeUtil(el.type);
        if (!util) return null;

        return (
          <g key={el.id} opacity={el.id === editingId ? 0 : undefined}>
            {util.render(el)}
          </g>
        );
      })}
    </>
  );
}
