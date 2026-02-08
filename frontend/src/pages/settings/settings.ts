import { Component, inject } from '@angular/core';
import {
  ThemeService,
  DAISY_THEMES,
  type DaisyTheme,
} from '../../core/services/theme.service';

@Component({
  selector: 'app-settings-page',
  imports: [],
  templateUrl: './settings.html',
})
export class SettingsPage {
  protected readonly themeService = inject(ThemeService);
  protected readonly themes: readonly DaisyTheme[] = DAISY_THEMES;

  selectTheme(theme: DaisyTheme): void {
    this.themeService.setTheme(theme);
  }
}
