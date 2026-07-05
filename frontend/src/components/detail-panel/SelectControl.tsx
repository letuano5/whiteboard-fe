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
    <label
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
    >
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: '#f9fafb',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          padding: '2px 4px',
          color: 'inherit',
          fontSize: 13,
        }}
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
