import { useEffect, useState } from 'react';
import { isEditableKeyboardTarget } from '../../../canvas/keyboard-target';

export function useShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableKeyboardTarget(event.target)) return;
      if (event.key !== '?') return;
      event.preventDefault();
      setIsOpen((open) => !open);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
