import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { serverErrorInterceptor, COLD_START_STATUS, COLD_START_DELAYS_MS } from './server-error.interceptor';

// Simulates the JSON parse error Angular throws when receiving a 200 OK with HTML body.
function coldStartError(): ReturnType<typeof throwError> {
  return throwError(() => new HttpErrorResponse({ status: 200, statusText: 'OK' }));
}

describe('serverErrorInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => vi.useRealTimers());

  function run(req: HttpRequest<unknown>, handler: HttpHandlerFn) {
    return TestBed.runInInjectionContext(() => serverErrorInterceptor(req, handler));
  }

  describe('non-login routes — no retry applied', () => {
    it('transforms 200-HTML error to COLD_START_STATUS', () => {
      const req = new HttpRequest('GET', '/api/categories');
      let capturedError: any;

      run(req, () => coldStartError()).subscribe({ error: (e) => (capturedError = e) });

      expect(capturedError.status).toBe(COLD_START_STATUS);
    });

    it('passes 401 through unchanged', () => {
      const req = new HttpRequest('GET', '/api/categories');
      let capturedError: any;

      run(req, () => throwError(() => new HttpErrorResponse({ status: 401 }))).subscribe({
        error: (e) => (capturedError = e),
      });

      expect(capturedError.status).toBe(401);
    });

    it('passes successful responses through unchanged', () => {
      const req = new HttpRequest('GET', '/api/categories');
      const mockBody = { success: true, data: [] };
      let capturedResponse: any;

      run(req, () => of(new HttpResponse({ status: 200, body: mockBody }))).subscribe({
        next: (r) => (capturedResponse = r),
      });

      expect((capturedResponse as HttpResponse<unknown>).body).toEqual(mockBody);
    });
  });

  describe('/auth/login route — cold start retry', () => {
    it('retry config: 4 attempts with exponential backoff covering Koyeb cold start range', () => {
      expect(COLD_START_DELAYS_MS).toHaveLength(4);

      // Delays must increase (exponential backoff)
      for (let i = 1; i < COLD_START_DELAYS_MS.length; i++) {
        expect(COLD_START_DELAYS_MS[i]).toBeGreaterThan(COLD_START_DELAYS_MS[i - 1]);
      }

      // Total wait must cover the max observed Koyeb cold start (~15s)
      const totalWait = COLD_START_DELAYS_MS.reduce((sum, d) => sum + d, 0);
      expect(totalWait).toBeGreaterThanOrEqual(15_000);
    });

    it('does not retry on 401 — only one request made', () => {
      const req = new HttpRequest('POST', '/api/auth/login', {});
      let callCount = 0;
      let capturedError: any;

      run(req, () => {
        callCount++;
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      }).subscribe({ error: (e) => (capturedError = e) });

      expect(capturedError.status).toBe(401);
      expect(callCount).toBe(1);
    });
  });
});
