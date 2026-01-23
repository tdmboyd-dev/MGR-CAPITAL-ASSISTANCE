/**
 * Redis Mock for Testing
 *
 * In-memory Map-based mock for Redis client.
 * Simulates get/set/del/keys operations.
 */

import { jest } from "@jest/globals";

// In-memory storage
const store = new Map<string, { value: string; expiresAt: number | null }>();

// Helper to check if key is expired
const isExpired = (key: string): boolean => {
  const item = store.get(key);
  if (!item) return true;
  if (item.expiresAt && Date.now() > item.expiresAt) {
    store.delete(key);
    return true;
  }
  return false;
};

// Mock Redis client
export const redisMock = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue("PONG"),

  get: jest.fn((key: string) => {
    if (isExpired(key)) return Promise.resolve(null);
    const item = store.get(key);
    return Promise.resolve(item?.value ?? null);
  }),

  set: jest.fn((key: string, value: string, options?: { EX?: number }) => {
    const expiresAt = options?.EX
      ? Date.now() + options.EX * 1000
      : null;
    store.set(key, { value, expiresAt });
    return Promise.resolve("OK");
  }),

  del: jest.fn((key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    let deleted = 0;
    for (const k of keys) {
      if (store.delete(k)) deleted++;
    }
    return Promise.resolve(deleted);
  }),

  keys: jest.fn((pattern: string) => {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    const matchingKeys: string[] = [];
    for (const key of store.keys()) {
      if (!isExpired(key) && regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    return Promise.resolve(matchingKeys);
  }),

  // Event handlers
  on: jest.fn(),

  // Helper to clear store between tests
  __clear: () => store.clear(),

  // Helper to get store size
  __size: () => store.size,

  // Helper to inspect store
  __getStore: () => new Map(store),
};

// Reset mock between tests
beforeEach(() => {
  redisMock.__clear();
  jest.clearAllMocks();
});

// Mock the redis module
jest.mock("redis", () => ({
  createClient: jest.fn(() => redisMock),
}));

export default redisMock;
