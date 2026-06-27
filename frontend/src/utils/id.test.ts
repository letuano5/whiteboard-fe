import { describe, it, expect } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('returns a valid UUID format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(generateId()).toMatch(uuidRegex);
  });

  it('generates unique IDs', () => {
    const ids = Array.from({ length: 100 }, generateId);
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });
});
