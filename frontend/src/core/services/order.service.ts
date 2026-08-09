import { Injectable, inject, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SwrCache } from '../utils/swr-cache';
import type {
  ApiResponse,
  Order,
  CreateOrderPayload,
  AddRoundPayload,
  UpdateOrderItemPayload,
  OrderRound,
  OrderItem,
} from '../models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly ordersUrl = `${environment.apiUrl}/orders`;

  private readonly openOrdersCache = new SwrCache<Order[]>({
    fetcher: () =>
      this.http
        .get<ApiResponse<Order[]>>(this.ordersUrl)
        .pipe(map((r) => r.data)),
  });

  readonly openOrders: Signal<Order[] | null> = this.openOrdersCache.data;
  readonly openOrdersLoading: Signal<boolean> = this.openOrdersCache.loading;
  readonly openOrdersRevalidating: Signal<boolean> = this.openOrdersCache.revalidating;
  readonly openOrdersError: Signal<unknown> = this.openOrdersCache.error;

  ensureOpenOrders(): void {
    this.openOrdersCache.ensureLoaded();
  }

  refreshOpenOrders(): Observable<Order[]> {
    return this.openOrdersCache.refresh();
  }

  getOrderById(id: number): Observable<Order> {
    return this.http
      .get<ApiResponse<Order>>(`${this.ordersUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  createOrder(data: CreateOrderPayload): Observable<Order> {
    return this.http
      .post<ApiResponse<Order>>(this.ordersUrl, data)
      .pipe(map((r) => r.data));
  }

  addRound(orderId: number, data: AddRoundPayload): Observable<OrderRound> {
    return this.http
      .post<ApiResponse<OrderRound>>(`${this.ordersUrl}/${orderId}/rounds`, data)
      .pipe(map((r) => r.data));
  }

  updateItem(
    orderId: number,
    roundId: number,
    itemId: number,
    data: UpdateOrderItemPayload
  ): Observable<OrderItem> {
    return this.http
      .put<ApiResponse<OrderItem>>(`${this.ordersUrl}/${orderId}/rounds/${roundId}/items/${itemId}`, data)
      .pipe(map((r) => r.data));
  }

  deleteItem(orderId: number, roundId: number, itemId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.ordersUrl}/${orderId}/rounds/${roundId}/items/${itemId}`)
      .pipe(map(() => undefined));
  }

  deleteRound(orderId: number, roundId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.ordersUrl}/${orderId}/rounds/${roundId}`)
      .pipe(map(() => undefined));
  }

  cancelOrder(id: number): Observable<Order> {
    return this.http
      .post<ApiResponse<Order>>(`${this.ordersUrl}/${id}/cancel`, {})
      .pipe(map((r) => r.data));
  }
}
