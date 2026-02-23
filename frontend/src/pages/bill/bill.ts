import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MenuService } from '../../core/services/menu.service';
import type { MenuCategory, MenuProduct } from '../../core/models';
import { IconComponent } from '../../shared/components/icon';

interface BillItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
}

@Component({
  selector: 'app-bill-page',
  imports: [IconComponent],
  templateUrl: './bill.html',
  styleUrl: './bill.css',
})
export class BillPage implements OnInit {
  private readonly menuService = inject(MenuService);

  categories = signal<MenuCategory[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  billItems = signal<Map<number, BillItem>>(new Map());
  footerExpanded = signal(false);
  private readonly removingProducts = signal(new Set<number>());

  billItemsList = computed(() => [...this.billItems().values()]);

  totalItems = computed(() => {
    let count = 0;
    for (const item of this.billItems().values()) {
      count += item.quantity;
    }
    return count;
  });

  totalPrice = computed(() => {
    let total = 0;
    for (const item of this.billItems().values()) {
      total += item.unitPrice * item.quantity;
    }
    return total;
  });

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

  addProduct(product: MenuProduct, category: MenuCategory): void {
    if (this.billItems().has(product.id)) return;
    const unitPrice = product.price ?? category.basePrice ?? 0;
    const updated = new Map(this.billItems());
    updated.set(product.id, {
      productId: product.id,
      productName: product.name,
      unitPrice: Number(unitPrice),
      quantity: 1,
    });
    this.billItems.set(updated);
  }

  incrementProduct(productId: number): void {
    const current = this.billItems().get(productId);
    if (!current) return;
    const updated = new Map(this.billItems());
    updated.set(productId, { ...current, quantity: current.quantity + 1 });
    this.billItems.set(updated);
  }

  decrementProduct(productId: number): void {
    const current = this.billItems().get(productId);
    if (!current) return;
    if (current.quantity > 1) {
      const updated = new Map(this.billItems());
      updated.set(productId, { ...current, quantity: current.quantity - 1 });
      this.billItems.set(updated);
    } else {
      this.removeProductFromBill(productId);
    }
  }

  getQuantity(productId: number): number {
    return this.billItems().get(productId)?.quantity ?? 0;
  }

  isRemoving(productId: number): boolean {
    return this.removingProducts().has(productId);
  }

  setQuantity(productId: number, quantity: number): void {
    const current = this.billItems().get(productId);
    if (!current) return;
    if (quantity > 0) {
      const updated = new Map(this.billItems());
      updated.set(productId, { ...current, quantity });
      this.billItems.set(updated);
    } else {
      this.removeProductFromBill(productId);
    }
  }

  private removeProductFromBill(productId: number): void {
    const remainingItems = new Map(this.billItems());
    remainingItems.delete(productId);

    const removing = new Set(this.removingProducts());
    removing.add(productId);
    this.removingProducts.set(removing);

    if (remainingItems.size === 0) {
      this.footerExpanded.set(false);
    }

    setTimeout(() => {
      const fresh = new Map(this.billItems());
      fresh.delete(productId);
      this.billItems.set(fresh);

      const stillRemoving = new Set(this.removingProducts());
      stillRemoving.delete(productId);
      this.removingProducts.set(stillRemoving);
    }, 300);
  }

  onQuantityChange(productId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    this.setQuantity(productId, isNaN(value) ? 0 : value);
  }

  preventNegativeInput(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
  }

  toggleFooter(): void {
    this.footerExpanded.update((v) => !v);
  }
}
