import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutPanelComponent } from './checkout-panel';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OrderService } from '../../../../core/services/order.service';
import type { Order, OrderItem, OrderRound, Product } from '../../../../core/models';

const PRODUCT: Product = {
  id: 1,
  categoryId: 1,
  name: 'Cerveza',
  description: null,
  price: 5,
  image: null,
  displayOrder: 0,
  customizable: false,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  category: { id: 1, name: 'Bebidas', basePrice: null },
};

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 1,
    roundId: 10,
    productId: 1,
    customName: null,
    unitPrice: 5,
    quantity: 1,
    subtotal: 5,
    notes: null,
    product: PRODUCT,
    ...overrides,
  };
}

function makeRound(overrides: Partial<OrderRound> = {}): OrderRound {
  return { id: 10, orderId: 1, roundNumber: 1, userId: 1, createdAt: '2026-07-12T18:31:00Z', items: [], ...overrides };
}

function makeOrder(rounds: OrderRound[]): Order {
  return {
    id: 1,
    locationId: 5,
    barPosition: null,
    takeoutNumber: null,
    status: 'open',
    ownerUserId: 1,
    openedAt: '2026-07-12T18:30:00Z',
    closedAt: null,
    notes: null,
    location: { id: 5, name: 'Mesa 1', type: 'table', active: true, displayOrder: 0, createdAt: '', updatedAt: null },
    owner: { id: 1, displayName: 'Ana' },
    rounds,
    discounts: [],
    subtotal: 0,
    discountTotal: 0,
    total: 0,
  };
}

