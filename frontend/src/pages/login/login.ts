import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/bill']);
    }
  }
  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.username || !this.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.router.navigate(['/bill']);
      },
      error: () => {
        this.error.set('Usuario o contraseña incorrectos');
        this.loading.set(false);
      },
    });
  }
}
