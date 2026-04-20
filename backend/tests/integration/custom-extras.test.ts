import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { customExtraService } from '../../src/services/custom-extra.service';
import { generateAccessToken } from '../../src/lib/jwt';

vi.mock('../../src/services/custom-extra.service', () => ({
  customExtraService: {
    getActiveExtras: vi.fn(),
    getAllExtras: vi.fn(),
    createExtra: vi.fn(),
    updateExtra: vi.fn(),
    deactivateExtra: vi.fn(),
    deleteExtra: vi.fn(),
  },
}));

const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });
const waiterToken = generateAccessToken({ userId: 2, username: 'waiter', role: 'WAITER' });

const mockExtra = {
  id: 1,
  name: 'Aguacate',
  defaultPrice: 10,
  active: true,
  createdBy: 1,
  createdAt: new Date().toISOString(),
  updatedAt: null,
};

// ─── GET /extras ──────────────────────────────────────────────────────────────

describe('GET /api/extras', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with extras list for admin', async () => {
    vi.mocked(customExtraService.getAllExtras).mockResolvedValue([mockExtra] as any);

    const res = await request(app)
      .get('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]).toMatchObject({ id: 1, name: 'Aguacate' });
  });

  it('returns 200 for waiter (not admin-only)', async () => {
    vi.mocked(customExtraService.getAllExtras).mockResolvedValue([mockExtra] as any);

    const res = await request(app)
      .get('/api/extras')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/extras');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(customExtraService.getAllExtras).not.toHaveBeenCalled();
  });
});

// ─── POST /extras ─────────────────────────────────────────────────────────────

describe('POST /api/extras', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when defaultPrice is missing', async () => {
    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Aguacate' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.createExtra).not.toHaveBeenCalled();
  });

  it('creates extra with name and price', async () => {
    const extraWithPrice = { ...mockExtra, defaultPrice: 15.5 };
    vi.mocked(customExtraService.createExtra).mockResolvedValue(extraWithPrice as any);

    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Aguacate', defaultPrice: 15.5 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(customExtraService.createExtra).toHaveBeenCalledWith(
      { name: 'Aguacate', defaultPrice: 15.5 },
      1,
    );
  });

  it('allows waiter to create (not admin-only)', async () => {
    vi.mocked(customExtraService.createExtra).mockResolvedValue(mockExtra as any);

    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'Aguacate', defaultPrice: 10 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(customExtraService.createExtra).toHaveBeenCalledWith({ name: 'Aguacate', defaultPrice: 10 }, 2);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ defaultPrice: 10 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.createExtra).not.toHaveBeenCalled();
  });

  it('returns 400 when name is empty string', async () => {
    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.createExtra).not.toHaveBeenCalled();
  });

  it('returns 400 when defaultPrice is zero', async () => {
    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Aguacate', defaultPrice: 0 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.createExtra).not.toHaveBeenCalled();
  });

  it('returns 400 when defaultPrice is negative', async () => {
    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Aguacate', defaultPrice: -5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.createExtra).not.toHaveBeenCalled();
  });

  it('returns 409 when service throws P2002 (duplicate name)', async () => {
    vi.mocked(customExtraService.createExtra).mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    const res = await request(app)
      .post('/api/extras')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Aguacate', defaultPrice: 10 });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('An extra with that name already exists');
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/extras')
      .send({ name: 'Aguacate' });

    expect(res.status).toBe(401);
    expect(customExtraService.createExtra).not.toHaveBeenCalled();
  });
});

// ─── PUT /extras/:id ──────────────────────────────────────────────────────────

describe('PUT /api/extras/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('updates extra and calls service with parsed integer id', async () => {
    const updatedExtra = { ...mockExtra, name: 'Queso' };
    vi.mocked(customExtraService.updateExtra).mockResolvedValue(updatedExtra as any);

    const res = await request(app)
      .put('/api/extras/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Queso' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: 'Queso' });
    expect(res.body.message).toBe('Extra updated successfully');
    expect(customExtraService.updateExtra).toHaveBeenCalledWith(1, { name: 'Queso' });
  });

  it('rejects null defaultPrice', async () => {
    const res = await request(app)
      .put('/api/extras/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ defaultPrice: null });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.updateExtra).not.toHaveBeenCalled();
  });

  it('returns 404 when service throws P2025 (not found)', async () => {
    vi.mocked(customExtraService.updateExtra).mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const res = await request(app)
      .put('/api/extras/99')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Extra not found');
  });

  it('returns 409 when service throws P2002 (duplicate name)', async () => {
    vi.mocked(customExtraService.updateExtra).mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    const res = await request(app)
      .put('/api/extras/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Aguacate' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('An extra with that name already exists');
  });

  it('returns 400 when id is not a valid integer', async () => {
    const res = await request(app)
      .put('/api/extras/abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Queso' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.updateExtra).not.toHaveBeenCalled();
  });

  it('allows waiter to update (not admin-only)', async () => {
    vi.mocked(customExtraService.updateExtra).mockResolvedValue(mockExtra as any);

    const res = await request(app)
      .put('/api/extras/1')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'Aguacate' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── DELETE /extras/:id ───────────────────────────────────────────────────────

describe('DELETE /api/extras/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('soft deletes by calling deactivateExtra (not deleteExtra)', async () => {
    vi.mocked(customExtraService.deactivateExtra).mockResolvedValue(undefined as any);

    const res = await request(app)
      .delete('/api/extras/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Extra deactivated successfully');
    expect(customExtraService.deactivateExtra).toHaveBeenCalledWith(1);
    expect(customExtraService.deleteExtra).not.toHaveBeenCalled();
  });

  it('hard deletes with ?permanent=true by calling deleteExtra (not deactivateExtra)', async () => {
    vi.mocked(customExtraService.deleteExtra).mockResolvedValue(undefined as any);

    const res = await request(app)
      .delete('/api/extras/1?permanent=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Extra permanently deleted');
    expect(customExtraService.deleteExtra).toHaveBeenCalledWith(1);
    expect(customExtraService.deactivateExtra).not.toHaveBeenCalled();
  });

  it('returns 404 when service throws P2025 (not found)', async () => {
    vi.mocked(customExtraService.deactivateExtra).mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const res = await request(app)
      .delete('/api/extras/99')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Extra not found');
  });

  it('returns 400 when id is not a valid integer', async () => {
    const res = await request(app)
      .delete('/api/extras/abc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(customExtraService.deactivateExtra).not.toHaveBeenCalled();
    expect(customExtraService.deleteExtra).not.toHaveBeenCalled();
  });

  it('allows waiter to delete (not admin-only)', async () => {
    vi.mocked(customExtraService.deactivateExtra).mockResolvedValue(undefined as any);

    const res = await request(app)
      .delete('/api/extras/1')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/extras/1');

    expect(res.status).toBe(401);
    expect(customExtraService.deactivateExtra).not.toHaveBeenCalled();
    expect(customExtraService.deleteExtra).not.toHaveBeenCalled();
  });
});
