import { useInteractionStore } from '../../../store/interaction.store';
import type { Element } from '../../../types/shared';
import { getSnapIndicatorPoints } from './selectors';
import SnapIndicators from './SnapIndicators';

interface SnapIndicatorLayerProps {
  elements: Element[];
}

export default function SnapIndicatorLayer({ elements }: SnapIndicatorLayerProps) {
  const tool = useInteractionStore((s) => s.tool);
  const draftElement = useInteractionStore((s) => s.draftElement);
  const points = getSnapIndicatorPoints(tool, draftElement, elements);

  return <SnapIndicators points={points} />;
}
