interface RangeControlProps {
  label: string;
  max: number;
  min: number;
  value: number;
  onChange: (value: number) => void;
}

export function RangeControl({ label, max, min, value, onChange }: RangeControlProps) {
  return (
    <label
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
    >
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 80 }}
      />
    </label>
  );
}
