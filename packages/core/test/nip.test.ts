import { describe, expect, it } from 'vitest';
import { isValidNip, normalizeNip } from '../src/nip';

describe('NIP', () => {
  it.each(['5260250274', '526-025-02-74', '526 025 02 74', 'PL5260250274', '1234563218'])(
    'accepts valid %s',
    (nip) => {
      expect(isValidNip(nip)).toBe(true);
    },
  );

  it.each(['5260250275', '123', '12345678901', 'abcdefghij', '', '0000000000x'])('rejects %j', (nip) => {
    expect(isValidNip(nip)).toBe(false);
  });

  it('rejects a checksum of 10 (no valid control digit)', () => {
    // weights · digits ≡ 10 (mod 11) for 123456789x – no digit can match.
    expect(isValidNip('1234567890')).toBe(false);
  });

  it('normalizes to 10 digits', () => {
    expect(normalizeNip(' PL 526-025-02-74 ')).toBe('5260250274');
  });
});
