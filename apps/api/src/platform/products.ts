/**
 * Shared product identifiers for corpus scoping, permissions, and config.
 * Keep MCA and EWI domain logic out of this file.
 */
export const PRODUCTS = {
  MCA: 'mca',
  EWI: 'ewi',
} as const;

export type ProductId = (typeof PRODUCTS)[keyof typeof PRODUCTS];

export const PRODUCT_PERMISSION_PREFIX = {
  mca: 'mca:',
  ewi: 'ewi:',
} as const;
