import { Component, computed, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OrderService } from '../../../../core/services/order.service';
import type { DiscountType, Order } from '../../../../core/models';
import { orderLabel } from '../../../../core/utils/order-label';
import { IconComponent } from '../../../../shared/components/icon';
import { CurrencyInputDirective } from '../../../../shared/directives/currency-input.directive';

/** One row of the consolidated checkout summary: identical items across rounds (same product/custom name, price and notes) merged into one line. */
interface CheckoutLine {
  key: string;
  name: string;
  notes: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

const MAX_DISCOUNT_DESCRIPTION_LENGTH = 255;
const MAX_DISCOUNT_VALUE = 99_999_999.99;

@Component({
  selector: 'app-checkout-panel',
  imports: [IconComponent, FormsModule, CurrencyInputDirective],
  templateUrl: './checkout-panel.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './checkout-panel.css',
})
export class CheckoutPanelComponent {
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  private readonly orderService = inject(OrderService);

  order = input.required<Order>();
  isOwner = input.required<boolean>();
  charged = output<Order>();
  back = output<void>();

  discountEnabled = signal(false);
  description = signal('');
  discountType = signal<DiscountType>('fixed');
  charging = signal(false);

  /** Cached value per type, kept in sync on every edit (see setDiscountValue) so switching types back and forth never re-derives — and drifts — a value the user actually typed. */
  private readonly fixedValue = signal<number | null>(null);
  private readonly percentageValue = signal<number | null>(null);

  discountValue = computed<number | null>(() =>
    this.discountType() === 'fixed' ? this.fixedValue() : this.percentageValue()
  );

  /** Consolidated summary lines, matching the shape of the final ticket rather than the per-round detail shown in the footer. */
  lines = computed<CheckoutLine[]>(() => {
    const merged = new Map<string, CheckoutLine>();
    for (const round of this.order().rounds) {
      for (const item of round.items) {
        const name = item.product?.name ?? item.customName ?? 'Producto';
        const unitPrice = Number(item.unitPrice);
        const key = `${item.productId ?? item.customName}|${unitPrice}|${item.notes ?? ''}`;
        const existing = merged.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.subtotal += unitPrice * item.quantity;
        } else {
          merged.set(key, {
            key,
            name,
            notes: item.notes,
            unitPrice,
            quantity: item.quantity,
            subtotal: unitPrice * item.quantity,
          });
        }
      }
    }
    return [...merged.values()];
  });

  subtotal = computed(() => this.lines().reduce((sum, line) => sum + line.subtotal, 0));

  /** Mirrors the backend's roundToCents(subtotal * value / 100) for percentage discounts so the displayed total matches what gets charged. */
  discountAmount = computed<number | null>(() => {
    if (!this.discountEnabled()) return null;
    const value = this.discountValue();
    if (value === null || value <= 0) return null;
    if (this.discountType() === 'fixed') return value;
    return Math.round(this.subtotal() * value) / 100;
  });

  total = computed(() => this.subtotal() - (this.discountAmount() ?? 0));

  /** Mirrors the backend's ChargeOrderSchema so invalid input is caught before the request round-trip. */
  validationError = computed<string | null>(() => {
    if (!this.discountEnabled()) return null;

    if (!this.description().trim()) return 'La descripción del descuento es requerida';
    if (this.description().length > MAX_DISCOUNT_DESCRIPTION_LENGTH) {
      return `La descripción no puede superar ${MAX_DISCOUNT_DESCRIPTION_LENGTH} caracteres`;
    }

    const value = this.discountValue();
    if (value === null || value <= 0) return 'El valor del descuento debe ser mayor a 0';
    if (Math.round(value * 100) / 100 !== value) return 'El valor del descuento admite máximo 2 decimales';
    if (value > MAX_DISCOUNT_VALUE) return 'El valor del descuento es demasiado grande';
    if (this.discountType() === 'percentage' && value > 100) return 'El descuento no puede superar el 100%';
    if (this.discountType() === 'fixed' && value > this.subtotal()) {
      return 'El descuento no puede superar el subtotal de la cuenta';
    }
    return null;
  });

