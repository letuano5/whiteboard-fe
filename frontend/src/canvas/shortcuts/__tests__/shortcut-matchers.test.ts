import { describe, expect, it } from 'vitest';
import { isArrowMoveShortcut, isCutShortcut, isSelectAllShortcut } from '../shortcut-matchers';

describe('isSelectAllShortcut', () => {
  it('matches Ctrl+A and Cmd+A', () => {
    expect(isSelectAllShortcut({ key: 'a', ctrlKey: true })).toBe(true);
    expect(isSelectAllShortcut({ key: 'a', metaKey: true })).toBe(true);
  });

  it('does not match without a modifier', () => {
    expect(isSelectAllShortcut({ key: 'a' })).toBe(false);
  });
});

describe('isCutShortcut', () => {
  it('matches Ctrl+X and Cmd+X', () => {
    expect(isCutShortcut({ key: 'x', ctrlKey: true })).toBe(true);
    expect(isCutShortcut({ key: 'x', metaKey: true })).toBe(true);
  });

  it('does not match without a modifier', () => {
    expect(isCutShortcut({ key: 'x' })).toBe(false);
  });
});

describe('isArrowMoveShortcut', () => {
  it('matches plain arrow keys', () => {
    expect(isArrowMoveShortcut({ key: 'ArrowUp' })).toBe(true);
    expect(isArrowMoveShortcut({ key: 'ArrowDown' })).toBe(true);
    expect(isArrowMoveShortcut({ key: 'ArrowLeft' })).toBe(true);
    expect(isArrowMoveShortcut({ key: 'ArrowRight' })).toBe(true);
  });

  it('does not match arrow keys held with Ctrl/Cmd', () => {
    expect(isArrowMoveShortcut({ key: 'ArrowUp', ctrlKey: true })).toBe(false);
    expect(isArrowMoveShortcut({ key: 'ArrowUp', metaKey: true })).toBe(false);
  });

  it('does not match unrelated keys', () => {
    expect(isArrowMoveShortcut({ key: 'a' })).toBe(false);
  });
});
