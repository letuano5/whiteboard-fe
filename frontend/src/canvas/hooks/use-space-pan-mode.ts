import { useEffect, useState } from 'react';
import { isEditableKeyboardTarget } from '../keyboard-target';

export function useSpacePanMode(): boolean {
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      setSpaceDown(true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') setSpaceDown(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return spaceDown;
}
