import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/menu/menu').then(m => m.MenuPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('../pages/settings/settings').then(m => m.SettingsPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
