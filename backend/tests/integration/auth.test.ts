import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { authService } from '../../src/services/auth.service';

vi.mock('../../src/services/auth.service', () => ({
  authService: { login: vi.fn() },
}));

const mockLoginResult = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  user: { id: 1, username: 'admin', displayName: 'Admin', role: 'ADMIN' },
};

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

      const cookies: string[] = res.headers['set-cookie'] ?? [];
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
