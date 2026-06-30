import type { ElementProps } from '../../types/shared';
import { ColorControl } from './ColorControl';
import { NumberControl } from './NumberControl';
import { RangeControl } from './RangeControl';
import { SectionTitle } from './SectionTitle';
import { SelectControl } from './SelectControl';

const STROKE_STYLE_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

interface StyleControlsProps {
  canFill: boolean;
  isText?: boolean;
  props: ElementProps;
  titleSpacing?: boolean;
  onPatchProps: (partial: Partial<ElementProps>) => void;
}

function colorInputValue(color: string) {
  return color === 'none' || color === 'transparent' ? '#ffffff' : color;
}

export function StyleControls({
  canFill,
  isText = false,
  props,
  titleSpacing = true,
  onPatchProps,
}: StyleControlsProps) {
  return (
    <>
      <SectionTitle withSpacing={titleSpacing}>Style</SectionTitle>

      <ColorControl
        label={isText ? 'Font color' : 'Stroke color'}
        value={props.strokeColor}
        onChange={(strokeColor) => onPatchProps({ strokeColor })}
      />

      {canFill && (
        <ColorControl
          label={isText ? 'Border color' : 'Fill color'}
          value={colorInputValue(props.fillColor)}
          onChange={(fillColor) => onPatchProps({ fillColor })}
        />
      )}

      <NumberControl
        label={isText ? 'Border width' : 'Stroke width'}
        min={isText ? 0 : 1}
        value={props.strokeWidth}
        onChange={(strokeWidth) => onPatchProps({ strokeWidth })}
      />

      <SelectControl
        label="Stroke style"
        value={props.strokeStyle}
        options={STROKE_STYLE_OPTIONS}
        onChange={(strokeStyle) =>
          onPatchProps({ strokeStyle: strokeStyle as ElementProps['strokeStyle'] })
        }
      />

      <RangeControl
        label="Opacity"
        min={0}
        max={100}
        value={Math.round(props.opacity * 100)}
        onChange={(opacity) => onPatchProps({ opacity: opacity / 100 })}
      />
    </>
  );
}
