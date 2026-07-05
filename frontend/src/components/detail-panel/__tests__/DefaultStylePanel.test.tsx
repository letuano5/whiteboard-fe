import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DefaultStylePanel from '../DefaultStylePanel';
import { useInteractionStore } from '../../../store/interaction.store';
import { useDefaultStyleStore, DEFAULT_STYLE_INITIAL } from '../../../store/default-style.store';

beforeEach(() => {
  useInteractionStore.getState().reset();
  useDefaultStyleStore.setState({ ...DEFAULT_STYLE_INITIAL });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DefaultStylePanel visibility', () => {
  it('shows when a shape draw tool is active and nothing is selected', () => {
    useInteractionStore.getState().setTool('rectangle');
    render(<DefaultStylePanel />);
    expect(screen.getByText(/default style/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stroke color/i)).toBeInTheDocument();
  });

  it('shows for the freehand tool', () => {
    useInteractionStore.getState().setTool('freehand');
    render(<DefaultStylePanel />);
    expect(screen.getByText(/default style/i)).toBeInTheDocument();
  });

  it('hides for the select tool', () => {
    useInteractionStore.getState().setTool('select');
    const { container } = render(<DefaultStylePanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides for the hand tool', () => {
    useInteractionStore.getState().setTool('hand');
    const { container } = render(<DefaultStylePanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides for the highlighter tool (fixed styling, not user-configurable)', () => {
    useInteractionStore.getState().setTool('highlighter');
    const { container } = render(<DefaultStylePanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides once an element is selected, even with a draw tool active', () => {
    useInteractionStore.getState().setTool('rectangle');
    useInteractionStore.getState().setSelectedIds(['el-1']);
    const { container } = render(<DefaultStylePanel />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DefaultStylePanel editing', () => {
  it('updates the default style store when stroke width changes', () => {
    useInteractionStore.getState().setTool('rectangle');
    render(<DefaultStylePanel />);

    fireEvent.change(screen.getByLabelText(/stroke width/i), { target: { value: '7' } });

    expect(useDefaultStyleStore.getState().strokeWidth).toBe(7);
  });

  it('hides fill color for the line tool', () => {
    useInteractionStore.getState().setTool('line');
    render(<DefaultStylePanel />);
    expect(screen.queryByLabelText(/fill color/i)).not.toBeInTheDocument();
  });
});
