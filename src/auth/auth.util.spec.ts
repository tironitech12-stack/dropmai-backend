import {
  decodeSession,
  encodeSession,
  hashPassword,
  verifyPassword,
} from './auth.util';

describe('auth.util session', () => {
  it('round-trips a signed session with real user id', () => {
    process.env.SESSION_SECRET = 'test-secret';
    const token = encodeSession({
      id: 'cluser123',
      email: 'paulo@dropmai.com.br',
      name: 'Paulo',
    });
    expect(token.startsWith('dm1.')).toBe(true);
    expect(decodeSession(token)).toEqual({
      id: 'cluser123',
      email: 'paulo@dropmai.com.br',
      name: 'Paulo',
    });
  });

  it('rejects tampered sessions', () => {
    process.env.SESSION_SECRET = 'test-secret';
    const token = encodeSession({
      id: 'cluser123',
      email: 'paulo@dropmai.com.br',
      name: 'Paulo',
    });
    expect(decodeSession(token.slice(0, -2) + 'xx')).toBeNull();
  });
});

describe('auth.util password', () => {
  it('hashes and verifies', () => {
    const hash = hashPassword('secret123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('secret123', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
  });
});
