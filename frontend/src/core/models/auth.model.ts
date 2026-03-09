export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'WAITER';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
