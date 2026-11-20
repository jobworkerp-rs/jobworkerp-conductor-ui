import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup)

// jsdom has no layout engine and lacks ResizeObserver, which Radix form
// controls (Switch inside a <form>) use to size their hidden native input.
// Nothing is measured in these tests, so an inert implementation suffices.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