describe('CheckoutPanelComponent', () => {
  let fixture: ComponentFixture<CheckoutPanelComponent>;
  let component: CheckoutPanelComponent;
  let orderServiceMock: any;
  let toastServiceMock: any;
  let confirmDialogMock: any;

  beforeEach(async () => {
    orderServiceMock = { chargeOrder: vi.fn() };
    toastServiceMock = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    confirmDialogMock = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [CheckoutPanelComponent],
      providers: [
        { provide: OrderService, useValue: orderServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: ConfirmDialogService, useValue: confirmDialogMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutPanelComponent);
    component = fixture.componentInstance;
  });

  function setOrder(rounds: OrderRound[], isOwner = true): void {
    fixture.componentRef.setInput('order', makeOrder(rounds));
    fixture.componentRef.setInput('isOwner', isOwner);
    fixture.detectChanges();
  }

  describe('lines', () => {
    it('merges identical items across rounds into a single line', () => {
      setOrder([
        makeRound({ id: 10, items: [makeItem({ id: 1, roundId: 10, quantity: 2, unitPrice: 5 })] }),
        makeRound({ id: 11, roundNumber: 2, items: [makeItem({ id: 2, roundId: 11, quantity: 1, unitPrice: 5 })] }),
      ]);

      expect(component.lines()).toHaveLength(1);
      expect(component.lines()[0]).toMatchObject({ quantity: 3, subtotal: 15 });
    });

    it('keeps items with different notes as separate lines', () => {
      setOrder([
        makeRound({
          id: 10,
          items: [
            makeItem({ id: 1, quantity: 1, notes: 'sin cebolla' }),
            makeItem({ id: 2, quantity: 1, notes: null }),
          ],
        }),
      ]);

      expect(component.lines()).toHaveLength(2);
    });

    it('computes the subtotal from the merged lines', () => {
      setOrder([makeRound({ items: [makeItem({ quantity: 2, unitPrice: 5 })] })]);
      expect(component.subtotal()).toBe(10);
    });
  });

  describe('discount calculation', () => {
    beforeEach(() => setOrder([makeRound({ items: [makeItem({ quantity: 2, unitPrice: 5 })] })]));

    it('discountAmount is null when the discount section is disabled', () => {
      expect(component.discountAmount()).toBeNull();
      expect(component.total()).toBe(10);
    });

    it('applies a fixed discount directly to the total', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('fixed');
      component.discountValue.set(3);

      expect(component.discountAmount()).toBe(3);
      expect(component.total()).toBe(7);
    });

    it('applies a percentage discount using the same rounding as the backend', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('percentage');
      component.discountValue.set(10);

      expect(component.discountAmount()).toBe(1);
      expect(component.total()).toBe(9);
    });

    it('rejects a percentage discount above 100', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('percentage');
      component.discountValue.set(101);

      expect(component.validationError()).toMatch(/100%/);
      expect(component.canConfirm()).toBe(false);
    });

    it('rejects a fixed discount larger than the subtotal', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('fixed');
      component.discountValue.set(20);

      expect(component.validationError()).toMatch(/subtotal/);
      expect(component.canConfirm()).toBe(false);
    });

    it('rejects a value with more than 2 decimals', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.discountValue.set(1.234);

      expect(component.validationError()).toMatch(/decimales/);
    });

    it('requires a description when the discount is enabled', () => {
      component.toggleDiscount();
      component.discountValue.set(1);

      expect(component.validationError()).toMatch(/descripción/);
    });

    it('canConfirm is true once a valid discount is filled in', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.discountValue.set(2);

      expect(component.canConfirm()).toBe(true);
    });
  });

  describe('setDiscountType conversion', () => {
    beforeEach(() => setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 500 })] })]));

    it('converts a percentage value to the equivalent fixed amount', () => {
      component.toggleDiscount();
      component.setDiscountType('percentage');
      component.discountValue.set(10);

      component.setDiscountType('fixed');

      expect(component.discountValue()).toBe(50);
    });

    it('converts a fixed value back to the equivalent percentage', () => {
      component.toggleDiscount();
      component.setDiscountType('fixed');
      component.discountValue.set(50);

      component.setDiscountType('percentage');

      expect(component.discountValue()).toBe(10);
    });

    it('keeps the discounted amount stable across a full round trip', () => {
      component.toggleDiscount();
      component.setDiscountType('percentage');
      component.discountValue.set(10);
      expect(component.discountAmount()).toBe(50);

      component.setDiscountType('fixed');
      expect(component.discountAmount()).toBe(50);

      component.setDiscountType('percentage');
      expect(component.discountAmount()).toBe(50);
      expect(component.discountValue()).toBe(10);
    });

    it('does nothing when switching to the type that is already selected', () => {
      component.toggleDiscount();
      component.setDiscountType('fixed');
      component.discountValue.set(50);

      component.setDiscountType('fixed');

      expect(component.discountValue()).toBe(50);
    });

    it('does not attempt a conversion when no value has been entered yet', () => {
      component.toggleDiscount();
      component.setDiscountType('percentage');

      expect(component.discountValue()).toBeNull();
    });

    it('does not divide by zero when the order subtotal is 0', () => {
      setOrder([]);
      component.toggleDiscount();
      component.setDiscountType('fixed');
      component.discountValue.set(10);

      component.setDiscountType('percentage');

      expect(component.discountValue()).toBe(10);
    });
  });

  describe('ownership warning', () => {
    it('is not shown for the owner', () => {
      setOrder([makeRound({ items: [makeItem()] })], true);
      const warning = fixture.nativeElement.querySelector('[data-testid="checkout-owner-warning"]');
      expect(warning).toBeNull();
    });

    it('is shown for a non-owner', () => {
      setOrder([makeRound({ items: [makeItem()] })], false);
      const warning = fixture.nativeElement.querySelector('[data-testid="checkout-owner-warning"]');
      expect(warning).not.toBeNull();
    });
  });

  describe('confirmCharge', () => {
    beforeEach(() => setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 5 })] })]));

    it('does nothing when canConfirm is false', async () => {
      component.toggleDiscount();
      component.discountValue.set(9999);
      component.setDiscountType('fixed');
      await component.confirmCharge();
      expect(orderServiceMock.chargeOrder).not.toHaveBeenCalled();
    });

    it('asks for confirmation and charges the order without a discount', async () => {
      const charged = makeOrder([]);
      orderServiceMock.chargeOrder.mockReturnValue(of(charged));
      const spy = vi.fn();
      component.charged.subscribe(spy);

      await component.confirmCharge();

      expect(confirmDialogMock.confirm).toHaveBeenCalledWith(expect.objectContaining({ requireInput: '5.00' }));
      expect(orderServiceMock.chargeOrder).toHaveBeenCalledWith(1, { discount: undefined });
      expect(spy).toHaveBeenCalledWith(charged);
    });

    it('sends the discount payload when enabled', async () => {
      orderServiceMock.chargeOrder.mockReturnValue(of(makeOrder([])));
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('fixed');
      component.discountValue.set(1);

      await component.confirmCharge();

      expect(orderServiceMock.chargeOrder).toHaveBeenCalledWith(1, {
        discount: { description: 'Promo', type: 'fixed', value: 1 },
      });
    });

    it('does not charge when the confirmation dialog is dismissed', async () => {
      confirmDialogMock.confirm.mockResolvedValue(false);
      await component.confirmCharge();
      expect(orderServiceMock.chargeOrder).not.toHaveBeenCalled();
    });

    it('toasts a friendly message and stays open on a generic error', async () => {
      orderServiceMock.chargeOrder.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: 'Order has no items' } })));
      const backSpy = vi.fn();
      component.back.subscribe(backSpy);

      await component.confirmCharge();

      expect(toastServiceMock.error).toHaveBeenCalledWith('La cuenta no tiene productos');
      expect(backSpy).not.toHaveBeenCalled();
    });

    it('closes the panel when the order no longer exists', async () => {
      orderServiceMock.chargeOrder.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { error: 'Order not found' } })));
      const backSpy = vi.fn();
      component.back.subscribe(backSpy);

      await component.confirmCharge();

      expect(toastServiceMock.error).toHaveBeenCalledWith('La cuenta ya no existe');
      expect(backSpy).toHaveBeenCalled();
    });
  });

  describe('back', () => {
    it('emits back', () => {
      setOrder([]);
      const spy = vi.fn();
      component.back.subscribe(spy);
      component.goBack();
      expect(spy).toHaveBeenCalled();
    });
  });
});
