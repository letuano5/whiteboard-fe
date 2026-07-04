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

  enqueue<T>(roomId: string, task: () => T | Promise<T>): Promise<T> {
    return this.getActor(roomId).enqueue(task);
  }

  getActor(roomId: string): RoomActor {
    const existing = this.actors.get(roomId);
    if (existing) return existing;

    const actor = new RoomActor();
    this.actors.set(roomId, actor);
    return actor;
  }
}
