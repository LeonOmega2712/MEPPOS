import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../core/services/theme.service';
import { SplashService } from '../core/services/splash.service';
import { AuthService } from '../core/services/auth.service';
import { ToastComponent } from '../shared/components/toast';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected router = inject(Router);
  protected authService = inject(AuthService);
  private readonly mainContent = viewChild<ElementRef>('mainContent');
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(ThemeService).init();
    inject(SplashService);
    this.authService.initialize().subscribe();
  }

  onScroll(): void {
    const el = this.mainContent()?.nativeElement;
    if (!el) return;

    el.classList.add('scrolling');

    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => el.classList.remove('scrolling'), 800);
  }
}
