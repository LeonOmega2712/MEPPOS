import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginPage } from './login';
import { AuthService } from '../../core/services/auth.service';
import { COLD_START_STATUS } from '../../core/interceptors/server-error.interceptor';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let component: LoginPage;
  let loginSubject: Subject<unknown>;
  let authServiceMock: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    loginSubject = new Subject();

    authServiceMock = {
      login: vi.fn().mockReturnValue(loginSubject.asObservable()),
    };

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function submitForm() {
    component.username = 'admin';
    component.password = 'password';
    component.onSubmit();
  }

  describe('initial state', () => {
    it('has no error, retryable false, hint hidden', () => {
      expect(component.error()).toBeNull();
      expect(component.retryable()).toBe(false);
      expect(component.coldStartHint()).toBe(false);
    });
  });

  describe('resolveErrorMessage', () => {
    it('401 → credential error message, retryable false', () => {
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 401 }));

      expect(component.error()).toBe('Usuario o contraseña incorrectos.');
      expect(component.retryable()).toBe(false);
    });

    it('COLD_START_STATUS → cold start message, retryable true', () => {
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: COLD_START_STATUS }));

      expect(component.error()).toContain('El servidor está iniciando');
      expect(component.retryable()).toBe(true);
    });

    it('status 0 → connection error message, retryable true', () => {
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 0 }));

      expect(component.error()).toContain('No se pudo conectar');
      expect(component.retryable()).toBe(true);
    });

    it('502 → unavailable message, retryable true', () => {
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 502 }));

      expect(component.error()).toContain('Servicio no disponible');
      expect(component.retryable()).toBe(true);
    });

    it('503 → maintenance message, retryable true', () => {
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 503 }));

      expect(component.error()).toContain('mantenimiento');
      expect(component.retryable()).toBe(true);
    });

    it('500 → server error message, retryable true', () => {
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 500 }));

      expect(component.error()).toContain('Error del servidor');
      expect(component.retryable()).toBe(true);
    });
  });

  describe('cold start hint timer', () => {
    it('hint appears after 4000ms of unresolved loading', async () => {
      vi.useFakeTimers();
      submitForm();

      expect(component.coldStartHint()).toBe(false);
      await vi.advanceTimersByTimeAsync(4000);
      expect(component.coldStartHint()).toBe(true);

      loginSubject.complete();
    });

    it('hint is cleared when login succeeds', async () => {
      vi.useFakeTimers();
      submitForm();

      await vi.advanceTimersByTimeAsync(4000);
      expect(component.coldStartHint()).toBe(true);

      loginSubject.next({});
      loginSubject.complete();
      expect(component.coldStartHint()).toBe(false);
    });

    it('hint is cleared when login fails', async () => {
      vi.useFakeTimers();
      submitForm();

      await vi.advanceTimersByTimeAsync(4000);
      expect(component.coldStartHint()).toBe(true);

      loginSubject.error(new HttpErrorResponse({ status: 401 }));
      expect(component.coldStartHint()).toBe(false);
    });

    it('hint does not appear if request resolves before 4000ms', async () => {
      vi.useFakeTimers();
      submitForm();

      await vi.advanceTimersByTimeAsync(2000);
      loginSubject.error(new HttpErrorResponse({ status: 401 }));

      await vi.advanceTimersByTimeAsync(2000); // advance past where hint would have fired
      expect(component.coldStartHint()).toBe(false);
    });
  });

  describe('state reset on new submit', () => {
    it('clears previous error and retryable when submitting again', () => {
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 0 }));
      expect(component.error()).not.toBeNull();
      expect(component.retryable()).toBe(true);

      loginSubject = new Subject();
      authServiceMock.login.mockReturnValue(loginSubject.asObservable());
      submitForm();

      expect(component.error()).toBeNull();
      expect(component.retryable()).toBe(false);

      loginSubject.complete();
    });
  });
});
