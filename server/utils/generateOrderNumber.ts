import { nanoid } from 'nanoid';

/**
 * Generate a human-readable order number.
 * Format: IG-XXXXXX (6 uppercase alphanumeric chars)
 */
export function generateOrderNumber(): string {
  return `IG-${nanoid(6).toUpperCase()}`;
}

/**
 * Generate an invoice number.
 * Format: INV-XXXXXXXXXX (10 uppercase alphanumeric chars)
 */
export function generateInvoiceNumber(): string {
  return `INV-${nanoid(10).toUpperCase()}`;
}
