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
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-primary text-paper' : 'text-ink hover:bg-panel'
      }`}
    >
      <Icon size={18} />
    </button>
  );
}
