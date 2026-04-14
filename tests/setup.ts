import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

class ResizeObserverMock {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('reduce') ? false : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  writable: true,
  value: () => ({
    clearRect: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    fillRect: () => {},
    setTransform: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    beginPath: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    arc: () => {},
    fillText: () => {},
  }),
})

if (typeof File !== 'undefined' && !File.prototype.text) {
  Object.defineProperty(File.prototype, 'text', {
    writable: true,
    value: function text(this: File) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error)
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.readAsText(this)
      })
    },
  })
}
