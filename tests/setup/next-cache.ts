import { vi } from "vitest";

// Next's data cache only exists inside a Next server. Server tests read
// settings straight from the test database, and cache refreshes do nothing.
// A test file can still mock "next/cache" itself to check how it is called.
vi.mock("next/cache", () => ({
  unstable_cache: (read: () => Promise<unknown>) => read,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));
