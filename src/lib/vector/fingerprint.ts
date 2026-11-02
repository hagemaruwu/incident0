import crypto from 'crypto';

/**
 * Normalizes stack traces and error messages by stripping dynamic elements:
 * - Hexadecimal memory addresses (e.g. 0x7fff5fbff820)
 * - Dynamic line numbers (e.g. :42 or line 102)
 * - Microsecond timestamps and UUIDs
 */
export function normalizeStackTrace(rawText: string): string {
  return rawText
    .toLowerCase()
    .replace(/0x[0-9a-fA-F]+/g, '0xHEX') // Replace memory addresses with static token
    .replace(/:[0-9]+/g, ':LINE')        // Replace specific line numbers
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID') // Replace UUIDs
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .trim();
}

/**
 * Generates a deterministic 64-character MD5 fingerprint of the normalized error
 */
export function generateErrorFingerprint(serviceId: number, rawText: string): string {
  const normalized = normalizeStackTrace(rawText);
  return crypto
    .createHash('md5')
    .update(`${serviceId}:${normalized}`)
    .digest('hex');
}