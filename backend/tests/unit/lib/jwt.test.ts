import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TokenPayload,
} from '../../../src/lib/jwt';

const samplePayload: TokenPayload = {
  userId: 1,
  username: 'admin',
  role: 'ADMIN',
};

describe('generateAccessToken', () => {
  it('returns a JWT string with three dot-separated parts', () => {
    const token = generateAccessToken(samplePayload);
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('generateRefreshToken', () => {
  it('returns a JWT string different from the access token', () => {
    const access = generateAccessToken(samplePayload);
    const refresh = generateRefreshToken(samplePayload);
    // Different secrets produce different signatures
    expect(refresh).not.toBe(access);
  });
});

describe('verifyAccessToken', () => {
  it('decodes the original payload fields', () => {
    const token = generateAccessToken(samplePayload);
    const decoded = verifyAccessToken(token);

    expect(decoded.userId).toBe(1);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('ADMIN');
  });

  it('includes iat and exp claims added by jsonwebtoken', () => {
    const token = generateAccessToken(samplePayload);
    const decoded = verifyAccessToken(token);

    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
  });

  it('throws on a tampered token', () => {
    const token = generateAccessToken(samplePayload);
    // Flip the last character to simulate tampering
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('rejects a refresh token (different secret)', () => {
    const refreshToken = generateRefreshToken(samplePayload);

    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });
});

describe('verifyRefreshToken', () => {
  it('decodes the original payload fields', () => {
    const token = generateRefreshToken(samplePayload);
    const decoded = verifyRefreshToken(token);

    expect(decoded.userId).toBe(1);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('ADMIN');
  });

  it('rejects an access token (different secret)', () => {
    const accessToken = generateAccessToken(samplePayload);

    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  it('throws on a completely invalid string', () => {
    expect(() => verifyRefreshToken('not-a-jwt')).toThrow();
  });
});
