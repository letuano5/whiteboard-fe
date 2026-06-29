import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useElementsStore } from '../../store/elements.store';
import { applyRemoteElements } from '../apply-remote';

type BCListener = (event: MessageEvent) => void;

let _postMessage: ReturnType<typeof vi.fn>;
let _close: ReturnType<typeof vi.fn>;
let _onmessageRef: { current: BCListener | null };

function makeBCConstructor() {
  _postMessage = vi.fn();
  _close = vi.fn();
  _onmessageRef = { current: null };

  class MockBroadcastChannel {
    postMessage = _postMessage;
    close = _close;
    get onmessage() {
      return _onmessageRef.current;
    }
    set onmessage(v: BCListener | null) {
      _onmessageRef.current = v;
    }
  }

  return MockBroadcastChannel;
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', makeBCConstructor());
  useElementsStore.setState({ elements: [] });
});

afterEach(async () => {
  const { stopBroadcastChannel } = await import('../broadcast-channel');
  stopBroadcastChannel();
  vi.unstubAllGlobals();
  vi.resetModules();
});

// @covers AC-13
describe('AC-13: BC hook does not re-broadcast received remote messages', () => {
  it('does not call postMessage when applying remote elements (isApplyingRemote guard)', async () => {
    const { initBroadcastChannel } = await import('../broadcast-channel');
    initBroadcastChannel();

    const el = {
      id: 'remote-el',
      type: 'rectangle' as const,
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      angle: 0,
      zIndex: 1,
      version: 1,
      versionNonce: 123,
      updatedAt: Date.now(),
      isDeleted: false,
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'remote',
      props: {
        strokeColor: '#000',
        fillColor: '#fff',
        strokeWidth: 2,
        strokeStyle: 'solid' as const,
        opacity: 1,
      },
    };

    applyRemoteElements([el]);

    expect(_postMessage).not.toHaveBeenCalled();
  });
});

// @covers AC-14
describe('AC-14: applyRemoteElements signature is reusable (no BC-specific params)', () => {
  it('has a single-parameter signature accepting Element[]', () => {
    expect(typeof applyRemoteElements).toBe('function');
    expect(applyRemoteElements.length).toBe(1);
  });
});

// Graceful degradation (E2)
describe('Graceful degradation: BroadcastChannel not available', () => {
  it('returns without throwing when BroadcastChannel is undefined', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const { initBroadcastChannel } = await import('../broadcast-channel');
    expect(() => initBroadcastChannel()).not.toThrow();
    expect(useElementsStore.getState().elements).toHaveLength(0);
  });
});

// Unmount cleanup (FR-008)
describe('stopBroadcastChannel: closes channel and unregisters mutation hook', () => {
  it('calls channel.close() on stopBroadcastChannel', async () => {
    const { initBroadcastChannel, stopBroadcastChannel } = await import('../broadcast-channel');
    initBroadcastChannel();
    stopBroadcastChannel();
    expect(_close).toHaveBeenCalledOnce();
  });

  it('does not postMessage after stopBroadcastChannel (hook unregistered)', async () => {
    const { initBroadcastChannel, stopBroadcastChannel } = await import('../broadcast-channel');
    initBroadcastChannel();
    stopBroadcastChannel();

    const { createElement } = await import('../../store/mutation-pipeline');
    createElement({
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      angle: 0,
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'test',
      props: { strokeColor: '#000', fillColor: '#fff', strokeWidth: 2, strokeStyle: 'solid', opacity: 1 },
    });

    expect(_postMessage).not.toHaveBeenCalled();
  });
});
