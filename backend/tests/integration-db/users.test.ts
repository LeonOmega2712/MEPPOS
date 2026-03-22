import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { generateAccessToken } from '../../src/lib/jwt';
import { resetDb, prisma } from './helpers/db';
import bcrypt from 'bcryptjs';

const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });
const waiterToken = generateAccessToken({ userId: 2, username: 'waiter', role: 'WAITER' });

const api = {
  get: (path: string, token = adminToken) =>
    request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object, token = adminToken) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object, token = adminToken) =>
    request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string, token = adminToken) =>
    request(app).delete(path).set('Authorization', `Bearer ${token}`),
};

const validUser = {
  username: 'mesero1',
  password: 'secret123',
  displayName: 'Mesero Uno',
  role: 'WAITER' as const,
};

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ----- CREATE -----

describe('POST /api/users', () => {
  it('creates a user and returns it without password', async () => {
    const res = await api.post('/api/users', validUser);

    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe('mesero1');
    expect(res.body.data.displayName).toBe('Mesero Uno');
    expect(res.body.data.role).toBe('WAITER');
    expect(res.body.data.active).toBe(true);
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('hashes the password before storing', async () => {
    await api.post('/api/users', validUser);

    const dbUser = await prisma.user.findUnique({ where: { username: 'mesero1' } });
    expect(dbUser!.password).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', dbUser!.password)).toBe(true);
  });

  it('returns 409 on duplicate username', async () => {
    await api.post('/api/users', validUser);
    const res = await api.post('/api/users', validUser);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Username already exists');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await api.post('/api/users', {});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  it('returns 400 when password is too short', async () => {
    const res = await api.post('/api/users', { ...validUser, password: '123' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when a WAITER tries to create', async () => {
    const res = await api.post('/api/users', validUser, waiterToken);

    expect(res.status).toBe(403);
  });

  it('defaults role to WAITER when not specified', async () => {
    const { role: _, ...userWithoutRole } = validUser;
    const res = await api.post('/api/users', userWithoutRole);

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('WAITER');
  });
});

// ----- READ -----

describe('GET /api/users', () => {
  beforeEach(async () => {
    await api.post('/api/users', validUser);
    await api.post('/api/users', {
      username: 'admin1',
      password: 'admin123',
      displayName: 'Admin One',
      role: 'ADMIN',
    });
  });

  it('returns all users ordered by id', async () => {
    const res = await api.get('/api/users');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0].username).toBe('mesero1');
    expect(res.body.data[1].username).toBe('admin1');
  });

  it('does not expose passwords', async () => {
    const res = await api.get('/api/users');

    res.body.data.forEach((u: any) => {
      expect(u).not.toHaveProperty('password');
    });
  });

  it('returns 403 when a WAITER tries to list users', async () => {
    const res = await api.get('/api/users', waiterToken);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/:id', () => {
  it('returns a user by ID', async () => {
    const created = await api.post('/api/users', validUser);
    const userId = created.body.data.id;

    const res = await api.get(`/api/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('mesero1');
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('returns 404 for non-existent user', async () => {
    const res = await api.get('/api/users/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('returns 400 for invalid ID format', async () => {
    const res = await api.get('/api/users/abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid user ID');
  });
});

// ----- UPDATE -----

describe('PUT /api/users/:id', () => {
  it('updates user fields', async () => {
    const created = await api.post('/api/users', validUser);
    const userId = created.body.data.id;

    const res = await api.put(`/api/users/${userId}`, {
      displayName: 'Nuevo Nombre',
      role: 'ADMIN',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Nuevo Nombre');
    expect(res.body.data.role).toBe('ADMIN');
  });

  it('hashes new password when updating', async () => {
    const created = await api.post('/api/users', validUser);
    const userId = created.body.data.id;

    await api.put(`/api/users/${userId}`, { password: 'newpass123' });

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(await bcrypt.compare('newpass123', dbUser!.password)).toBe(true);
  });

  it('returns 404 when user does not exist', async () => {
    const res = await api.put('/api/users/999', { displayName: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('returns 409 on duplicate username', async () => {
    await api.post('/api/users', validUser);
    const second = await api.post('/api/users', {
      ...validUser,
      username: 'mesero2',
      displayName: 'Mesero Dos',
    });

    const res = await api.put(`/api/users/${second.body.data.id}`, {
      username: 'mesero1',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Username already exists');
  });
});

// ----- SOFT DELETE (DEACTIVATE) -----

describe('DELETE /api/users/:id (soft)', () => {
  it('deactivates a user', async () => {
    const created = await api.post('/api/users', validUser);
    const userId = created.body.data.id;

    const res = await api.delete(`/api/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User deactivated');
    expect(res.body.data.active).toBe(false);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await api.delete('/api/users/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

// ----- HARD DELETE -----

describe('DELETE /api/users/:id?permanent=true', () => {
  it('permanently deletes the user', async () => {
    const created = await api.post('/api/users', validUser);
    const userId = created.body.data.id;

    const res = await api.delete(`/api/users/${userId}?permanent=true`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User permanently deleted');

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser).toBeNull();
  });

  it('returns 404 for non-existent user', async () => {
    const res = await api.delete('/api/users/999?permanent=true');

    expect(res.status).toBe(404);
  });
});
