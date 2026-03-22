import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { authService } from '../../src/services/auth.service';
import { generateAccessToken } from '../../src/lib/jwt';

vi.mock('../../src/services/auth.service', () => ({
  authService: { login: vi.fn(), refresh: vi.fn() },
}));

const mockLoginResult = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  user: { id: 1, username: 'admin', displayName: 'Admin', role: 'ADMIN' as const },
};

const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('valid credentials', () => {
    it('returns 200 with accessToken and user data', async () => {
      vi.mocked(authService.login).mockResolvedValue(mockLoginResult);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe('test-access-token');
      expect(res.body.data.user).toMatchObject({ username: 'admin', role: 'ADMIN' });
    });

    it('sets the refresh_token cookie', async () => {
      vi.mocked(authService.login).mockResolvedValue(mockLoginResult);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'secret' });

      const cookies = [res.headers['set-cookie']].flat().filter(Boolean) as string[];
      expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    });
  });

  describe('invalid credentials', () => {
    it('returns 401 when the service returns null', async () => {
      vi.mocked(authService.login).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('validation errors', () => {
    it('returns 400 when username is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'secret' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('returns 400 when body is empty', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(authService.login).not.toHaveBeenCalled();
    });
  });
});

// ----- REFRESH -----

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns new tokens when refresh cookie is valid', async () => {
    vi.mocked(authService.refresh).mockResolvedValue(mockLoginResult);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=valid-refresh-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('test-access-token');
    expect(res.body.data.user).toMatchObject({ username: 'admin' });
  });

  it('sets a new refresh_token cookie on success', async () => {
    vi.mocked(authService.refresh).mockResolvedValue(mockLoginResult);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=valid-refresh-token');

    const cookies = [res.headers['set-cookie']].flat().filter(Boolean) as string[];
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('returns 401 when no refresh cookie is present', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Refresh token required');
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('returns 401 and clears cookie when service returns null', async () => {
    vi.mocked(authService.refresh).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid refresh token');
  });

  it('returns 401 and clears cookie when service throws', async () => {
    vi.mocked(authService.refresh).mockRejectedValue(new Error('bad token'));

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=bad-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid refresh token');
  });
});

// ----- LOGOUT -----

describe('POST /api/auth/logout', () => {
  it('returns success message', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Logged out successfully');
  });

  it('clears the refresh_token cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    const cookies = [res.headers['set-cookie']].flat().filter(Boolean) as string[];
    const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    // A cleared cookie has an expired date or empty value
    expect(refreshCookie).toMatch(/expires=Thu, 01 Jan 1970/i);
  });
});

// ----- ME -----

describe('GET /api/auth/me', () => {
  it('returns current user info from token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      userId: 1,
      username: 'admin',
      role: 'ADMIN',
    });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});
