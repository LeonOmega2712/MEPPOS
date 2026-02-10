import { Component, signal } from '@angular/core';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector';
import { CategoryManagerComponent } from './components/category-manager/category-manager';
import { ProductManagerComponent } from './components/product-manager/product-manager';

@Component({
  selector: 'app-settings-page',
  imports: [ThemeSelectorComponent, CategoryManagerComponent, ProductManagerComponent],
  templateUrl: './settings.html',
})
export class SettingsPage {
  activeTab = signal<'categories' | 'products'>('categories');

  selectTab(tab: 'categories' | 'products'): void {
    this.activeTab.set(tab);
  }
}
