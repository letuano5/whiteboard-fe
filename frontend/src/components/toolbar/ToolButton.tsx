interface ToolButtonProps {
  title: string;
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ size?: number }>;
}

export default function ToolButton({ title, active, onClick, Icon }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        background: active ? '#2563eb' : 'transparent',
        color: active ? 'white' : '#374151',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <Icon size={18} />
    </button>
  );
}
