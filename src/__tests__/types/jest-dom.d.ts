// Jest DOM type extensions
import '@testing-library/jest-dom'

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveTextContent(text: string): R
    }
  }
}
