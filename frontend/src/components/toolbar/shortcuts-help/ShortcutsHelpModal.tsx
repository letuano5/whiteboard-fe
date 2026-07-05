import { useEffect } from 'react';
import { SHORTCUT_GROUPS } from './shortcut-list';

interface ShortcutsHelpModalProps {
  onClose: () => void;
}

export default function ShortcutsHelpModal({ onClose }: ShortcutsHelpModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-[90%] max-w-[420px] overflow-y-auto rounded-[10px] bg-paper px-6 py-5 text-ink shadow-lg"
      >
        <h2 className="mb-3 text-base font-semibold text-ink">Keyboard shortcuts</h2>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {group.title}
            </h3>
            <ul className="m-0 list-none p-0">
              {group.items.map((item) => (
                <li
                  key={item.label}
                  className="flex justify-between gap-3 py-1 text-[13px] text-ink"
                >
                  <span>{item.label}</span>
                  <kbd className="whitespace-nowrap rounded border border-rule bg-panel px-1.5 py-0.5 font-[inherit] text-xs text-ink">
                    {item.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
