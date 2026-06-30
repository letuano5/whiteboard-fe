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
  onPatchProps: (partial: Partial<ElementProps>) => void;
}

export function TextControls({ props, onFontSizeChange, onPatchProps }: TextControlsProps) {
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
        onChange={(fontFamily) => onPatchProps({ fontFamily })}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Align</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TEXT_ALIGNMENTS.map((align) => (
            <button
              key={align}
              aria-label={align}
              onClick={() => onPatchProps({ textAlign: align })}
              style={{
                width: 28,
                height: 24,
                background: props.textAlign === align ? '#3b82f6' : '#2a2a2a',
                border: '1px solid #444',
                borderRadius: 4,
                color: 'inherit',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
