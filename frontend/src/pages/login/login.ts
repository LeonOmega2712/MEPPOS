import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { COLD_START_STATUS } from '../../core/interceptors/server-error.interceptor';

// Aligns with the first retry window so the hint appears as the server is waking up.
const COLD_START_HINT_DELAY_MS = 4000;

// Matches the backend's login rate limit window (see rate-limit.ts) — used only
// when the server response doesn't include a retryAfterSeconds value.
const DEFAULT_BLOCK_SECONDS = 15 * 60;

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.clearHint();
      this.clearBlockTimer();
    });
  }

  loading = signal(false);
  error = signal<string | null>(null);
  retryable = signal(false);
  coldStartHint = signal(false);
  blockedSeconds = signal<number | null>(null);

  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private blockTimer: ReturnType<typeof setInterval> | null = null;

  onUsernameEnter(event: Event, passwordInput: HTMLInputElement): void {
    event.preventDefault();
    if (!this.username) return;
    if (!this.password) {
      passwordInput.focus();
      return;
    }
    this.onSubmit();
  }

  onPasswordEnter(event: Event): void {
    event.preventDefault();
    this.onSubmit();
  }

  onSubmit(): void {
    if (!this.username || !this.password || this.blockedSeconds() !== null) return;

    this.loading.set(true);
    this.error.set(null);
    this.retryable.set(false);
    this.coldStartHint.set(false);

    this.hintTimer = setTimeout(() => this.coldStartHint.set(true), COLD_START_HINT_DELAY_MS);

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.clearHint();
        this.router.navigate(['/bill']);
      },
      error: (err: HttpErrorResponse) => {
        this.clearHint();
        this.loading.set(false);

        if (err.status === 429) {
          this.retryable.set(false);
          this.startBlockCountdown(this.extractRetryAfterSeconds(err));
          return;
        }

        const { message, retryable } = this.resolveError(err);
        this.error.set(message);
        this.retryable.set(retryable);
      },
    });
  }

  private clearHint(): void {
    if (this.hintTimer !== null) {
      clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
    this.coldStartHint.set(false);
  }

  private extractRetryAfterSeconds(err: HttpErrorResponse): number {
    const seconds = err.error?.retryAfterSeconds;
    return typeof seconds === 'number' && seconds > 0 ? seconds : DEFAULT_BLOCK_SECONDS;
  }

  private startBlockCountdown(seconds: number): void {
    this.clearBlockTimer();
    this.blockedSeconds.set(seconds);
    this.error.set(this.formatBlockedMessage(seconds));

    this.blockTimer = setInterval(() => {
      const remaining = (this.blockedSeconds() ?? 1) - 1;
      if (remaining <= 0) {
        this.clearBlockTimer();
        this.error.set(null);
        return;
      }
      this.blockedSeconds.set(remaining);
      this.error.set(this.formatBlockedMessage(remaining));
    }, 1000);
  }

  private clearBlockTimer(): void {
    if (this.blockTimer !== null) {
      clearInterval(this.blockTimer);
      this.blockTimer = null;
    }
    this.blockedSeconds.set(null);
  }

  private formatBlockedMessage(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, '0');
    return `Demasiados intentos fallidos. Espera ${minutes}:${secs} antes de volver a intentar.`;
  }

  private resolveError(err: HttpErrorResponse): { message: string; retryable: boolean } {
    if (err.status === COLD_START_STATUS) return { message: 'El servidor está iniciando. Espera unos segundos e intenta de nuevo.', retryable: true };
    if (err.status === 0) return { message: 'No se pudo conectar al servidor. Verifica tu red e intenta de nuevo.', retryable: true };
    if (err.status === 401) return { message: 'Usuario o contraseña incorrectos.', retryable: false };
    if (err.status === 502) return { message: 'Servicio no disponible. Intenta más tarde.', retryable: true };
    if (err.status === 503) return { message: 'El servidor está en mantenimiento. Intenta más tarde.', retryable: true };
    if (err.status >= 500) return { message: 'Error del servidor. Intenta más tarde.', retryable: true };
    return { message: 'Error inesperado. Intenta de nuevo.', retryable: false };
  }
}
