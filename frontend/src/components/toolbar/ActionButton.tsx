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
      className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md transition-colors ${
        disabled ? 'cursor-not-allowed bg-panel text-muted' : 'cursor-pointer text-ink hover:bg-panel'
      }`}
    >
      <Icon size={ICON_SIZE} />
    </button>
  );
}
