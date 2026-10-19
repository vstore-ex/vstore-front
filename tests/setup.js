import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'

let unexpectedRequests
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  unexpectedRequests = []
  vi.stubGlobal('fetch', vi.fn((url) => {
    unexpectedRequests.push(String(url))
    return Promise.reject(new Error(`Unexpected request in test: ${url}`))
  }))
})

afterEach(() => {
  cleanup()
  expect(unexpectedRequests, 'Tests must explicitly isolate every backend request').toEqual([])
})

// jsdom has no native dialog top layer. Test visibility/state here; real focus trapping
// and Escape behavior belong in browser checks, not this shim.
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value() { this.setAttribute('open', '') } },
  close: { configurable: true, value() { this.removeAttribute('open') } },
})
