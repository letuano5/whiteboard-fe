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

describe('DefaultStylePanel — text tool', () => {
  it('shows font size, font family, and align controls for the text tool', () => {
    useInteractionStore.getState().setTool('text');
    render(<DefaultStylePanel />);

    expect(screen.getByText(/font size/i)).toBeInTheDocument();
    expect(screen.getByText(/font family/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'center' })).toBeInTheDocument();
  });

  it('does not show text controls for a non-text draw tool', () => {
    useInteractionStore.getState().setTool('rectangle');
    render(<DefaultStylePanel />);

    expect(screen.queryByText(/font size/i)).not.toBeInTheDocument();
  });

  it('updates default font size/family/align in the store', () => {
    useInteractionStore.getState().setTool('text');
    render(<DefaultStylePanel />);

    fireEvent.change(screen.getByLabelText(/font size/i), { target: { value: '24' } });
    expect(useDefaultStyleStore.getState().fontSize).toBe(24);

    fireEvent.change(screen.getByLabelText(/font family/i), { target: { value: 'serif' } });
    expect(useDefaultStyleStore.getState().fontFamily).toBe('serif');

    fireEvent.click(screen.getByRole('button', { name: 'right' }));
    expect(useDefaultStyleStore.getState().textAlign).toBe('right');
  });
});
