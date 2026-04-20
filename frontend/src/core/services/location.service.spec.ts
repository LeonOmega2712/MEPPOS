import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocationService } from './location.service';
import type { Location } from '../models';

const LOCATIONS_URL = 'http://localhost:3000/api/locations';

const LOCATION_STUB: Location = {
  id: 1,
  name: 'Mesa 1',
  type: 'table',
  active: true,
  displayOrder: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: null,
};

const LOCATION_STUB_2: Location = {
  id: 2,
  name: 'Mesa 2',
  type: 'table',
  active: true,
  displayOrder: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: null,
};

function flush<T>(http: HttpTestingController, url: string, data: T): void {
  http.expectOne(url).flush({ success: true, data });
}

describe('LocationService', () => {
  let service: LocationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LocationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ─── Signal exposure ──────────────────────────────────────────────────────

  describe('signal exposure', () => {
    it('exposes locations and its loading/error signals', () => {
      expect(service.locations).toBeDefined();
      expect(service.locationsLoading).toBeDefined();
      expect(service.locationsRevalidating).toBeDefined();
      expect(service.locationsError).toBeDefined();
    });

    it('locations is null before any fetch', () => {
      expect(service.locations()).toBeNull();
    });
  });

  // ─── ensureLocations ──────────────────────────────────────────────────────

  describe('ensureLocations()', () => {
    it('triggers GET to the locations URL', () => {
      service.ensureLocations();

      const req = http.expectOne(LOCATIONS_URL);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [LOCATION_STUB] });
    });

    it('maps the ApiResponse envelope and populates the locations signal', () => {
      service.ensureLocations();
      flush(http, LOCATIONS_URL, [LOCATION_STUB]);

      expect(service.locations()).toEqual([LOCATION_STUB]);
    });
  });

  // ─── setLocationsData ─────────────────────────────────────────────────────

  describe('setLocationsData()', () => {
    it('updates the locations signal immediately without making an HTTP request', () => {
      service.setLocationsData([LOCATION_STUB, LOCATION_STUB_2]);

      expect(service.locations()).toEqual([LOCATION_STUB, LOCATION_STUB_2]);
      http.expectNone(LOCATIONS_URL);
    });

    it('replaces existing locations data in-place', () => {
      service.ensureLocations();
      flush(http, LOCATIONS_URL, [LOCATION_STUB]);

      service.setLocationsData([LOCATION_STUB_2]);

      expect(service.locations()).toEqual([LOCATION_STUB_2]);
    });
  });

  // ─── createLocation ───────────────────────────────────────────────────────

  describe('createLocation()', () => {
    it('sends POST to locations URL with name and type', () => {
      service.createLocation({ name: 'Mesa 1', type: 'table' }).subscribe();

      const req = http.expectOne(LOCATIONS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Mesa 1', type: 'table' });
      req.flush({ success: true, data: LOCATION_STUB });
    });

    it('can create bar type', () => {
      service.createLocation({ name: 'Barra', type: 'bar' }).subscribe();

      const req = http.expectOne(LOCATIONS_URL);
      expect(req.request.body).toEqual({ name: 'Barra', type: 'bar' });
      req.flush({ success: true, data: { ...LOCATION_STUB, name: 'Barra', type: 'bar' } });
    });

    it('returns the mapped Location from the ApiResponse envelope', () => {
      let result: Location | undefined;
      service.createLocation({ name: 'Mesa 1', type: 'table' }).subscribe((v) => (result = v));

      flush(http, LOCATIONS_URL, LOCATION_STUB);

      expect(result).toEqual(LOCATION_STUB);
    });
  });

  // ─── updateLocation ───────────────────────────────────────────────────────

  describe('updateLocation()', () => {
    it('sends PUT to the correct URL with the payload', () => {
      service.updateLocation(2, { name: 'Barra' }).subscribe();

      const req = http.expectOne(`${LOCATIONS_URL}/2`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Barra' });
      req.flush({ success: true, data: { ...LOCATION_STUB, id: 2, name: 'Barra' } });
    });

    it('can update the active flag', () => {
      service.updateLocation(1, { active: true }).subscribe();

      const req = http.expectOne(`${LOCATIONS_URL}/1`);
      expect(req.request.body).toEqual({ active: true });
      req.flush({ success: true, data: LOCATION_STUB });
    });
  });

  // ─── deleteLocation ───────────────────────────────────────────────────────

  describe('deleteLocation()', () => {
    it('sends DELETE without query param for soft delete (default)', () => {
      service.deleteLocation(3).subscribe();

      const req = http.expectOne(`${LOCATIONS_URL}/3`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.urlWithParams).not.toContain('permanent');
      req.flush({ success: true, data: null });
    });

    it('sends DELETE with ?permanent=true when flag is true', () => {
      service.deleteLocation(3, true).subscribe();

      const req = http.expectOne(`${LOCATIONS_URL}/3?permanent=true`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: null });
    });

    it('returns undefined (void) on success', () => {
      let result: unknown = 'not-set';
      service.deleteLocation(3).subscribe((v) => (result = v));

      flush(http, `${LOCATIONS_URL}/3`, null);

      expect(result).toBeUndefined();
    });
  });

  // ─── reorderLocations ─────────────────────────────────────────────────────

  describe('reorderLocations()', () => {
    it('sends PATCH to /locations/reorder with locationIds in body', () => {
      service.reorderLocations([2, 1, 3]).subscribe();

      const req = http.expectOne(`${LOCATIONS_URL}/reorder`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ locationIds: [2, 1, 3] });
      req.flush({ success: true, data: { updated: 3 } });
    });

    it('preserves the exact order of IDs in the request body', () => {
      service.reorderLocations([5, 3, 1, 2, 4]).subscribe();

      const req = http.expectOne(`${LOCATIONS_URL}/reorder`);
      expect(req.request.body.locationIds).toEqual([5, 3, 1, 2, 4]);
      req.flush({ success: true, data: { updated: 5 } });
    });
  });
});
