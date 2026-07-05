import type { ElementProps } from '../../types/shared';
import { NumberControl } from './NumberControl';
import { SectionTitle } from './SectionTitle';
import { SelectControl } from './SelectControl';

const FONT_FAMILY_OPTIONS = [
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
];

const TEXT_ALIGNMENTS = ['left', 'center', 'right'] as const;

interface TextControlsProps {
  props: ElementProps;
  onFontSizeChange: (fontSize: number) => void;
  onFontFamilyChange: (fontFamily: string) => void;
  onPatchProps: (partial: Partial<ElementProps>) => void;
}

export function TextControls({
  props,
  onFontSizeChange,
  onFontFamilyChange,
  onPatchProps,
}: TextControlsProps) {
  return (
    <>
      <SectionTitle withSpacing>Text</SectionTitle>

      <NumberControl
        label="Font size"
        min={1}
        value={props.fontSize ?? 16}
        onChange={onFontSizeChange}
      />

      <SelectControl
        label="Font family"
        value={props.fontFamily ?? 'sans-serif'}
        options={FONT_FAMILY_OPTIONS}
        onChange={onFontFamilyChange}
      />

      <div className="flex items-center justify-between">
        <span>Align</span>
        <div className="flex gap-1">
          {TEXT_ALIGNMENTS.map((align) => (
            <button
              key={align}
              aria-label={align}
              onClick={() => onPatchProps({ textAlign: align })}
              className={`flex h-6 w-7 items-center justify-center rounded text-xs ${
                props.textAlign === align
                  ? 'border border-primary bg-primary text-paper'
                  : 'border border-field-border bg-panel text-ink'
              }`}
            >
              {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
