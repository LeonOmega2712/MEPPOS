import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { COLD_START_STATUS } from '../../core/interceptors/server-error.interceptor';

// Aligns with the first retry window so the hint appears as the server is waking up.
const COLD_START_HINT_DELAY_MS = 4000;

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
    inject(DestroyRef).onDestroy(() => this.clearHint());
  }

  loading = signal(false);
  error = signal<string | null>(null);
  retryable = signal(false);
  coldStartHint = signal(false);

  private hintTimer: ReturnType<typeof setTimeout> | null = null;

  onSubmit(): void {
    if (!this.username || !this.password) return;

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
        const { message, retryable } = this.resolveError(err);
        this.error.set(message);
        this.retryable.set(retryable);
        this.loading.set(false);
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
