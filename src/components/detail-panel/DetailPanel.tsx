import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { patchElement } from '../../store/mutation-pipeline';
import type { ElementProps } from '../../types/shared';

export default function DetailPanel() {
  const selectedIds = useInteractionStore((s) => s.selectedIds);
  const elements = useElementsStore((s) => s.elements);

  if (selectedIds.length !== 1) return null;

  const element = elements.find((e) => e.id === selectedIds[0] && !e.isDeleted);
  if (!element) return null;

  const { props } = element;

  function patch(partial: Partial<ElementProps>) {
    patchElement(element!.id, { props: { ...props, ...partial } });
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 100,
        background: '#1e1e1e',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        color: '#e0e0e0',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>
        Style
      </div>

      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>Stroke color</span>
        <input
          type="color"
          value={props.strokeColor}
          onChange={(e) => patch({ strokeColor: e.target.value })}
          style={{ width: 36, height: 24, padding: 2, border: 'none', background: 'none', cursor: 'pointer' }}
        />
      </label>

      {element.type !== 'line' && (
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>Fill color</span>
          <input
            type="color"
            value={props.fillColor === 'none' ? '#ffffff' : props.fillColor}
            onChange={(e) => patch({ fillColor: e.target.value })}
            style={{ width: 36, height: 24, padding: 2, border: 'none', background: 'none', cursor: 'pointer' }}
          />
        </label>
      )}

      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>Stroke width</span>
        <input
          type="number"
          min={1}
          value={props.strokeWidth}
          onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
          style={{ width: 56, background: '#2a2a2a', border: '1px solid #444', borderRadius: 4, padding: '2px 6px', color: 'inherit', fontSize: 13 }}
        />
      </label>

      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(props.opacity * 100)}
          onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })}
          style={{ width: 80 }}
        />
      </label>

      {element.type === 'text' && (
        <>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Text
          </div>

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>Font size</span>
            <input
              type="number"
              min={1}
              value={props.fontSize ?? 16}
              onChange={(e) => patch({ fontSize: Number(e.target.value) })}
              style={{ width: 56, background: '#2a2a2a', border: '1px solid #444', borderRadius: 4, padding: '2px 6px', color: 'inherit', fontSize: 13 }}
            />
          </label>

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>Font family</span>
            <select
              value={props.fontFamily ?? 'sans-serif'}
              onChange={(e) => patch({ fontFamily: e.target.value })}
              style={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 4, padding: '2px 4px', color: 'inherit', fontSize: 13 }}
            >
              <option value="sans-serif">Sans-serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
            </select>
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Align</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  aria-label={align}
                  onClick={() => patch({ textAlign: align })}
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
      )}
    </div>
  );
}
