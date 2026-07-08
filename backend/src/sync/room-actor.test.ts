import { describe, expect, it } from 'vitest';
import { RoomActorRegistry } from './room-actor.js';

describe('RoomActorRegistry', () => {
  it('deletes a room actor after its queued work drains', async () => {
    const registry = new RoomActorRegistry();

    await registry.enqueue('room-1', () => undefined);

    expect(registry.hasActor('room-1')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('keeps the actor until all queued work for that room drains', async () => {
    const registry = new RoomActorRegistry();
    const firstEntered = deferred<void>();
    const releaseFirst = deferred<void>();

    const first = registry.enqueue('room-1', async () => {
      firstEntered.resolve();
      await releaseFirst.promise;
    });
    const second = registry.enqueue('room-1', () => 'done');
    await firstEntered.promise;

    expect(registry.hasActor('room-1')).toBe(true);

    releaseFirst.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, 'done']);
    expect(registry.hasActor('room-1')).toBe(false);
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value?: T | PromiseLike<T>) => void;
} {
  let resolve: (value?: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((innerResolve) => {
    resolve = (value) => innerResolve(value as T | PromiseLike<T>);
  });
  return { promise, resolve };
}
