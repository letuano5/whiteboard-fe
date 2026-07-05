import { describe, it, expect, beforeEach } from 'vitest';
import { useDefaultStyleStore, DEFAULT_STYLE_INITIAL } from '../default-style.store';

beforeEach(() => {
  useDefaultStyleStore.setState({ ...DEFAULT_STYLE_INITIAL });
});

describe('useDefaultStyleStore', () => {
  it('initializes with the shape defaults', () => {
    const state = useDefaultStyleStore.getState();
    expect(state.strokeColor).toBe('#1a1a1a');
    expect(state.fillColor).toBe('transparent');
    expect(state.strokeWidth).toBe(2);
    expect(state.strokeStyle).toBe('solid');
    expect(state.opacity).toBe(1);
  });

  it('merges a partial patch without touching other fields', () => {
    useDefaultStyleStore.getState().setDefaultStyle({ strokeColor: '#ff0000' });

    const state = useDefaultStyleStore.getState();
    expect(state.strokeColor).toBe('#ff0000');
    expect(state.fillColor).toBe('transparent');
    expect(state.strokeWidth).toBe(2);
  });

  it('applies multiple fields in one patch', () => {
    useDefaultStyleStore.getState().setDefaultStyle({ strokeWidth: 5, opacity: 0.5 });

    const state = useDefaultStyleStore.getState();
    expect(state.strokeWidth).toBe(5);
    expect(state.opacity).toBe(0.5);
  });
});
