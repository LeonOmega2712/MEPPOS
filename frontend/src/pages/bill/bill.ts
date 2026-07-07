import { Component, computed, ElementRef, inject, OnInit, signal, viewChildren } from '@angular/core';
import { MenuService } from '../../core/services/menu.service';
import { SplashService } from '../../core/services/splash.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { OrderService } from '../../core/services/order.service';
import { LocationService } from '../../core/services/location.service';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import type { MenuCategory, MenuProduct, Order, OrderItemInput } from '../../core/models';
import { IconComponent } from '../../shared/components/icon';
import { NumericInputDirective } from '../../shared/directives/numeric-input.directive';
import { LocationPickerComponent, type LocationSelection } from './components/location-picker/location-picker';

interface BillItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
}

@Component({
  selector: 'app-bill-page',
  imports: [IconComponent, NumericInputDirective, LocationPickerComponent],
  templateUrl: './bill.html',
  styleUrl: './bill.css',
})
export class BillPage implements OnInit, HasUnsavedChanges {
  private readonly menuService = inject(MenuService);
  private readonly splashService = inject(SplashService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  private readonly orderService = inject(OrderService);
  private readonly locationService = inject(LocationService);

  private readonly productCards = viewChildren<ElementRef>('productCard');

  categories = signal<MenuCategory[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  billItems = signal<Map<number, BillItem>>(new Map());
  footerExpanded = signal(false);

  /** Order currently loaded from a chip; null means the cart has no place assigned yet. */
  activeOrder = signal<Order | null>(null);
  /** Bumped whenever activeOrder changes so stale loadOrder responses can be discarded. */
  private orderLoadToken = 0;
  pickerOpen = signal(false);
  confirming = signal(false);
  sendingRound = signal(false);

  readonly openOrders = this.orderService.openOrders;

  billItemsList = computed(() => [...this.billItems().values()]);

  // TODO: this list (sent/persisted items) and the footer's billItemsList (draft/unsent
  // items) render as two separate blocks on screen; consider unifying into one list with
  // a sent/draft badge per item instead of two visually similar item lists.
  existingItems = computed(() => {
    const order = this.activeOrder();
    if (!order) return [];
    return order.rounds.flatMap((round) =>
      round.items.map((item) => ({
        ...item,
        roundId: round.id,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
      }))
    );
  });

  totalItems = computed(() => {
    let count = 0;
    for (const item of this.billItems().values()) {
      count += item.quantity;
    }
    for (const item of this.existingItems()) {
      count += item.quantity;
    }
    return count;
  });

  totalPrice = computed(() => {
    let total = 0;
    for (const item of this.billItems().values()) {
      total += item.unitPrice * item.quantity;
    }
    for (const item of this.existingItems()) {
      total += item.subtotal;
    }
    return total;
  });

  ngOnInit(): void {
    this.orderService.ensureOpenOrders();
    this.locationService.ensureLocations();
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

  chipLabel(order: Order): string {
    if (order.location) {
      if (order.location.type === 'bar' && order.barPosition != null) {
        return `${order.location.name} #${order.barPosition}`;
      }
      return order.location.name;
    }
    if (order.takeoutNumber != null) return `Folio #${order.takeoutNumber}`;
    return `Orden #${order.id}`;
  }

  isActiveChip(order: Order): boolean {
    return this.activeOrder()?.id === order.id;
  }

  chipColor(order: Order): 'primary' | 'secondary' | 'accent' {
    if (!order.location) return 'accent';
    return order.location.type === 'bar' ? 'secondary' : 'primary';
  }

  async selectChip(order: Order): Promise<void> {
    if (this.isActiveChip(order)) return;
    if (!(await this.confirmSwitchAway())) return;
    this.loadOrder(order.id);
  }

  async selectNewChip(): Promise<void> {
    if (this.activeOrder() === null) return;
    if (!(await this.confirmSwitchAway())) return;
    this.orderLoadToken++;
    this.activeOrder.set(null);
    this.billItems.set(new Map());
    this.footerExpanded.set(false);
  }

  private async confirmSwitchAway(): Promise<boolean> {
    if (this.billItems().size === 0) return true;
    return this.confirmDialogService.confirm({
      message: 'Hay productos sin enviar en la cuenta actual. ¿Desea descartarlos?',
      confirmText: 'Descartar',
    });
  }

  private loadOrder(orderId: number): void {
    const token = ++this.orderLoadToken;
    this.orderService.getOrderById(orderId).subscribe({
      next: (order) => {
        if (token !== this.orderLoadToken) return;
        this.activeOrder.set(order);
        this.billItems.set(new Map());
      },
      error: () => {
        if (token !== this.orderLoadToken) return;
        this.toastService.error('Error al cargar la cuenta');
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

  updateExistingItemQuantity(itemId: number, roundId: number, quantity: number): void {
    const order = this.activeOrder();
    if (!order || quantity < 1) return;
    this.orderService.updateItem(order.id, roundId, itemId, { quantity }).subscribe({
      next: () => this.loadOrder(order.id),
      error: () => this.toastService.error('Error al actualizar el producto'),
    });
  }

  deleteExistingItem(itemId: number, roundId: number): void {
    const order = this.activeOrder();
    if (!order) return;
    this.orderService.deleteItem(order.id, roundId, itemId).subscribe({
      next: () => this.loadOrder(order.id),
      error: () => this.toastService.error('Error al eliminar el producto'),
    });
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

  /** True when confirming the bill should open the location picker instead of sending a round. */
  needsLocation(): boolean {
    return this.activeOrder() === null && this.billItems().size > 0;
  }

  confirmBill(): void {
    if (this.needsLocation()) {
      this.pickerOpen.set(true);
      return;
    }
    if (this.activeOrder() !== null && this.billItems().size > 0) {
      this.sendRound();
    }
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  private cartToRoundItems(): OrderItemInput[] {
    return this.billItemsList().map((item) => ({
      productId: item.productId,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    }));
  }

  onLocationConfirmed(selection: LocationSelection): void {
    this.confirming.set(true);
    const locationId = 'locationId' in selection ? selection.locationId : undefined;
    this.orderService.createOrder({ locationId }).subscribe({
      next: (order) => {
        this.orderService.addRound(order.id, { items: this.cartToRoundItems() }).subscribe({
          next: () => {
            this.confirming.set(false);
            this.pickerOpen.set(false);
            this.billItems.set(new Map());
            this.loadOrder(order.id);
            this.orderService.refreshOpenOrders();
            this.locationService.refreshLocations();
            this.toastService.success('Cuenta creada');
          },
          error: () => {
            this.confirming.set(false);
            this.toastService.error('La cuenta se creó pero no se pudieron enviar los productos');
            this.loadOrder(order.id);
            this.orderService.refreshOpenOrders();
            this.locationService.refreshLocations();
          },
        });
      },
      error: () => {
        this.confirming.set(false);
        this.toastService.error('Error al crear la cuenta');
      },
    });
  }

  private sendRound(): void {
    const order = this.activeOrder();
    if (!order) return;
    this.sendingRound.set(true);
    this.orderService.addRound(order.id, { items: this.cartToRoundItems() }).subscribe({
      next: () => {
        this.sendingRound.set(false);
        this.billItems.set(new Map());
        this.loadOrder(order.id);
        this.toastService.success('Productos enviados');
      },
      error: () => {
        this.sendingRound.set(false);
        this.toastService.error('Error al enviar los productos');
      },
    });
  }

  async cancelActiveOrder(): Promise<void> {
    const order = this.activeOrder();
    if (!order) return;
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Cancelar cuenta',
      message: '¿Desea cancelar esta cuenta? Esta acción no se puede deshacer.',
      confirmText: 'Cancelar cuenta',
    });
    if (!confirmed) return;
    this.orderService.cancelOrder(order.id).subscribe({
      next: () => {
        this.orderLoadToken++;
        this.activeOrder.set(null);
        this.billItems.set(new Map());
        this.footerExpanded.set(false);
        this.orderService.refreshOpenOrders();
        this.locationService.refreshLocations();
        this.toastService.success('Cuenta cancelada');
      },
      error: () => this.toastService.error('Error al cancelar la cuenta'),
    });
  }
}
