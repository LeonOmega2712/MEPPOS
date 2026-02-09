import { Component, inject } from '@angular/core';
import {
  ThemeService,
  DAISY_THEMES,
  type DaisyTheme,
} from '../../../../core/services/theme.service';

@Component({
  selector: 'app-theme-selector',
  templateUrl: './theme-selector.html',
})
export class ThemeSelectorComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly themes: readonly DaisyTheme[] = DAISY_THEMES;

  selectTheme(theme: DaisyTheme): void {
    this.themeService.setTheme(theme);
  }
}
