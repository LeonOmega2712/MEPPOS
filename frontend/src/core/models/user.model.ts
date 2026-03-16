export type Role = 'ADMIN' | 'WAITER';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  WAITER: 'Mesero',
};

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  displayName: string;
  role?: Role;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  displayName?: string;
  role?: Role;
  active?: boolean;
}

export interface UserDraft {
  username: string;
  displayName: string;
  role: Role;
  password: string;
}
