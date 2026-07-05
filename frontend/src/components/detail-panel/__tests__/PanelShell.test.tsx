import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelShell } from '../PanelShell';

describe('PanelShell mobile sizing', () => {
  it('@covers AC-2 (049-mobile-responsive-pan-zoom): clamps panel width to the viewport while preserving vertical scroll', () => {
    render(
      <PanelShell>
        <div>Panel content</div>
      </PanelShell>,
    );

    const panel = screen.getByText('Panel content').parentElement as HTMLElement;

    expect(panel.style.minWidth).toBe('220px');
    expect(panel.style.maxWidth).toBe('min(320px, calc(100vw - 32px))');
    expect(panel.style.maxHeight).toBe('60vh');
    expect(panel.style.overflowY).toBe('auto');
  });
});
