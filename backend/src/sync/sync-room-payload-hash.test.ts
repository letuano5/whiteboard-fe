import { describe, expect, it } from 'vitest';
import { toPayloadHash } from './sync-room-payload-hash.js';

describe('toPayloadHash', () => {
  it('returns a stable SHA-256 digest instead of storing canonical JSON', () => {
    // @covers L1
    const left = toPayloadHash({ b: 2, a: { z: 'large-payload-marker' } });
    const right = toPayloadHash({ a: { z: 'large-payload-marker' }, b: 2 });

    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
    expect(left).not.toContain('large-payload-marker');
  });
});
