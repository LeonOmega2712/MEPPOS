import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { LoginSchema } from '../types/auth.types';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = LoginSchema.parse(req.body);

      const result = await authService.login(username, password);

      if (!result) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      console.error('Error during login:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        res.status(401).json({ success: false, error: 'Refresh token required' });
        return;
      }

      const result = await authService.refresh(refreshToken);

      if (!result) {
        res.clearCookie('refresh_token', { path: '/api/auth' });
        res.status(401).json({ success: false, error: 'Invalid refresh token' });
        return;
      }

      res.cookie('refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch {
      res.clearCookie('refresh_token', { path: '/api/auth' });
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
  }

  async logout(_req: Request, res: Response) {
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.json({ success: true, message: 'Logged out successfully' });
  }

  async me(req: Request, res: Response) {
    res.json({ success: true, data: req.user });
  }
}

export const authController = new AuthController();
