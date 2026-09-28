/**
 * Human-friendly booking references like "NCC-7K3QX".
 * No 0/O or 1/I so they are easy to read over the phone. Shared by the API server and the demo.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeReference(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(5);
  let out = '';
  for (let i = 0; i < 5; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `NCC-${out}`;
}

export const referencePattern = /^NCC-[A-HJ-NP-Z2-9]{5}$/;
