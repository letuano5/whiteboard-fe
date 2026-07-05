const BUTTON_SIZE = 30;
const ICON_SIZE = 16;

interface ActionButtonProps {
  title: string;
  disabled: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ size?: number }>;
}

export default function ActionButton({ title, disabled, onClick, Icon }: ActionButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#f3f4f6' : 'transparent',
        color: disabled ? '#9ca3af' : '#374151',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <Icon size={ICON_SIZE} />
    </button>
  );
}
