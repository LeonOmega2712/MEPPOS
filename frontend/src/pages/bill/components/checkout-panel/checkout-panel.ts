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
  discountValue = signal<number | null>(null);
  charging = signal(false);

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

  /** Switching type converts the current value so the discounted amount stays the same (e.g. 10% of 500 becomes 50, and back to 10% when toggled again). */
  setDiscountType(type: DiscountType): void {
    const previousType = this.discountType();
    if (type === previousType) return;

    const value = this.discountValue();
    const subtotal = this.subtotal();
    if (value !== null && value > 0 && subtotal > 0) {
      const converted =
        type === 'fixed'
          ? Math.round(subtotal * value) / 100 // value was a percentage; mirrors the backend's roundToCents
          : Math.round((value / subtotal) * 10000) / 100; // value was a fixed amount; round to 2 decimals
      this.discountValue.set(converted);
    }

    this.discountType.set(type);
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
