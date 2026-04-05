import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../core/guards/unsaved-changes.guard';
import { authGuard } from '../core/guards/auth.guard';
import { noAuthGuard } from '../core/guards/no-auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('../pages/login/login').then(m => m.LoginPage),
    canActivate: [noAuthGuard],
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
    redirectTo: 'login',
  },
];
