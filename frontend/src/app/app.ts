import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected router = inject(Router);
  private readonly mainContent = viewChild<ElementRef>('mainContent');
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(ThemeService).init();
  }

  onScroll(): void {
    const el = this.mainContent()?.nativeElement;
    if (!el) return;

    el.classList.add('scrolling');

    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => el.classList.remove('scrolling'), 800);
  }
}
