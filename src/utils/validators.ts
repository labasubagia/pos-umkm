/**
 * Input Validators
 *
 * Pure functions returning { valid, error? }. Intentionally not tied to any
 * form library so they can be used in both UI form validation and service-layer
 * data validation without coupling.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Validates a standard email address. */
export function validateEmail(email: string): ValidationResult {
  // RFC 5322 simplified pattern — covers the vast majority of real-world emails
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return ok ? { valid: true } : { valid: false, error: "Email tidak valid" };
}

/**
 * Validates an Indonesian phone number.
 * Accepts: 08xx... (local) or +628xx... (E.164).
 * Minimum 10 digits, maximum 15 digits after removing leading + or 0.
 */
export function validatePhone(phone: string): ValidationResult {
  const ok = /^(\+62|62|0)[0-9]{8,14}$/.test(phone);
  return ok
    ? { valid: true }
    : {
        valid: false,
        error: "Nomor telepon tidak valid (format: 08xx atau +628xx)",
      };
}

/** Validates a price: must be a positive integer (IDR has no decimals). */
export function validatePrice(value: number): ValidationResult {
  if (!Number.isInteger(value))
    return { valid: false, error: "Harga harus bilangan bulat" };
  if (value <= 0) return { valid: false, error: "Harga harus lebih dari 0" };
  return { valid: true };
}

/** Validates a quantity: must be an integer ≥ 1. */
export function validateQuantity(value: number): ValidationResult {
  if (!Number.isInteger(value))
    return { valid: false, error: "Jumlah harus bilangan bulat" };
  if (value < 1) return { valid: false, error: "Jumlah harus ≥ 1" };
  return { valid: true };
}

/** Validates a PIN: 4–6 numeric digits. */
export function validatePIN(pin: string): ValidationResult {
  if (!/^\d{4,6}$/.test(pin)) {
    return { valid: false, error: "PIN harus 4–6 digit angka" };
  }
  return { valid: true };
}

/** Validates a SKU: alphanumeric, max 50 chars. */
export function validateSKU(sku: string): ValidationResult {
  if (!/^[a-zA-Z0-9-_]{1,50}$/.test(sku)) {
    return { valid: false, error: "SKU harus alfanumerik, maks 50 karakter" };
  }
  return { valid: true };
}
