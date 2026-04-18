import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePhone,
  validatePrice,
  validateQuantity,
  validatePIN,
  validateSKU,
} from './validators'

describe('validators', () => {
  describe('validateEmail', () => {
    it('returns valid for "user@gmail.com"', () => {
      expect(validateEmail('user@gmail.com').valid).toBe(true)
    })

    it('returns invalid for "notanemail"', () => {
      const result = validateEmail('notanemail')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('validatePhone', () => {
    it('returns valid for "081234567890"', () => {
      expect(validatePhone('081234567890').valid).toBe(true)
    })

    it('returns valid for "+6281234567890"', () => {
      expect(validatePhone('+6281234567890').valid).toBe(true)
    })

    it('returns invalid for "12345" (too short)', () => {
      const result = validatePhone('12345')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('validatePrice', () => {
    it('returns valid for 3500', () => {
      expect(validatePrice(3500).valid).toBe(true)
    })

    it('returns invalid for 0', () => {
      const result = validatePrice(0)
      expect(result.valid).toBe(false)
    })

    it('returns invalid for -100', () => {
      const result = validatePrice(-100)
      expect(result.valid).toBe(false)
    })

    it('returns invalid for 1.5 (non-integer)', () => {
      const result = validatePrice(1.5)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateQuantity', () => {
    it('returns valid for 1', () => {
      expect(validateQuantity(1).valid).toBe(true)
    })

    it('returns valid for 10', () => {
      expect(validateQuantity(10).valid).toBe(true)
    })

    it('returns invalid for 0', () => {
      expect(validateQuantity(0).valid).toBe(false)
    })

    it('returns invalid for -1', () => {
      expect(validateQuantity(-1).valid).toBe(false)
    })

    it('returns invalid for 1.5 (non-integer)', () => {
      expect(validateQuantity(1.5).valid).toBe(false)
    })
  })

  describe('validatePIN', () => {
    it('returns valid for "1234"', () => {
      expect(validatePIN('1234').valid).toBe(true)
    })

    it('returns valid for "123456"', () => {
      expect(validatePIN('123456').valid).toBe(true)
    })

    it('returns invalid for "123" (too short)', () => {
      const result = validatePIN('123')
      expect(result.valid).toBe(false)
    })

    it('returns invalid for "1234567" (too long)', () => {
      const result = validatePIN('1234567')
      expect(result.valid).toBe(false)
    })

    it('returns invalid for "abcd" (non-numeric)', () => {
      const result = validatePIN('abcd')
      expect(result.valid).toBe(false)
    })
  })

  describe('validateSKU', () => {
    it('returns valid for "NASGOR-01"', () => {
      expect(validateSKU('NASGOR-01').valid).toBe(true)
    })

    it('returns valid for alphanumeric string', () => {
      expect(validateSKU('ABC123').valid).toBe(true)
    })

    it('returns invalid for empty string', () => {
      expect(validateSKU('').valid).toBe(false)
    })

    it('returns invalid for string longer than 50 chars', () => {
      expect(validateSKU('A'.repeat(51)).valid).toBe(false)
    })
  })
})