  canConfirm = computed(
    () => this.lines().length > 0 && !this.charging() && this.validationError() === null
  );

  chipLabel(): string {
    return orderLabel(this.order());
  }

  toggleDiscount(): void {
    this.discountEnabled.update((enabled) => !enabled);
  }

  /** Switching type only changes which cached value is shown — see setDiscountValue for how the two stay in sync — so going back and forth never re-derives (and drifts) a value the user actually typed. */
  setDiscountType(type: DiscountType): void {
    this.discountType.set(type);
  }

  /** Updates the value for whichever type is currently active, and re-derives the paired type's cached value from it (e.g. 10% of 500 becomes 50). The type not being edited keeps its own last value untouched, so switching back to it later is exact instead of a lossy re-conversion. */
  setDiscountValue(value: number | null): void {
    if (this.discountType() === 'fixed') {
      this.fixedValue.set(value);
      this.percentageValue.set(this.toPercentage(value));
    } else {
      this.percentageValue.set(value);
      this.fixedValue.set(this.toFixed(value));
    }
  }

  /** Mirrors the backend's roundToCents(subtotal * value / 100) so the derived fixed amount matches what would actually be charged. */
  private toFixed(percentageValue: number | null): number | null {
    if (percentageValue === null || percentageValue <= 0) return null;
    const subtotal = this.subtotal();
    if (subtotal <= 0) return null;
    return Math.round(subtotal * percentageValue) / 100;
  }

  private toPercentage(fixedValue: number | null): number | null {
    if (fixedValue === null || fixedValue <= 0) return null;
    const subtotal = this.subtotal();
    if (subtotal <= 0) return null;
    return Math.round((fixedValue / subtotal) * 10000) / 100;
  }

  onDescriptionChange(event: Event): void {
    this.description.set((event.target as HTMLInputElement).value);
  }

  goBack(): void {
    this.back.emit();
  }

  async confirmCharge(): Promise<void> {
    if (!this.canConfirm()) return;

    const total = this.total().toFixed(2);
    const summaryLines = this.discountAmount() !== null
      ? [
          { label: this.description().trim(), detail: `-$${this.discountAmount()!.toFixed(2)}` },
          { label: 'Total a cobrar', detail: `$${total}` },
        ]
      : [];

    const confirmed = await this.confirmDialogService.confirm({
      title: 'Cobrar cuenta',
      message: `Esta acción no se puede deshacer. Escriba el total a cobrar (${total}) para confirmar:`,
      confirmText: 'Cobrar cuenta',
      requireInput: total,
      summaryLines,
    });
    if (!confirmed) return;

    const discount = this.discountEnabled()
      ? { description: this.description().trim(), type: this.discountType(), value: this.discountValue()! }
      : undefined;

    this.charging.set(true);
    this.orderService.chargeOrder(this.order().id, { discount }).subscribe({
      next: (order) => {
        this.charging.set(false);
        this.charged.emit(order);
      },
      error: (err: HttpErrorResponse) => {
        this.charging.set(false);
        const { message, shouldClose } = this.resolveChargeError(err);
        this.toastService.error(message);
        if (shouldClose) this.back.emit();
      },
    });
  }

  private resolveChargeError(err: HttpErrorResponse): { message: string; shouldClose: boolean } {
    const code = err.error?.error as string | undefined;
    switch (code) {
      case 'Order not found':
        return { message: 'La cuenta ya no existe', shouldClose: true };
      case 'Order is not open':
        return { message: 'La cuenta ya no está abierta', shouldClose: true };
      case 'Order has no items':
        return { message: 'La cuenta no tiene productos', shouldClose: false };
      case 'Discount exceeds order subtotal':
        return { message: 'El descuento supera el subtotal de la cuenta', shouldClose: false };
      default:
        return { message: 'Error al cobrar la cuenta', shouldClose: false };
    }
  }
}
