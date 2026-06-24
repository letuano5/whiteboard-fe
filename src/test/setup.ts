import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver
if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
