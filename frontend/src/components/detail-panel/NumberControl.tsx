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
    <label className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 rounded border border-field-border bg-panel px-1.5 py-0.5 text-[13px] text-inherit"
      />
    </label>
  );
}
