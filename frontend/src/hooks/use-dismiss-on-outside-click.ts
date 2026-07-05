import { useEffect, type RefObject } from 'react';

export function useDismissOnOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null> | ReadonlyArray<RefObject<HTMLElement | null>>,
  onDismiss: () => void,
) {
  useEffect(() => {
    const refs = Array.isArray(ref) ? ref : [ref];

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const clickedInside = refs.some((candidate) => candidate.current?.contains(target));
      if (!clickedInside) {
        onDismiss();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onDismiss]);
}
