export class RoomActor {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    const run = this.tail.catch(() => undefined).then(task);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export class RoomActorRegistry {
  private readonly actors = new Map<string, RoomActor>();
  private readonly pendingCounts = new Map<string, number>();

  enqueue<T>(roomId: string, task: () => T | Promise<T>): Promise<T> {
    const actor = this.getActor(roomId);
    this.pendingCounts.set(roomId, (this.pendingCounts.get(roomId) ?? 0) + 1);
    return actor.enqueue(task).finally(() => {
      const remaining = (this.pendingCounts.get(roomId) ?? 1) - 1;
      if (remaining <= 0) {
        this.pendingCounts.delete(roomId);
        this.actors.delete(roomId);
      } else {
        this.pendingCounts.set(roomId, remaining);
      }
    });
  }

  getActor(roomId: string): RoomActor {
    const existing = this.actors.get(roomId);
    if (existing) return existing;

    const actor = new RoomActor();
    this.actors.set(roomId, actor);
    return actor;
  }

  hasActor(roomId: string): boolean {
    return this.actors.has(roomId);
  }

  get size(): number {
    return this.actors.size;
  }
}
