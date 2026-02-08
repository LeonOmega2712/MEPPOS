import { Component, inject, OnInit, signal } from '@angular/core';
import { MenuService } from '../../core/services/menu.service';
import type { MenuCategory } from '../../core/models';

@Component({
  selector: 'app-menu-page',
  imports: [],
  templateUrl: './menu.html',
})
export class MenuPage implements OnInit {
  private readonly menuService = inject(MenuService);

  categories = signal<MenuCategory[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.menuService.getMenu().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar el menú');
        this.loading.set(false);
      },
    });
  }
}
