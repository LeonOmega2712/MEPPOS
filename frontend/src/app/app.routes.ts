import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../core/guards/unsaved-changes.guard';
import { authGuard, roleGuard } from '../core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('../pages/login/login').then(m => m.LoginPage),
  },
  {
    path: 'menu',
    loadComponent: () => import('../pages/menu/menu').then(m => m.MenuPage),
  },
  {
    path: 'bill',
    loadComponent: () => import('../pages/bill/bill').then(m => m.BillPage),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('../pages/settings/settings').then(m => m.SettingsPage),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: '**',
    redirectTo: 'menu',
  },
];
