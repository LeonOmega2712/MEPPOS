import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginPage } from './login';
import { AuthService } from '../../core/services/auth.service';
import { COLD_START_STATUS } from '../../core/interceptors/server-error.interceptor';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let component: LoginPage;
  let router: Router;
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
        provideRouter([{ path: 'bill', children: [] }]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
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

  describe('429 rate limit block', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the retry countdown from retryAfterSeconds and disables submit', () => {
      vi.useFakeTimers();
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 5 } }));

      expect(component.blockedSeconds()).toBe(5);
      expect(component.error()).toContain('0:05');
      expect(component.retryable()).toBe(false);
    });

    it('counts down every second and clears the error when it reaches zero', () => {
      vi.useFakeTimers();
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 2 } }));

      vi.advanceTimersByTime(1000);
      expect(component.blockedSeconds()).toBe(1);
      expect(component.error()).toContain('0:01');

      vi.advanceTimersByTime(1000);
      expect(component.blockedSeconds()).toBeNull();
      expect(component.error()).toBeNull();
    });

    it('falls back to a default duration when retryAfterSeconds is missing', () => {
      vi.useFakeTimers();
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 429, error: {} }));

      expect(component.blockedSeconds()).toBe(15 * 60);
    });

    it('blocks a new submit attempt while the countdown is active', () => {
      vi.useFakeTimers();
      submitForm();
      loginSubject.error(new HttpErrorResponse({ status: 429, error: { retryAfterSeconds: 60 } }));

      authServiceMock.login.mockClear();
      component.username = 'admin';
      component.password = 'password';
      component.onSubmit();

      expect(authServiceMock.login).not.toHaveBeenCalled();
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
      const navigateSpy = vi.spyOn(router, 'navigate');
      vi.useFakeTimers();
      submitForm();

      await vi.advanceTimersByTimeAsync(4000);
      expect(component.coldStartHint()).toBe(true);

      loginSubject.next({});
      loginSubject.complete();
      expect(component.coldStartHint()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/bill']);
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

  describe('Enter key submission', () => {
    function mockEvent(): Event {
      return { preventDefault: vi.fn() } as unknown as Event;
    }

    function mockPasswordInput(): HTMLInputElement {
      return { focus: vi.fn() } as unknown as HTMLInputElement;
    }

    it('onPasswordEnter submits when both fields are set', () => {
      component.username = 'admin';
      component.password = 'password';
      const event = mockEvent();

      component.onPasswordEnter(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(authServiceMock.login).toHaveBeenCalledTimes(1);
    });

    it('onUsernameEnter does nothing when username is empty', () => {
      component.username = '';
      component.password = '';
      const passwordInput = mockPasswordInput();

      component.onUsernameEnter(mockEvent(), passwordInput);

      expect(authServiceMock.login).not.toHaveBeenCalled();
      expect(passwordInput.focus).not.toHaveBeenCalled();
    });

    it('onUsernameEnter moves focus to password when password is empty', () => {
      component.username = 'admin';
      component.password = '';
      const passwordInput = mockPasswordInput();

      component.onUsernameEnter(mockEvent(), passwordInput);

      expect(passwordInput.focus).toHaveBeenCalledTimes(1);
      expect(authServiceMock.login).not.toHaveBeenCalled();
    });

    it('onUsernameEnter submits when both fields are set', () => {
      component.username = 'admin';
      component.password = 'password';
      const passwordInput = mockPasswordInput();

      component.onUsernameEnter(mockEvent(), passwordInput);

      expect(passwordInput.focus).not.toHaveBeenCalled();
      expect(authServiceMock.login).toHaveBeenCalledTimes(1);
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
