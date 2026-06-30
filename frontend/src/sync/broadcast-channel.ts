import type { Element } from '../types/shared';
import { registerMutationHook } from '../store/mutation-pipeline';
import { applyRemoteElements, isApplyingRemote } from './apply-remote';

const CHANNEL_NAME = 'VDT_WHITEBOARD';

interface BCMessage {
  elements: Element[];
}

let _channel: BroadcastChannel | null = null;
let _unregisterHook: (() => void) | null = null;

export function initBroadcastChannel(): void {
  if (typeof BroadcastChannel === 'undefined') return;

  _channel = new BroadcastChannel(CHANNEL_NAME);

  _channel.onmessage = (event: MessageEvent<BCMessage>) => {
    applyRemoteElements(event.data.elements);
  };

  _unregisterHook = registerMutationHook((e) => {
    if (isApplyingRemote()) return;
    if (!_channel) return;
    _channel.postMessage({ elements: e.elements } satisfies BCMessage);
  });
}

export function stopBroadcastChannel(): void {
  _unregisterHook?.();
  _unregisterHook = null;
  _channel?.close();
  _channel = null;
}
