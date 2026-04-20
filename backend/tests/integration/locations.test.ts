import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { locationService } from '../../src/services/location.service';
import { generateAccessToken } from '../../src/lib/jwt';

vi.mock('../../src/services/location.service', () => ({
  locationService: {
    getAllLocations: vi.fn(),
    getActiveLocations: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    deactivateLocation: vi.fn(),
    deleteLocation: vi.fn(),
    reorderLocations: vi.fn(),
  },
}));

const adminToken = generateAccessToken({ userId: 1, username: 'admin', role: 'ADMIN' });
const waiterToken = generateAccessToken({ userId: 2, username: 'waiter', role: 'WAITER' });

const mockLocation = {
  id: 1,
  name: 'Mesa 1',
  type: 'table',
  active: true,
  displayOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: null,
};

// ─── GET /locations ───────────────────────────────────────────────────────────

describe('GET /api/locations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with all locations for admin', async () => {
    vi.mocked(locationService.getAllLocations).mockResolvedValue([mockLocation] as any);

    const res = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]).toMatchObject({ id: 1, name: 'Mesa 1', type: 'table' });
    expect(locationService.getAllLocations).toHaveBeenCalled();
    expect(locationService.getActiveLocations).not.toHaveBeenCalled();
  });

  it('allows waiter to read (not admin-only)', async () => {
    vi.mocked(locationService.getAllLocations).mockResolvedValue([mockLocation] as any);

    const res = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/locations');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(locationService.getAllLocations).not.toHaveBeenCalled();
  });

  it('calls getActiveLocations when ?active=true', async () => {
    vi.mocked(locationService.getActiveLocations).mockResolvedValue([mockLocation] as any);

    const res = await request(app)
      .get('/api/locations?active=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(locationService.getActiveLocations).toHaveBeenCalled();
    expect(locationService.getAllLocations).not.toHaveBeenCalled();
  });
});

// ─── POST /locations ──────────────────────────────────────────────────────────

describe('POST /api/locations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 403 for waiter (admin-only route)', async () => {
    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'Mesa 1', type: 'table' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(locationService.createLocation).not.toHaveBeenCalled();
  });

  it('creates a table location', async () => {
    vi.mocked(locationService.createLocation).mockResolvedValue(mockLocation as any);

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mesa 1', type: 'table' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: 'Mesa 1', type: 'table' });
    expect(res.body.message).toBe('Location created successfully');
    expect(locationService.createLocation).toHaveBeenCalledWith({ name: 'Mesa 1', type: 'table' });
  });

  it('creates a bar location', async () => {
    const barLocation = { ...mockLocation, id: 2, name: 'Barra 1', type: 'bar' };
    vi.mocked(locationService.createLocation).mockResolvedValue(barLocation as any);

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Barra 1', type: 'bar' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: 'Barra 1', type: 'bar' });
  });

  it('returns 400 on invalid type', async () => {
    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Booth 1', type: 'booth' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(locationService.createLocation).not.toHaveBeenCalled();
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'table' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(locationService.createLocation).not.toHaveBeenCalled();
  });

  it('returns 404 when service throws P2025', async () => {
    vi.mocked(locationService.createLocation).mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mesa 1', type: 'table' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/locations')
      .send({ name: 'Mesa 1', type: 'table' });

    expect(res.status).toBe(401);
    expect(locationService.createLocation).not.toHaveBeenCalled();
  });
});

// ─── PUT /locations/:id ───────────────────────────────────────────────────────

describe('PUT /api/locations/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('admin can update a location', async () => {
    const updatedLocation = { ...mockLocation, name: 'Mesa 2' };
    vi.mocked(locationService.updateLocation).mockResolvedValue(updatedLocation as any);

    const res = await request(app)
      .put('/api/locations/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mesa 2' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: 'Mesa 2' });
    expect(res.body.message).toBe('Location updated successfully');
    expect(locationService.updateLocation).toHaveBeenCalledWith(1, { name: 'Mesa 2' });
  });

  it('returns 403 for waiter (admin-only route)', async () => {
    const res = await request(app)
      .put('/api/locations/1')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ name: 'Mesa 2' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(locationService.updateLocation).not.toHaveBeenCalled();
  });

  it('returns 404 when service throws P2025 (not found)', async () => {
    vi.mocked(locationService.updateLocation).mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const res = await request(app)
      .put('/api/locations/99')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Location not found');
  });

  it('returns 400 when id is not a valid integer', async () => {
    const res = await request(app)
      .put('/api/locations/abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mesa 2' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(locationService.updateLocation).not.toHaveBeenCalled();
  });
});

// ─── DELETE /locations/:id ────────────────────────────────────────────────────

describe('DELETE /api/locations/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('soft deletes by calling deactivateLocation (not deleteLocation)', async () => {
    vi.mocked(locationService.deactivateLocation).mockResolvedValue(undefined as any);

    const res = await request(app)
      .delete('/api/locations/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Location deactivated successfully');
    expect(locationService.deactivateLocation).toHaveBeenCalledWith(1);
    expect(locationService.deleteLocation).not.toHaveBeenCalled();
  });

  it('hard deletes with ?permanent=true by calling deleteLocation (not deactivateLocation)', async () => {
    vi.mocked(locationService.deleteLocation).mockResolvedValue(undefined as any);

    const res = await request(app)
      .delete('/api/locations/1?permanent=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Location permanently deleted');
    expect(locationService.deleteLocation).toHaveBeenCalledWith(1);
    expect(locationService.deactivateLocation).not.toHaveBeenCalled();
  });

  it('returns 403 for waiter (admin-only route)', async () => {
    const res = await request(app)
      .delete('/api/locations/1')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(locationService.deactivateLocation).not.toHaveBeenCalled();
    expect(locationService.deleteLocation).not.toHaveBeenCalled();
  });

  it('returns 404 when service throws P2025 (not found)', async () => {
    vi.mocked(locationService.deactivateLocation).mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const res = await request(app)
      .delete('/api/locations/99')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Location not found');
  });
});

// ─── PATCH /locations/reorder ─────────────────────────────────────────────────

describe('PATCH /api/locations/reorder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reorders locations and calls service with locationIds array', async () => {
    vi.mocked(locationService.reorderLocations).mockResolvedValue(3);

    const res = await request(app)
      .patch('/api/locations/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ locationIds: [3, 1, 2] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Locations reordered successfully');
    expect(res.body.data).toMatchObject({ updated: 3 });
    expect(locationService.reorderLocations).toHaveBeenCalledWith([3, 1, 2]);
  });

  it('returns 400 when service throws Invalid location IDs error', async () => {
    vi.mocked(locationService.reorderLocations).mockRejectedValue(
      new Error('Invalid location IDs: 99'),
    );

    const res = await request(app)
      .patch('/api/locations/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ locationIds: [1, 99] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid location IDs');
  });

  it('returns 403 for waiter (admin-only route)', async () => {
    const res = await request(app)
      .patch('/api/locations/reorder')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ locationIds: [1, 2] });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(locationService.reorderLocations).not.toHaveBeenCalled();
  });

  it('returns 400 when locationIds is missing', async () => {
    const res = await request(app)
      .patch('/api/locations/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(locationService.reorderLocations).not.toHaveBeenCalled();
  });

  it('returns 400 when locationIds is empty array', async () => {
    const res = await request(app)
      .patch('/api/locations/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ locationIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(locationService.reorderLocations).not.toHaveBeenCalled();
  });
});
