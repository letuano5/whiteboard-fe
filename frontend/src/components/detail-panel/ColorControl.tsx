interface ColorControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorControl({ label, value, onChange }: ColorControlProps) {
  return (
    <label
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
    >
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 36,
          height: 24,
          padding: 2,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
        }}
      />
    </label>
  );
}
