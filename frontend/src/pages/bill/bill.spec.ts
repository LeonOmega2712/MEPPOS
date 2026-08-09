import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BillPage } from './bill';
import { MenuService } from '../../core/services/menu.service';
import { SplashService } from '../../core/services/splash.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { OrderService } from '../../core/services/order.service';
import { LocationService } from '../../core/services/location.service';
import { AuthService } from '../../core/services/auth.service';
import type { AuthUser, Order } from '../../core/models';

const OWNER: AuthUser = { id: 1, username: 'ana', displayName: 'Ana', role: 'WAITER' };
const OTHER_USER: AuthUser = { id: 2, username: 'luis', displayName: 'Luis', role: 'WAITER' };

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    locationId: 5,
    barPosition: null,
    takeoutNumber: null,
    status: 'open',
    ownerUserId: OWNER.id,
    openedAt: '2026-07-12T18:30:00Z',
    closedAt: null,
    notes: null,
    location: { id: 5, name: 'Mesa 1', type: 'table', active: true, displayOrder: 0, createdAt: '', updatedAt: null },
    owner: { id: OWNER.id, displayName: OWNER.displayName },
    rounds: [],
    discounts: [],
    subtotal: 0,
    discountTotal: 0,
    total: 0,
    ...overrides,
  };
}

