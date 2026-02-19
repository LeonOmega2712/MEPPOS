import { Component, inject, signal, viewChild } from '@angular/core';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector';
import { CategoryManagerComponent } from './components/category-manager/category-manager';
import { ProductManagerComponent } from './components/product-manager/product-manager';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-settings-page',
  imports: [ThemeSelectorComponent, CategoryManagerComponent, ProductManagerComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsPage {
  private readonly confirmDialogService = inject(ConfirmDialogService);

  categoryManager = viewChild(CategoryManagerComponent);
  productManager = viewChild(ProductManagerComponent);

  activeTab = signal<'categories' | 'products'>('categories');
  hasTabSwitched = signal(false);

  async selectTab(event: Event, tab: 'categories' | 'products'): Promise<void> {
    if (tab === this.activeTab()) return;

    event.preventDefault();

    const activeComponent = this.activeTab() === 'categories'
      ? this.categoryManager()
      : this.productManager();

    if (activeComponent?.hasUnsavedChanges()) {
      const confirmed = await this.confirmDialogService.confirm({
        message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
      });
      if (!confirmed) return;
      activeComponent.discardChanges();
    }

    this.hasTabSwitched.set(true);
    this.activeTab.set(tab);
  }
}
