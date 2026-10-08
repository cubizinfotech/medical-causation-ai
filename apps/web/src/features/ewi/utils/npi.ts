/** Public NPI Registry search, for attorneys looking up an expert's NPI. */
export const NPI_REGISTRY_SEARCH_URL = "https://npiregistry.cms.hhs.gov/search";

/**
 * NPI check digit: Luhn over the first nine digits with the 80840 prefix
 * (CMS NPI standard). Catches most typos before the investigation starts.
 */
export function isValidNpi(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const digits = `80840${value.slice(0, 9)}`.split("").map(Number);
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = digits[index];
    if ((digits.length - index) % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}
