import { Component } from '@angular/core';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector';
import { CategoryManagerComponent } from './components/category-manager/category-manager';

@Component({
  selector: 'app-settings-page',
  imports: [ThemeSelectorComponent, CategoryManagerComponent],
  templateUrl: './settings.html',
})
export class SettingsPage {}
