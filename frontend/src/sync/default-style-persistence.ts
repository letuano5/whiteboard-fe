import { useDefaultStyleStore, type DefaultStyle } from '../store/default-style.store';

export const STORAGE_KEY = 'VDT_DEFAULT_STYLE';
const DEBOUNCE_MS = 300;

const STROKE_STYLES = new Set(['solid', 'dashed', 'dotted']);
const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right']);

function isValidDefaultStyle(value: unknown): value is DefaultStyle {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.strokeColor !== 'string' ||
    typeof v.fillColor !== 'string' ||
    typeof v.strokeWidth !== 'number' ||
    typeof v.strokeStyle !== 'string' ||
    !STROKE_STYLES.has(v.strokeStyle) ||
    typeof v.opacity !== 'number'
  ) {
    return false;
  }
  if (v.fontSize !== undefined && typeof v.fontSize !== 'number') return false;
  if (v.fontFamily !== undefined && typeof v.fontFamily !== 'string') return false;
  if (v.textAlign !== undefined && !TEXT_ALIGNMENTS.has(v.textAlign as string)) return false;
  return true;
}

function readDefaultStyle(): DefaultStyle | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDefaultStyle(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDefaultStyle(style: DefaultStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
  } catch {
    // QuotaExceededError or other storage errors — fail silently
  }
}

export function initDefaultStylePersistence(): void {
  const style = readDefaultStyle();
  if (!style) return;
  useDefaultStyleStore.getState().setDefaultStyle(style);
}

export function startDefaultStylePersistence(): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleWrite(style: DefaultStyle): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      writeDefaultStyle(style);
    }, DEBOUNCE_MS);
  }

  const unsub = useDefaultStyleStore.subscribe((state) => {
    scheduleWrite({
      strokeColor: state.strokeColor,
      fillColor: state.fillColor,
      strokeWidth: state.strokeWidth,
      strokeStyle: state.strokeStyle,
      opacity: state.opacity,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      textAlign: state.textAlign,
    });
  });

  return () => {
    unsub();
    if (debounceTimer !== null) clearTimeout(debounceTimer);
  };
}
