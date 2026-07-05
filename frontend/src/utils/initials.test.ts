import { describe, it, expect } from 'vitest';
import { getInitials } from './initials';

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('Minh Tran')).toBe('MT');
  });

  it('splits an email into local part and domain', () => {
    expect(getInitials('owner@example.com')).toBe('OE');
  });

  it('falls back to a single letter when there is only one part', () => {
    expect(getInitials('solo')).toBe('S');
  });

  it('falls back to U for an empty label', () => {
    expect(getInitials('')).toBe('U');
  });
});
