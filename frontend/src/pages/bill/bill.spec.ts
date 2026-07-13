import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  beforeEach(async () => {
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
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } },
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
});
