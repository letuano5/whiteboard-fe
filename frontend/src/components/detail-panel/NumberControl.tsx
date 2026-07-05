interface NumberControlProps {
  label: string;
  max?: number;
  min?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

export function NumberControl({ label, max, min, step, value, onChange }: NumberControlProps) {
  return (
    <label
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
    >
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 56,
          background: '#f9fafb',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          padding: '2px 6px',
          color: 'inherit',
          fontSize: 13,
        }}
      />
    </label>
  );
}
