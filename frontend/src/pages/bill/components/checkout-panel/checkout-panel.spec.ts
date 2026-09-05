import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutPanelComponent } from './checkout-panel';
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

  beforeEach(async () => {
    orderServiceMock = { chargeOrder: vi.fn() };
    toastServiceMock = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CheckoutPanelComponent],
      providers: [
        { provide: OrderService, useValue: orderServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
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
      component.setDiscountValue(3);

      expect(component.discountAmount()).toBe(3);
      expect(component.total()).toBe(7);
    });

    it('applies a percentage discount using the same rounding as the backend', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('percentage');
      component.setDiscountValue(10);

      expect(component.discountAmount()).toBe(1);
      expect(component.total()).toBe(9);
    });

    it('rejects a percentage discount above 100', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('percentage');
      component.setDiscountValue(101);

      expect(component.validationError()).toMatch(/100%/);
      expect(component.canConfirm()).toBe(false);
    });

    it('rejects a fixed discount larger than the subtotal', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('fixed');
      component.setDiscountValue(20);

      expect(component.validationError()).toMatch(/subtotal/);
      expect(component.canConfirm()).toBe(false);
    });

    it('rejects a value with more than 2 decimals', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountValue(1.234);

      expect(component.validationError()).toMatch(/decimales/);
    });

    it('requires a description when the discount is enabled', () => {
      component.toggleDiscount();
      component.setDiscountValue(1);

      expect(component.validationError()).toMatch(/descripción/);
    });

    it('canConfirm is true once a valid discount is filled in', () => {
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountValue(2);

      expect(component.canConfirm()).toBe(true);
    });
  });

  describe('setDiscountType conversion', () => {
    beforeEach(() => setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 500 })] })]));

    it('converts a percentage value to the equivalent fixed amount', () => {
      component.toggleDiscount();
      component.setDiscountType('percentage');
      component.setDiscountValue(10);

      component.setDiscountType('fixed');

      expect(component.discountValue()).toBe(50);
    });

    it('converts a fixed value back to the equivalent percentage', () => {
      component.toggleDiscount();
      component.setDiscountType('fixed');
      component.setDiscountValue(50);

      component.setDiscountType('percentage');

      expect(component.discountValue()).toBe(10);
    });

    it('keeps the discounted amount stable across a full round trip', () => {
      component.toggleDiscount();
      component.setDiscountType('percentage');
      component.setDiscountValue(10);
      expect(component.discountAmount()).toBe(50);

      component.setDiscountType('fixed');
      expect(component.discountAmount()).toBe(50);

      component.setDiscountType('percentage');
      expect(component.discountAmount()).toBe(50);
      expect(component.discountValue()).toBe(10);
    });

    it('preserves the exact original fixed value across a round trip, even when the equivalent percentage does not round evenly (regression: $70 of $270 must not drift to $70.01)', () => {
      setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 270 })] })]);
      component.toggleDiscount();
      component.setDiscountType('fixed');
      component.setDiscountValue(70);

      component.setDiscountType('percentage');
      expect(component.discountValue()).toBeCloseTo(25.93, 2); // 70 / 270 * 100, rounded to 2 decimals

      component.setDiscountType('fixed');
      expect(component.discountValue()).toBe(70);

      // Repeated back-and-forth must not compound any drift.
      component.setDiscountType('percentage');
      component.setDiscountType('fixed');
      expect(component.discountValue()).toBe(70);
    });

    it('does nothing when switching to the type that is already selected', () => {
      component.toggleDiscount();
      component.setDiscountType('fixed');
      component.setDiscountValue(50);

      component.setDiscountType('fixed');

      expect(component.discountValue()).toBe(50);
    });

    it('does not attempt a conversion when no value has been entered yet', () => {
      component.toggleDiscount();
      component.setDiscountType('percentage');

      expect(component.discountValue()).toBeNull();
    });

    it('does not divide by zero when the order subtotal is 0, leaving the other type uncached', () => {
      setOrder([]);
      component.toggleDiscount();
      component.setDiscountType('fixed');
      component.setDiscountValue(10);
      expect(component.discountValue()).toBe(10);

      component.setDiscountType('percentage');

      expect(component.discountValue()).toBeNull();
    });
  });

  describe('discount value input (currency, cents-first entry like the settings price inputs)', () => {
    function getValueInput(): HTMLInputElement {
      return fixture.nativeElement.querySelector('[data-testid="discount-value"]') as HTMLInputElement;
    }

    function typeDigit(input: HTMLInputElement, digit: string): void {
      input.value = input.value + digit;
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    }

    beforeEach(() => {
      setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 500 })] })]);
      component.toggleDiscount();
      fixture.detectChanges();
    });

    it('builds the amount from the cents up, like a cash register, and formats it with 2 decimals', () => {
      const input = getValueInput();
      typeDigit(input, '5');
      expect(input.value).toBe('0.05');
      typeDigit(input, '0');
      expect(input.value).toBe('0.50');
      typeDigit(input, '0');
      expect(input.value).toBe('5.00');

      expect(component.discountValue()).toBe(5);
    });

    it('reflects a value set programmatically (e.g. from a type conversion) fully formatted', async () => {
      component.setDiscountType('fixed');
      component.setDiscountValue(50);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(getValueInput().value).toBe('50.00');
    });

    it('clears back to empty once the last digit is removed', () => {
      const input = getValueInput();
      typeDigit(input, '5');
      expect(input.value).toBe('0.05');

      // Simulates a native backspace removing the digit (which then fires 'input').
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      expect(input.value).toBe('');
      expect(component.discountValue()).toBeNull();
    });
  });

  describe('cash payment dialog (DOM)', () => {
    function getDialog(): Element | null {
      return fixture.nativeElement.querySelector('[data-testid="cash-payment-dialog"]');
    }

    function getReceivedInput(): HTMLInputElement {
      return fixture.nativeElement.querySelector('[data-testid="received-amount"]') as HTMLInputElement;
    }

    function getConfirmButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('[data-testid="confirm-cash-payment"]') as HTMLButtonElement;
    }

    function typeDigit(input: HTMLInputElement, digit: string): void {
      input.value = input.value + digit;
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    }

    beforeEach(() => setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 5 })] })]));

    it('is not rendered until openCashDialog is called', () => {
      expect(getDialog()).toBeNull();
    });

    it('renders once opened, with the confirm button disabled and no change shown yet', () => {
      component.openCashDialog();
      fixture.detectChanges();

      expect(getDialog()).not.toBeNull();
      expect(getConfirmButton().disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="change-amount"]')).toBeNull();
    });

    it('shows the change, cents-first, and enables confirm once payment covers the total', () => {
      component.openCashDialog();
      fixture.detectChanges();

      const input = getReceivedInput();
      typeDigit(input, '1'); // 0.01
      typeDigit(input, '0');
      typeDigit(input, '0'); // 1.00
      typeDigit(input, '0'); // 10.00

      expect(fixture.nativeElement.querySelector('[data-testid="change-amount"]').textContent).toContain('5.00');
      expect(getConfirmButton().disabled).toBe(false);
    });

    it('shows what is missing, in red, while the payment falls short', () => {
      component.openCashDialog();
      fixture.detectChanges();

      typeDigit(getReceivedInput(), '3'); // 0.03 < 5.00

      const changeEl = fixture.nativeElement.querySelector('[data-testid="change-amount"]');
      expect(changeEl.textContent).toContain('4.97');
      expect(changeEl.className).toContain('text-error');
      expect(getConfirmButton().disabled).toBe(true);
    });

    it('cancel button closes the dialog', () => {
      component.openCashDialog();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('[aria-label="Cancelar"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(getDialog()).toBeNull();
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

  describe('openCashDialog', () => {
    it('does nothing when canConfirm is false (no lines)', () => {
      setOrder([]);
      component.openCashDialog();
      expect(component.cashDialogOpen()).toBe(false);
    });

    it('opens the dialog and resets any previously entered amount', () => {
      setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 5 })] })]);
      component.receivedAmount.set(999);

      component.openCashDialog();

      expect(component.cashDialogOpen()).toBe(true);
      expect(component.receivedAmount()).toBeNull();
    });
  });

  describe('change calculation', () => {
    beforeEach(() => {
      setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 5 })] })]);
      component.openCashDialog();
    });

    it('changeAmount is null until an amount is entered', () => {
      expect(component.changeAmount()).toBeNull();
      expect(component.canConfirmCash()).toBe(false);
    });

    it('computes the change once the customer\'s payment is entered', () => {
      component.receivedAmount.set(10);
      expect(component.changeAmount()).toBe(5);
      expect(component.canConfirmCash()).toBe(true);
    });

    it('is exact (no change) when paying with the exact total', () => {
      component.receivedAmount.set(5);
      expect(component.changeAmount()).toBe(0);
      expect(component.canConfirmCash()).toBe(true);
    });

    it('reports a negative change and blocks confirm when the payment falls short', () => {
      component.receivedAmount.set(3);
      expect(component.changeAmount()).toBe(-2);
      expect(component.canConfirmCash()).toBe(false);
    });
  });

  describe('cancelCashPayment', () => {
    it('closes the dialog and clears the entered amount without charging', () => {
      setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 5 })] })]);
      component.openCashDialog();
      component.receivedAmount.set(10);

      component.cancelCashPayment();

      expect(component.cashDialogOpen()).toBe(false);
      expect(component.receivedAmount()).toBeNull();
      expect(orderServiceMock.chargeOrder).not.toHaveBeenCalled();
    });
  });

  describe('confirmCashPayment', () => {
    beforeEach(() => {
      setOrder([makeRound({ items: [makeItem({ quantity: 1, unitPrice: 5 })] })]);
      component.openCashDialog();
    });

    it('does nothing when the payment does not cover the total', () => {
      component.receivedAmount.set(3);
      component.confirmCashPayment();
      expect(orderServiceMock.chargeOrder).not.toHaveBeenCalled();
      expect(component.cashDialogOpen()).toBe(true);
    });

    it('charges the order and closes the dialog once the payment covers the total', () => {
      const charged = makeOrder([]);
      orderServiceMock.chargeOrder.mockReturnValue(of(charged));
      const spy = vi.fn();
      component.charged.subscribe(spy);

      component.receivedAmount.set(10);
      component.confirmCashPayment();

      expect(component.cashDialogOpen()).toBe(false);
      expect(orderServiceMock.chargeOrder).toHaveBeenCalledWith(1, { discount: undefined });
      expect(spy).toHaveBeenCalledWith(charged);
    });

    it('sends the discount payload when enabled', () => {
      orderServiceMock.chargeOrder.mockReturnValue(of(makeOrder([])));
      component.toggleDiscount();
      component.description.set('Promo');
      component.setDiscountType('fixed');
      component.setDiscountValue(1);

      component.receivedAmount.set(10);
      component.confirmCashPayment();

      expect(orderServiceMock.chargeOrder).toHaveBeenCalledWith(1, {
        discount: { description: 'Promo', type: 'fixed', value: 1 },
      });
    });

    it('toasts a friendly message and stays open on a generic error', () => {
      orderServiceMock.chargeOrder.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: 'Order has no items' } })));
      const backSpy = vi.fn();
      component.back.subscribe(backSpy);

      component.receivedAmount.set(10);
      component.confirmCashPayment();

      expect(toastServiceMock.error).toHaveBeenCalledWith('La cuenta no tiene productos');
      expect(backSpy).not.toHaveBeenCalled();
    });

    it('closes the panel when the order no longer exists', () => {
      orderServiceMock.chargeOrder.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { error: 'Order not found' } })));
      const backSpy = vi.fn();
      component.back.subscribe(backSpy);

      component.receivedAmount.set(10);
      component.confirmCashPayment();

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
