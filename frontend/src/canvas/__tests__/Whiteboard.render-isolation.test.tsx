import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Whiteboard from '../Whiteboard';
import { useAuthStore } from '../../auth/auth.store';
import { useRoomAccessStore } from '../../rooms/room-access.store';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import type { Element } from '../../types/shared';

const svgLayerRenderSpy = vi.hoisted(() => vi.fn());

vi.mock('../layers/SvgLayer', () => ({
  default: () => {
    svgLayerRenderSpy();
    return <svg data-testid="svg-layer" />;
  },
}));

vi.mock('../layers/CursorOverlay', () => ({
  default: () => <div data-testid="cursor-overlay" />,
}));

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'draft-line',
    type: 'line',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#111111',
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
      points: [
        [0, 0],
        [20, 20],
      ],
    },
    version: 1,
    versionNonce: 1,
    updatedAt: 1,
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

beforeEach(() => {
  svgLayerRenderSpy.mockClear();
  useElementsStore.setState({ elements: [] });
  useInteractionStore.getState().reset();
  useRoomAccessStore.getState().resetRoomAccess();
  useAuthStore.setState({
    session: null,
    status: 'anonymous',
    errorMessage: null,
    noticeMessage: null,
  });
});

describe('Whiteboard — P3C-00 render isolation', () => {
  // @covers AC-1
  it('does not re-render from direct draft subscriptions when draft points update', () => {
    useRoomAccessStore.getState().setRoomAccess({
      roomId: 'room-1',
      role: 'viewer',
      baseRole: 'viewer',
      effectiveRole: 'viewer',
      visibility: 'private',
      shareRevokedAt: null,
      members: [],
      invitations: [],
    });

    render(<Whiteboard mode="saved" />);
    expect(screen.getByTestId('svg-layer')).toBeInTheDocument();
    expect(svgLayerRenderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      useInteractionStore.getState().setDraftElement(makeElement());
    });
    act(() => {
      useInteractionStore.getState().setDraftElement(
        makeElement({
          props: {
            ...makeElement().props,
            points: [
              [0, 0],
              [20, 20],
              [30, 30],
            ],
          },
        }),
      );
    });

    expect(svgLayerRenderSpy).toHaveBeenCalledTimes(1);
  });
});
