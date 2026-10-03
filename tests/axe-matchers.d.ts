import type { Assertion } from 'vitest'

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toHaveNoViolations(this: Assertion<R, T>): R
  }
}
