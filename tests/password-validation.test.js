import { expect, test } from 'vitest'
import { passwordValidationError } from '../src/utils/passwordValidation'

test('password policy uses code points for minimum length and UTF-8 bytes for maximum', () => {
  expect(passwordValidationError('short123')).toMatch(/at least 12 characters/)
  expect(passwordValidationError('a'.repeat(12))).toBe('')
  expect(passwordValidationError('😀'.repeat(18))).toBe('')
  expect(passwordValidationError('😀'.repeat(19))).toMatch(/72 bytes.*UTF-8/)
})
