import { Component, computed, ElementRef, inject, OnInit, signal, viewChildren } from '@angular/core';
import { MenuService } from '../../core/services/menu.service';
import { SplashService } from '../../core/services/splash.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
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
export class BillPage implements OnInit, HasUnsavedChanges {
  private readonly menuService = inject(MenuService);
  private readonly splashService = inject(SplashService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  private readonly productCards = viewChildren<ElementRef>('productCard');

  categories = signal<MenuCategory[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  billItems = signal<Map<number, BillItem>>(new Map());
  footerExpanded = signal(false);

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
        this.splashService.contentReady();
      },
      error: () => {
        this.error.set('Error al cargar el menú');
        this.loading.set(false);
        this.splashService.contentReady();
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
    this.setQuantity(productId, this.getQuantity(productId) + 1);
  }

  decrementProduct(productId: number): void {
    this.setQuantity(productId, this.getQuantity(productId) - 1);
  }

  getQuantity(productId: number): number {
    return this.billItems().get(productId)?.quantity ?? 0;
  }

  setQuantity(productId: number, quantity: number): void {
    const current = this.billItems().get(productId);
    if (!current) return;
    const sanitized = Math.floor(quantity);
    const updated = new Map(this.billItems());
    if (sanitized > 0) {
      updated.set(productId, { ...current, quantity: sanitized });
    } else {
      updated.delete(productId);
      if (updated.size === 0) this.footerExpanded.set(false);
    }
    this.billItems.set(updated);
  }

  onQuantityChange(productId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    this.setQuantity(productId, isNaN(value) ? 0 : value);
  }

  preventNonIntegerInput(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.billItems().size > 0;
  }

  deactivateMessage(): string {
    return 'Hay una cuenta activa con productos. ¿Desea abandonarla?';
  }

  discardChanges(): void {
    this.billItems.set(new Map());
    this.footerExpanded.set(false);
  }

  toggleFooter(): void {
    this.footerExpanded.update((v) => !v);
  }

  scrollToProduct(productId: number): void {
    const el = this.productCards().find(
      (ref) => ref.nativeElement.id === `product-${productId}`
    )?.nativeElement as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (el) {
      el.classList.remove('product-highlight');
      void el.offsetWidth; // Forces reflow to restart the CSS animation
      el.classList.add('product-highlight');
    }
  }

  async clearBill(): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      message: '¿Desea limpiar todos los productos de la cuenta actual?',
      confirmText: 'Limpiar',
    });
    if (!confirmed) return;
    this.billItems.set(new Map());
    this.footerExpanded.set(false);
  }
}
