import { Injectable, signal } from '@angular/core';

export const DAISY_THEMES = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
  'caramellatte',
  'abyss',
  'silk',
] as const;

export type DaisyTheme = (typeof DAISY_THEMES)[number];

const STORAGE_KEY = 'meppos-theme';
const DEFAULT_THEME: DaisyTheme = 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly currentTheme = signal<DaisyTheme>(this.loadTheme());

  init(): void {
    this.applyTheme(this.currentTheme());
  }

  setTheme(theme: DaisyTheme): void {
    this.currentTheme.set(theme);
    this.applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  private loadTheme(): DaisyTheme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (DAISY_THEMES as readonly string[]).includes(stored)) {
      return stored as DaisyTheme;
    }
    return DEFAULT_THEME;
  }

  private applyTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
    this.syncThemeColor();
  }

  private syncThemeColor(): void {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta || !document.body) return;

    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--color-base-100)';
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    document.body.removeChild(probe);

    if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
      meta.setAttribute('content', color);
    }
  }
}
