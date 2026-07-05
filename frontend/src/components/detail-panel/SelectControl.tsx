interface SelectOption {
  label: string;
  value: string;
}

interface SelectControlProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SelectControl({ label, options, value, onChange }: SelectControlProps) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-field-border bg-panel px-1 py-0.5 text-[13px] text-inherit"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
