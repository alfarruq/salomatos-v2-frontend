import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { resetMockDatabase } from '@/shared/api/mocks/handlers'
import { setTenantScope } from '@/shared/api/tenantScope'

afterEach(() => {
  cleanup()
  // Module state outlives a test: a branch or a mock row left behind would leak into the next one.
  setTenantScope(null)
  resetMockDatabase()
})

/*
 * jsdom implements neither ResizeObserver nor the pointer-capture and scroll
 * APIs that Radix's floating layers call. Without these, every popover-based
 * component throws on render in tests while working perfectly in a browser.
 * These are environment gaps, not behaviour we are stubbing out.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}

if (typeof window !== 'undefined') {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList
}
