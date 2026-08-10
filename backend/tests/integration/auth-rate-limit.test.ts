import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { authService } from '../../src/services/auth.service';
import { loginRateLimiter } from '../../src/middleware/rate-limit';

// Separate file so it gets its own module registry (vitest isolates per test
// file by default) — the login rate limiter's in-memory counter must start
// empty here and stay unaffected by auth.test.ts's requests.
vi.mock('../../src/services/auth.service', () => ({
  authService: { login: vi.fn(), refresh: vi.fn() },
}));

// Every request in these tests comes from the loopback address, which the
// limiter's default IPv4-mapped-IPv6 normalization resolves to '127.0.0.1'.
// Reset it between tests so they don't bleed into each other.
beforeEach(() => {
  loginRateLimiter.resetKey('127.0.0.1');
});

const mockLoginResult = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  user: { id: 1, username: 'admin', displayName: 'Admin', role: 'ADMIN' as const },
};

describe('POST /api/auth/login — rate limiting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('blocks with 429 + retryAfterSeconds after 10 failed attempts', async () => {
    vi.mocked(authService.login).mockResolvedValue(null);

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(typeof blocked.body.retryAfterSeconds).toBe('number');
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.body.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it('does not count successful logins toward the limit', async () => {
    vi.mocked(authService.login).mockResolvedValue(mockLoginResult);

    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'secret' });
      expect(res.status).toBe(200);
    }
  });
});
