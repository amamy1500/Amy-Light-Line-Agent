/**
 * Normalises a US phone number typed or spoken in any common format to E.164.
 * Returns null for anything that is not a plausible 10-digit NANP number.
 */
export function normalizeUsPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  // NANP: area code and exchange cannot start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return null;
  return `+1${national}`;
}

/** "+15125550147" → "(512) 555-0147". Non-US or malformed input is returned unchanged. */
export function formatUsPhone(e164: string | null | undefined): string {
  if (!e164) return "unknown number";
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}
