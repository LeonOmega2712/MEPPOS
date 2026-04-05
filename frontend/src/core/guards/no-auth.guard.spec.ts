import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { noAuthGuard } from './no-auth.guard';
import { AuthService } from '../services/auth.service';

describe('noAuthGuard', () => {
  function setup(isAuthenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
      ],
    });
  }

  function run() {
    return TestBed.runInInjectionContext(() => noAuthGuard({} as any, {} as any));
  }

  describe('when not authenticated', () => {
    beforeEach(() => setup(false));

    it('returns true (allows access to login)', () => {
      expect(run()).toBe(true);
    });
  });

  describe('when authenticated', () => {
    beforeEach(() => setup(true));

    it('returns a UrlTree redirecting to /bill', () => {
      const router = TestBed.inject(Router);
      expect(run()).toEqual(router.createUrlTree(['/bill']));
    });
  });
});
