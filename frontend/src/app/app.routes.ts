import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../core/guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/menu/menu').then(m => m.MenuPage),
  },
  {
    path: 'bill',
    loadComponent: () => import('../pages/bill/bill').then(m => m.BillPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('../pages/settings/settings').then(m => m.SettingsPage),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
