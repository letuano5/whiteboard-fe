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

    expect(panel).toHaveClass('min-w-[220px]');
    expect(panel).toHaveClass('max-w-[min(320px,calc(100vw-32px))]');
    expect(panel.style.top).toBe('calc(64px + env(safe-area-inset-top))');
    expect(panel.style.left).toBe('calc(12px + env(safe-area-inset-left))');
    expect(panel.style.maxHeight).toBe(
      'calc((100vh - 88px) - (env(safe-area-inset-bottom) + env(safe-area-inset-top)))',
    );
    expect(panel.style.overflowY).toBe('auto');
  });
});
