import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector';
import { CategoryManagerComponent } from './components/category-manager/category-manager';
import { ProductManagerComponent } from './components/product-manager/product-manager';
import { UserManagerComponent } from './components/user-manager/user-manager';
import { LocationManagerComponent } from './components/location-manager/location-manager';
import { CustomExtraManagerComponent } from './components/custom-extra-manager/custom-extra-manager';
import { IconComponent } from '../../shared/components/icon';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SplashService } from '../../core/services/splash.service';
import { AuthService } from '../../core/services/auth.service';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { ROLE_LABELS } from '../../core/models';

type SettingsTab = 'categories' | 'products' | 'users' | 'locations' | 'extras';

const TAB_ORDER: SettingsTab[] = ['categories', 'products', 'users', 'locations', 'extras'];

@Component({
  selector: 'app-settings-page',
  imports: [ThemeSelectorComponent, CategoryManagerComponent, ProductManagerComponent, UserManagerComponent, LocationManagerComponent, CustomExtraManagerComponent, IconComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsPage implements HasUnsavedChanges, OnInit {
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly splashService = inject(SplashService);
  protected readonly authService = inject(AuthService);

  categoryManager = viewChild(CategoryManagerComponent);
  productManager = viewChild(ProductManagerComponent);
  userManager = viewChild(UserManagerComponent);
  locationManager = viewChild(LocationManagerComponent);
  customExtraManager = viewChild(CustomExtraManagerComponent);

  protected readonly roleLabels = ROLE_LABELS;

  activeTab = signal<SettingsTab>('categories');
  slideDirection = signal<'left' | 'right' | null>(null);

  ngOnInit(): void {
    this.splashService.contentReady();
  }

  hasUnsavedChanges(): boolean {
    return !!(
      this.categoryManager()?.hasUnsavedChanges() ||
      this.productManager()?.hasUnsavedChanges() ||
      this.userManager()?.hasUnsavedChanges() ||
      this.locationManager()?.hasUnsavedChanges() ||
      this.customExtraManager()?.hasUnsavedChanges()
    );
  }

  discardChanges(): void {
    this.categoryManager()?.discardChanges();
    this.productManager()?.discardChanges();
    this.userManager()?.discardChanges();
    this.locationManager()?.discardChanges();
    this.customExtraManager()?.discardChanges();
  }

  async selectTab(event: Event, tab: SettingsTab): Promise<void> {
    if (tab === this.activeTab()) return;

    event.preventDefault();

    const activeComponent = this.getActiveComponent();

    if (activeComponent?.hasUnsavedChanges()) {
      const confirmed = await this.confirmDialogService.confirm({
        message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
      });
      if (!confirmed) return;
      activeComponent.discardChanges();
    }

    const fromIndex = TAB_ORDER.indexOf(this.activeTab());
    const toIndex = TAB_ORDER.indexOf(tab);
    this.slideDirection.set(toIndex > fromIndex ? 'right' : 'left');
    this.activeTab.set(tab);
  }

  private getActiveComponent(): CategoryManagerComponent | ProductManagerComponent | UserManagerComponent | LocationManagerComponent | CustomExtraManagerComponent | undefined {
    switch (this.activeTab()) {
      case 'categories': return this.categoryManager();
      case 'products': return this.productManager();
      case 'users': return this.userManager();
      case 'locations': return this.locationManager();
      case 'extras': return this.customExtraManager();
    }
  }
}
