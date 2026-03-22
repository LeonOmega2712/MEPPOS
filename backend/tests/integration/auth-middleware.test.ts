import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { generateAccessToken, generateRefreshToken } from '../../src/lib/jwt';

// Mock prisma so controller calls don't hit a real DB.
// We only care about the middleware behavior here, not the data layer.
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const adminPayload = { userId: 1, username: 'admin', role: 'ADMIN' as const };
const waiterPayload = { userId: 2, username: 'waiter', role: 'WAITER' as const };

describe('authenticate middleware', () => {
  // Target: GET /api/auth/me — requires authentication but any role

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Access token required');
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Token some-value');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Access token required');
  });

  it('returns 401 when the token is invalid', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired access token');
  });

  it('returns 401 when a refresh token is used instead of an access token', async () => {
    const refreshToken = generateRefreshToken(adminPayload);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 when the token is expired', async () => {
    // Sign a token that already expired (exp in the past)
    const secret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
    const expiredToken = jwt.sign(adminPayload, secret, { expiresIn: '-1s' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired access token');
  });

  it('passes through with a valid access token', async () => {
    const token = generateAccessToken(adminPayload);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // /auth/me returns the user from the token — status 200 means authenticate passed
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('admin');
  });
});

describe('authorize middleware', () => {
  // Target: GET /api/users — requires ADMIN role

  it('returns 403 when a WAITER tries to access an admin-only route', async () => {
    const token = generateAccessToken(waiterPayload);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('passes through when an ADMIN accesses an admin-only route', async () => {
    const token = generateAccessToken(adminPayload);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    // 200 means both authenticate and authorize passed
    expect(res.status).toBe(200);
  });
});
