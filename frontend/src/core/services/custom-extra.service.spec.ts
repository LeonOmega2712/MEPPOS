import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CustomExtraService } from './custom-extra.service';
import type { CustomExtra } from '../models';

const BASE_URL = 'http://localhost:3000/api/extras';

const EXTRA_STUB: CustomExtra = {
  id: 1,
  name: 'Sal',
  defaultPrice: 10,
  active: true,
  createdBy: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: null,
};

function flush<T>(http: HttpTestingController, url: string, data: T): void {
  http.expectOne(url).flush({ success: true, data });
}

describe('CustomExtraService', () => {
  let service: CustomExtraService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CustomExtraService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('signal exposure', () => {
    it('extras, extrasLoading, extrasRevalidating, and extrasError signals are accessible', () => {
      expect(service.extras).toBeDefined();
      expect(service.extrasLoading).toBeDefined();
      expect(service.extrasRevalidating).toBeDefined();
      expect(service.extrasError).toBeDefined();
    });

    it('extras is null and extrasLoading is false before any fetch', () => {
      expect(service.extras()).toBeNull();
      expect(service.extrasLoading()).toBe(false);
    });
  });

  describe('ensureExtras()', () => {
    it('triggers GET to the extras URL', () => {
      service.ensureExtras();

      const req = http.expectOne(BASE_URL);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [EXTRA_STUB] });
    });

    it('maps the ApiResponse envelope and populates the extras signal', () => {
      service.ensureExtras();
      flush(http, BASE_URL, [EXTRA_STUB]);

      expect(service.extras()).toEqual([EXTRA_STUB]);
    });

    it('sets extrasLoading to true while the request is in-flight', () => {
      service.ensureExtras();

      expect(service.extrasLoading()).toBe(true);

      flush(http, BASE_URL, [EXTRA_STUB]);
      expect(service.extrasLoading()).toBe(false);
    });
  });

  describe('refreshExtras()', () => {
    it('always triggers GET to the extras URL even when called on a warm cache', () => {
      service.ensureExtras();
      flush(http, BASE_URL, [EXTRA_STUB]);

      service.refreshExtras();

      const req = http.expectOne(BASE_URL);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [EXTRA_STUB] });
    });

    it('updates the extras signal with fresh data after refresh', () => {
      service.ensureExtras();
      flush(http, BASE_URL, [EXTRA_STUB]);

      const updated: CustomExtra = { ...EXTRA_STUB, name: 'Sal actualizada' };
      service.refreshExtras();
      flush(http, BASE_URL, [updated]);

      expect(service.extras()).toEqual([updated]);
    });
  });

  describe('createExtra()', () => {
    it('sends a POST to the extras URL with the given name', () => {
      service.createExtra({ name: 'Sal', defaultPrice: 10 }).subscribe();

      const req = http.expectOne(BASE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Sal', defaultPrice: 10 });
      req.flush({ success: true, data: EXTRA_STUB });
    });

    it('includes defaultPrice in the request body when provided', () => {
      service.createExtra({ name: 'Sal', defaultPrice: 5 }).subscribe();

      const req = http.expectOne(BASE_URL);
      expect(req.request.body).toEqual({ name: 'Sal', defaultPrice: 5 });
      req.flush({ success: true, data: { ...EXTRA_STUB, defaultPrice: 5 } });
    });

    it('returns the mapped CustomExtra from the ApiResponse envelope', () => {
      let result: CustomExtra | undefined;
      service.createExtra({ name: 'Sal', defaultPrice: 10 }).subscribe((v) => (result = v));

      flush(http, BASE_URL, EXTRA_STUB);

      expect(result).toEqual(EXTRA_STUB);
    });
  });

  describe('updateExtra()', () => {
    it('sends a PUT to the correct URL with the name payload', () => {
      service.updateExtra(3, { name: 'Pimienta' }).subscribe();

      const req = http.expectOne(`${BASE_URL}/3`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Pimienta' });
      req.flush({ success: true, data: { ...EXTRA_STUB, id: 3, name: 'Pimienta' } });
    });

    it('sends PUT with an updated defaultPrice', () => {
      service.updateExtra(3, { defaultPrice: 25 }).subscribe();

      const req = http.expectOne(`${BASE_URL}/3`);
      expect(req.request.body).toEqual({ defaultPrice: 25 });
      req.flush({ success: true, data: { ...EXTRA_STUB, id: 3, defaultPrice: 25 } });
    });

    it('returns the mapped CustomExtra from the ApiResponse envelope', () => {
      const updated: CustomExtra = { ...EXTRA_STUB, id: 3, name: 'Pimienta' };
      let result: CustomExtra | undefined;
      service.updateExtra(3, { name: 'Pimienta' }).subscribe((v) => (result = v));

      flush(http, `${BASE_URL}/3`, updated);

      expect(result).toEqual(updated);
    });
  });

  describe('deleteExtra()', () => {
    it('sends DELETE to the correct URL without a query param when permanent is false (default)', () => {
      service.deleteExtra(5).subscribe();

      const req = http.expectOne(`${BASE_URL}/5`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.urlWithParams).not.toContain('permanent');
      req.flush({ success: true, data: null });
    });

    it('sends DELETE with ?permanent=true when permanent flag is true', () => {
      service.deleteExtra(5, true).subscribe();

      const req = http.expectOne(`${BASE_URL}/5?permanent=true`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: null });
    });

    it('returns undefined (void) on success', () => {
      let result: unknown = 'not-set';
      service.deleteExtra(5).subscribe((v) => (result = v));

      flush(http, `${BASE_URL}/5`, null);

      expect(result).toBeUndefined();
    });
  });
});