describe('BillPage', () => {
  let fixture: ComponentFixture<BillPage>;
  let component: BillPage;
  let orderServiceMock: any;
  let authServiceMock: any;
  let toastServiceMock: any;

  beforeEach(async () => {
    toastServiceMock = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    orderServiceMock = {
      openOrders: signal<Order[] | null>([]),
      openOrdersLoading: signal(false),
      openOrdersRevalidating: signal(false),
      openOrdersError: signal(null),
      ensureOpenOrders: vi.fn(),
      refreshOpenOrders: vi.fn(() => of([])),
      getOrderById: vi.fn(),
      createOrder: vi.fn(),
      addRound: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      deleteRound: vi.fn(),
      cancelOrder: vi.fn(),
    };

    authServiceMock = { user: signal<AuthUser | null>(OWNER) };

    await TestBed.configureTestingModule({
      imports: [BillPage],
      providers: [
        provideRouter([]),
        { provide: MenuService, useValue: { getMenu: () => of([]) } },
        { provide: SplashService, useValue: { contentReady: vi.fn() } },
        { provide: ConfirmDialogService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: OrderService, useValue: orderServiceMock },
        { provide: LocationService, useValue: { locations: signal([]), locationsLoading: signal(false), ensureLocations: vi.fn(), refreshLocations: vi.fn() } },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BillPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('visibleOrders / showMine toggle', () => {
    it('shows all orders by default', () => {
      const mine = makeOrder({ id: 1, ownerUserId: OWNER.id });
      const other = makeOrder({ id: 2, ownerUserId: OTHER_USER.id });
      orderServiceMock.openOrders.set([mine, other]);

      expect(component.visibleOrders().map((o) => o.id)).toEqual([1, 2]);
    });

    it('filters to only the current user orders when showMine is toggled', () => {
      const mine = makeOrder({ id: 1, ownerUserId: OWNER.id });
      const other = makeOrder({ id: 2, ownerUserId: OTHER_USER.id });
      orderServiceMock.openOrders.set([mine, other]);

      component.toggleMine();

      expect(component.showMine()).toBe(true);
      expect(component.visibleOrders().map((o) => o.id)).toEqual([1]);
    });

    it('toggling back to all restores the full list', () => {
      const mine = makeOrder({ id: 1, ownerUserId: OWNER.id });
      const other = makeOrder({ id: 2, ownerUserId: OTHER_USER.id });
      orderServiceMock.openOrders.set([mine, other]);

      component.toggleMine();
      component.toggleMine();

      expect(component.showMine()).toBe(false);
      expect(component.visibleOrders().map((o) => o.id)).toEqual([1, 2]);
    });
  });

  describe('isOwner / ownerLabel / openedAtLabel', () => {
    it('isOwner is true when the order belongs to the current user', () => {
      expect(component.isOwner(makeOrder({ ownerUserId: OWNER.id }))).toBe(true);
    });

    it('isOwner is false for another waiter\'s order', () => {
      expect(component.isOwner(makeOrder({ ownerUserId: OTHER_USER.id }))).toBe(false);
    });

    it('ownerLabel falls back when owner data is missing', () => {
      const order = makeOrder({ owner: undefined });
      expect(component.ownerLabel(order)).toBe('Otro mesero');
    });

    it('ownerLabel returns the owner display name', () => {
      const order = makeOrder({ owner: { id: OTHER_USER.id, displayName: 'Luis' } });
      expect(component.ownerLabel(order)).toBe('Luis');
    });

    it('openedAtLabel formats the opened timestamp as HH:mm', () => {
      const order = makeOrder({ openedAt: '2026-07-12T18:30:00Z' });
      expect(component.openedAtLabel(order)).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('refresh', () => {
    it('delegates to orderService.refreshOpenOrders', () => {
      component.refresh();
      expect(orderServiceMock.refreshOpenOrders).toHaveBeenCalledTimes(1);
    });
  });

  describe('existingRounds grouping', () => {
    it('groups sent items by round and computes per-round subtotals', () => {
      const order = makeOrder({
        rounds: [
          {
            id: 10,
            orderId: 1,
            roundNumber: 1,
            userId: OWNER.id,
            createdAt: '2026-07-12T18:31:00Z',
            items: [
              { id: 100, roundId: 10, productId: 1, customName: null, unitPrice: 5, quantity: 2, subtotal: 10, notes: null },
              { id: 101, roundId: 10, productId: 2, customName: null, unitPrice: 3, quantity: 1, subtotal: 3, notes: null },
            ],
          },
          {
            id: 11,
            orderId: 1,
            roundNumber: 2,
            userId: OWNER.id,
            createdAt: '2026-07-12T18:40:00Z',
            items: [
              { id: 102, roundId: 11, productId: 3, customName: null, unitPrice: 8, quantity: 1, subtotal: 8, notes: null },
            ],
          },
        ],
      });
      (component as any).activeOrder.set(order);

      const rounds = component.existingRounds();
      expect(rounds).toHaveLength(2);
      expect(rounds[0]).toMatchObject({ id: 10, roundNumber: 1, subtotal: 13 });
      expect(rounds[0].items).toHaveLength(2);
      expect(rounds[1]).toMatchObject({ id: 11, roundNumber: 2, subtotal: 8 });
    });

    it('returns an empty list when there is no active order', () => {
      expect(component.existingRounds()).toEqual([]);
    });
  });

  describe('polling', () => {
    let pollFixture: ComponentFixture<BillPage>;

    beforeEach(() => {
      // Stops the outer instance's real-timer interval so it doesn't leak into these fake-timer tests.
      fixture.destroy();
      vi.useFakeTimers();
      pollFixture = TestBed.createComponent(BillPage);
      pollFixture.detectChanges();
      orderServiceMock.refreshOpenOrders.mockClear();
    });

    afterEach(() => {
      pollFixture.destroy();
      vi.useRealTimers();
    });

    it('refreshes open orders every 30 seconds', () => {
      vi.advanceTimersByTime(30_000);
      expect(orderServiceMock.refreshOpenOrders).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30_000);
      expect(orderServiceMock.refreshOpenOrders).toHaveBeenCalledTimes(2);
    });

    it('stops polling once the component is destroyed', () => {
      pollFixture.destroy();
      vi.advanceTimersByTime(60_000);
      expect(orderServiceMock.refreshOpenOrders).not.toHaveBeenCalled();
    });

    it('pauses while the document is hidden', () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));

      vi.advanceTimersByTime(60_000);
      expect(orderServiceMock.refreshOpenOrders).not.toHaveBeenCalled();

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    });

    it('refreshes immediately and resumes the interval when visibility returns', () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      orderServiceMock.refreshOpenOrders.mockClear();

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(orderServiceMock.refreshOpenOrders).toHaveBeenCalledTimes(1);

      orderServiceMock.refreshOpenOrders.mockClear();
      vi.advanceTimersByTime(30_000);
      expect(orderServiceMock.refreshOpenOrders).toHaveBeenCalledTimes(1);
    });
  });

  describe('assignment toast', () => {
    beforeEach(() => {
      // Stops the outer instance's effect so it doesn't react to the shared openOrders signal too.
      fixture.destroy();
    });

    function createFixture(initialOrders: Order[]): ComponentFixture<BillPage> {
      orderServiceMock.openOrders.set(initialOrders);
      const f = TestBed.createComponent(BillPage);
      f.detectChanges();
      return f;
    }

    it('does not toast on the first snapshot, even if it already contains an order owned by the current user (seeding)', () => {
      createFixture([makeOrder({ id: 1, ownerUserId: OWNER.id })]);
      expect(toastServiceMock.info).not.toHaveBeenCalled();
    });

    it('toasts when an order owned by the current user appears after the initial snapshot', () => {
      const f = createFixture([]);
      orderServiceMock.openOrders.set([makeOrder({ id: 1, ownerUserId: OWNER.id })]);
      f.detectChanges();
      expect(toastServiceMock.info).toHaveBeenCalledTimes(1);
    });

    it('does not toast for orders owned by another user', () => {
      const f = createFixture([]);
      orderServiceMock.openOrders.set([makeOrder({ id: 1, ownerUserId: OTHER_USER.id })]);
      f.detectChanges();
      expect(toastServiceMock.info).not.toHaveBeenCalled();
    });

    it('does not toast for an order created in the current session', () => {
      const f = createFixture([]);
      const createdOrder = makeOrder({ id: 7, ownerUserId: OWNER.id });
      orderServiceMock.createOrder.mockReturnValue(of(createdOrder));
      orderServiceMock.addRound.mockReturnValue(of({} as any));
      orderServiceMock.getOrderById.mockReturnValue(of(createdOrder));

      f.componentInstance.onLocationConfirmed({ locationId: 5 });
      orderServiceMock.openOrders.set([makeOrder({ id: 7, ownerUserId: OWNER.id })]);
      f.detectChanges();

      expect(toastServiceMock.info).not.toHaveBeenCalled();
    });

    it('toasts when an already-known order changes owner to the current user', () => {
      const f = createFixture([makeOrder({ id: 1, ownerUserId: OTHER_USER.id })]);
      orderServiceMock.openOrders.set([makeOrder({ id: 1, ownerUserId: OWNER.id })]);
      f.detectChanges();
      expect(toastServiceMock.info).toHaveBeenCalledTimes(1);
    });
  });
});
