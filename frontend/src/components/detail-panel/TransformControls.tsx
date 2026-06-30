import { NumberControl } from './NumberControl';
import { SectionTitle } from './SectionTitle';

interface TransformControlsProps {
  angleDegrees: number;
  onAngleChange: (degrees: number) => void;
}

export function TransformControls({ angleDegrees, onAngleChange }: TransformControlsProps) {
  return (
    <>
      <SectionTitle>Transform</SectionTitle>
      <NumberControl
        label="Angle (°)"
        min={-180}
        max={180}
        step={1}
        value={angleDegrees}
        onChange={onAngleChange}
      />
    </>
  );
}
