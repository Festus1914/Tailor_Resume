import { expect, afterEach } from "vitest";

// Mock MongoDB for testing if needed
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Cleanup after each test
afterEach(() => {
  // Add cleanup logic here
});
