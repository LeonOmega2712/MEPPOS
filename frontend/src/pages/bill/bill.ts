import { Component, computed, DestroyRef, effect, ElementRef, inject, OnInit, signal, viewChild, viewChildren, ChangeDetectionStrategy } from '@angular/core';
import { forkJoin, type Observable } from 'rxjs';
import { MenuService } from '../../core/services/menu.service';
import { SplashService } from '../../core/services/splash.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { OrderService } from '../../core/services/order.service';
import { LocationService } from '../../core/services/location.service';
import { AuthService } from '../../core/services/auth.service';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bill.css',
})
export class BillPage implements OnInit, HasUnsavedChanges {
  private readonly menuService = inject(MenuService);
  private readonly splashService = inject(SplashService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  private readonly orderService = inject(OrderService);
  private readonly locationService = inject(LocationService);
  private readonly authService = inject(AuthService);

  private readonly productCards = viewChildren<ElementRef>('productCard');
  private readonly footerItemsList = viewChild<ElementRef>('footerItemsList');

  categories = signal<MenuCategory[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  billItems = signal<Map<number, BillItem>>(new Map());
  footerExpanded = signal(false);
  /** Round IDs whose quantity editors are currently revealed (sent rounds are collapsed by default). */
  editingRounds = signal<Set<number>>(new Set());

  /** Order currently loaded from a chip; null means the cart has no place assigned yet. */
  activeOrder = signal<Order | null>(null);
  /** Bumped whenever activeOrder changes so stale loadOrder responses can be discarded. */
  private orderLoadToken = 0;
  pickerOpen = signal(false);
  confirming = signal(false);
  sendingRound = signal(false);

  readonly openOrders = this.orderService.openOrders;
  readonly openOrdersRevalidating = this.orderService.openOrdersRevalidating;
  /** Drives the refresh button: spins for at least one full rotation, then shows a check before returning to idle. */
  refreshState = signal<'idle' | 'spinning' | 'success'>('idle');
  /** Starts false so success flashes solid, then true a moment later so it settles into soft. */
  refreshSuccessSoft = signal(false);
  private refreshStartedAt = 0;

  /** When true, the chips row only shows orders owned by the current user. */
  showMine = signal(false);

  private static readonly POLL_INTERVAL_MS = 30_000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** orderId -> ownerUserId as of the last observed openOrders() snapshot; null until the first load. */
  private knownOrderOwners: Map<number, number> | null = null;
  /** Orders created in this session, so their own creator isn't notified about them. */
  private readonly selfCreatedOrderIds = new Set<number>();
  private readonly onVisibilityChange = (): void => this.handleVisibilityChange();

  constructor() {
    effect(() => this.detectOwnerAssignments(this.openOrders() ?? []));

    this.startPolling();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    inject(DestroyRef).onDestroy(() => {
      this.stopPolling();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    });
  }

  billItemsList = computed(() => [...this.billItems().values()]);

  draftSubtotal = computed(() =>
    this.billItemsList().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  );

  draftItemCount = computed(() =>
    this.billItemsList().reduce((sum, item) => sum + item.quantity, 0)
  );

  visibleOrders = computed(() => {
    const orders = this.openOrders() ?? [];
    if (!this.showMine()) return orders;
    const userId = this.authService.user()?.id;
    return orders.filter((order) => order.ownerUserId === userId);
  });

  /** Round IDs mapped to itemId → not-yet-saved quantity, buffered while a round is being edited. */
  pendingRoundEdits = signal<Map<number, Map<number, number>>>(new Map());

  /** Sent items grouped by round, each with its own subtotal, for the active-order detail. Quantities reflect any unsaved edits still pending confirmation. */
  existingRounds = computed(() => {
    const order = this.activeOrder();
    if (!order) return [];
    const pendingByRound = this.pendingRoundEdits();
    return order.rounds.map((round) => {
      const pending = pendingByRound.get(round.id);
      const items = round.items.map((item) => {
        const unitPrice = Number(item.unitPrice);
        const originalQuantity = item.quantity;
        const quantity = pending?.get(item.id) ?? originalQuantity;
        return {
          ...item,
          roundId: round.id,
          unitPrice,
          quantity,
          originalQuantity,
          subtotal: unitPrice * quantity,
        };
      });
      return {
        id: round.id,
        roundNumber: round.roundNumber,
        items,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
      };
    });
  });

  existingItems = computed(() => this.existingRounds().flatMap((round) => round.items));

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

  confirmLabel = computed(() =>
    this.activeOrder() === null ? 'Confirmar cuenta nueva' : 'Confirmar ronda nueva'
  );

  clearLabel = computed(() =>
    this.activeOrder() === null ? 'Limpiar cuenta' : 'Limpiar ronda'
  );

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

  isOwner(order: Order): boolean {
    return order.ownerUserId === this.authService.user()?.id;
  }

  ownerLabel(order: Order): string {
    return order.owner?.displayName ?? 'Otro mesero';
  }

  openedAtLabel(order: Order): string {
    return new Date(order.openedAt).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  toggleMine(): void {
    this.showMine.update((v) => !v);
  }

  refresh(): void {
    if (this.refreshState() !== 'idle') return;
    this.refreshState.set('spinning');
    this.refreshStartedAt = Date.now();
    this.orderService.refreshOpenOrders().subscribe({
      next: () => this.onRefreshSettled(),
      error: () => this.onRefreshSettled(),
    });
  }

  private onRefreshSettled(): void {
    const remaining = Math.max(0, 1000 - (Date.now() - this.refreshStartedAt));
    setTimeout(() => {
      this.refreshState.set('success');
      this.refreshSuccessSoft.set(false);
      setTimeout(() => this.refreshSuccessSoft.set(true), 500);
      setTimeout(() => {
        this.refreshState.set('idle');
        this.refreshSuccessSoft.set(false);
      }, 1000);
    }, remaining);
  }

  private startPolling(): void {
    if (this.pollTimer !== null || document.hidden) return;
    this.pollTimer = setInterval(() => this.pollOpenOrders(), BillPage.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer === null) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private pollOpenOrders(): void {
    this.orderService.refreshOpenOrders().subscribe({ error: () => {} });
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.stopPolling();
      return;
    }
    this.pollOpenOrders();
    this.startPolling();
  }

  /** Compares the latest openOrders() snapshot against the previous one and toasts when an order lands on the current user. */
  private detectOwnerAssignments(orders: Order[]): void {
    const previous = this.knownOrderOwners;
    const current = new Map(orders.map((order) => [order.id, order.ownerUserId]));
    this.knownOrderOwners = current;
    if (previous === null) return;

    const userId = this.authService.user()?.id;
    if (userId === undefined) return;

    for (const order of orders) {
      if (order.ownerUserId !== userId) continue;
      if (this.selfCreatedOrderIds.has(order.id)) continue;
      if (previous.get(order.id) === userId) continue;
      this.toastService.info(`Se te asignó la cuenta ${this.chipLabel(order)}`);
    }
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
    this.editingRounds.set(new Set());
    this.pendingRoundEdits.set(new Map());
  }

  private async confirmSwitchAway(): Promise<boolean> {
    if (this.billItems().size === 0 && this.pendingRoundEdits().size === 0) return true;
    return this.confirmDialogService.confirm({
      message: 'Hay cambios sin guardar en la cuenta actual. ¿Desea descartarlos?',
      confirmText: 'Descartar',
    });
  }

  private loadOrder(orderId: number): void {
    const isSameOrder = this.activeOrder()?.id === orderId;
    const token = ++this.orderLoadToken;
    this.orderService.getOrderById(orderId).subscribe({
      next: (order) => {
        if (token !== this.orderLoadToken) return;
        this.activeOrder.set(order);
        this.billItems.set(new Map());
        if (!isSameOrder) {
          this.editingRounds.set(new Set());
          this.pendingRoundEdits.set(new Map());
          this.footerExpanded.set(true);
        }
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
    this.scrollFooterListToBottom();
  }

  /** Keeps the footer's item list scrolled to the newest (last-added) draft item. */
  private scrollFooterListToBottom(): void {
    const el = this.footerItemsList()?.nativeElement as HTMLElement | undefined;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
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

  /** Buffers a quantity change for a sent item locally; nothing is sent to the backend until the round edit is confirmed. */
  private setPendingItemQuantity(roundId: number, itemId: number, originalQuantity: number, quantity: number): void {
    const clamped = Math.max(Math.floor(quantity), 0);
    const updatedRounds = new Map(this.pendingRoundEdits());
    const roundEdits = new Map(updatedRounds.get(roundId) ?? []);
    if (clamped === originalQuantity) {
      roundEdits.delete(itemId);
    } else {
      roundEdits.set(itemId, clamped);
    }
    if (roundEdits.size === 0) {
      updatedRounds.delete(roundId);
    } else {
      updatedRounds.set(roundId, roundEdits);
    }
    this.pendingRoundEdits.set(updatedRounds);
  }

  /** Previews a quantity change (from the join's +/- buttons) for a sent item; a quantity of 0 marks it for removal. */
  previewExistingItemQuantity(itemId: number, roundId: number, originalQuantity: number, quantity: number): void {
    this.setPendingItemQuantity(roundId, itemId, originalQuantity, quantity);
  }

  /** Mirrors previewExistingItemQuantity for manual entry: below 1 marks the item for removal, same as the join's minus button. */
  onExistingItemQuantityChange(
    item: { id: number; roundId: number; originalQuantity: number },
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const parsed = parseInt(input.value, 10);
    const quantity = isNaN(parsed) ? 0 : parsed;
    this.setPendingItemQuantity(item.roundId, item.id, item.originalQuantity, quantity);
  }

  async deleteRound(round: { id: number; items: unknown[]; subtotal: number }): Promise<void> {
    const order = this.activeOrder();
    if (!order) return;

    if (round.items.length > 0) {
      const total = round.subtotal.toFixed(2);
      const confirmed = await this.confirmDialogService.confirm({
        title: 'Eliminar ronda',
        message: `Esta acción no se puede deshacer. Escriba el total de la ronda (${total}) para confirmar:`,
        confirmText: 'Eliminar ronda',
        requireInput: total,
      });
      if (!confirmed) return;
    }

    this.orderService.deleteRound(order.id, round.id).subscribe({
      next: () => this.loadOrder(order.id),
      error: () => this.toastService.error('Error al eliminar la ronda'),
    });
  }

  hasUnsavedChanges(): boolean {
    return this.billItems().size > 0 || this.pendingRoundEdits().size > 0;
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

  isRoundEditing(roundId: number): boolean {
    return this.editingRounds().has(roundId);
  }

  private openRoundEdit(roundId: number): void {
    const updated = new Set(this.editingRounds());
    updated.add(roundId);
    this.editingRounds.set(updated);
  }

  private closeRoundEdit(roundId: number): void {
    const updated = new Set(this.editingRounds());
    updated.delete(roundId);
    this.editingRounds.set(updated);
  }

  private clearPendingRoundEdits(roundId: number): void {
    const updated = new Map(this.pendingRoundEdits());
    updated.delete(roundId);
    this.pendingRoundEdits.set(updated);
  }

  /** Toggles a round's quantity editor. Opening starts a local edit session; closing with unsaved changes asks for confirmation, showing a previous-vs-new summary, before saving anything. */
  async toggleRoundEdit(round: {
    id: number;
    items: Array<{
      id: number;
      quantity: number;
      originalQuantity: number;
      product?: { name: string } | null;
      customName: string | null;
    }>;
  }): Promise<void> {
    if (!this.isRoundEditing(round.id)) {
      this.openRoundEdit(round.id);
      return;
    }

    const pending = this.pendingRoundEdits().get(round.id);
    if (!pending || pending.size === 0) {
      this.closeRoundEdit(round.id);
      return;
    }

    const changes = round.items
      .filter((item) => pending.has(item.id))
      .map((item) => ({ id: item.id, newQuantity: pending.get(item.id)!, item }));

    const willDeleteRound = round.items.every(
      (item) => (pending.get(item.id) ?? item.originalQuantity) === 0
    );

    const summaryLines = changes.map(({ item, newQuantity }) => ({
      label: item.product?.name ?? item.customName ?? 'Producto',
      detail: newQuantity === 0 ? `${item.originalQuantity} → se elimina` : `${item.originalQuantity} → ${newQuantity}`,
    }));

    const confirmed = await this.confirmDialogService.confirm({
      title: 'Confirmar cambios de la ronda',
      message: willDeleteRound
        ? 'Se eliminarán todos los productos de la ronda, por lo que la ronda también se eliminará. ¿Desea continuar?'
        : '¿Desea guardar los siguientes cambios en la ronda?',
      confirmText: 'Guardar cambios',
      summaryLines,
    });
    if (!confirmed) return;

    this.applyRoundEdits(
      round.id,
      changes.map(({ id, newQuantity }) => ({ id, newQuantity })),
      willDeleteRound
    );
  }

  private applyRoundEdits(
    roundId: number,
    changes: { id: number; newQuantity: number }[],
    willDeleteRound: boolean
  ): void {
    const order = this.activeOrder();
    if (!order) return;

    const request$: Observable<unknown> = willDeleteRound
      ? this.orderService.deleteRound(order.id, roundId)
      : forkJoin(
          changes.map(
            ({ id, newQuantity }): Observable<unknown> =>
              newQuantity === 0
                ? this.orderService.deleteItem(order.id, roundId, id)
                : this.orderService.updateItem(order.id, roundId, id, { quantity: newQuantity })
          )
        );

    request$.subscribe({
      next: () => {
        this.clearPendingRoundEdits(roundId);
        this.closeRoundEdit(roundId);
        this.loadOrder(order.id);
      },
      error: () => this.toastService.error('Error al guardar los cambios de la ronda'),
    });
  }

  /** Cancels a round's edit session, discarding any unsaved quantity changes. */
  async cancelRoundEdit(roundId: number): Promise<void> {
    const pending = this.pendingRoundEdits().get(roundId);
    if (!pending || pending.size === 0) {
      this.closeRoundEdit(roundId);
      return;
    }

    const confirmed = await this.confirmDialogService.confirm({
      title: 'Cancelar edición de ronda',
      message: '¿Desea cancelar los cambios realizados en la ronda?',
      confirmText: 'Descartar cambios',
    });
    if (!confirmed) return;

    this.clearPendingRoundEdits(roundId);
    this.closeRoundEdit(roundId);
  }

  scrollToProduct(productId: number | null): void {
    if (productId === null) return;
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
    const target = this.activeOrder() === null ? 'cuenta nueva' : 'ronda nueva';
    const confirmed = await this.confirmDialogService.confirm({
      title: `Limpiar ${target}`,
      message: `¿Desea limpiar todos los productos de la ${target}?`,
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
        this.selfCreatedOrderIds.add(order.id);
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
    const total = this.totalPrice().toFixed(2);
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Cancelar cuenta',
      message: `Esta acción no se puede deshacer. Escriba el total actual (${total}) para confirmar:`,
      confirmText: 'Cancelar cuenta',
      requireInput: total,
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
