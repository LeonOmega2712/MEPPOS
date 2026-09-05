import type { Order } from '../models';

/** Human-readable label for an order: location name (with bar position), takeout folio, or a fallback by ID. */
export function orderLabel(order: Order): string {
  if (order.location) {
    if (order.location.type === 'bar' && order.barPosition != null) {
      return `${order.location.name} #${order.barPosition}`;
    }
    return order.location.name;
  }
  if (order.takeoutNumber != null) return `Folio #${order.takeoutNumber}`;
  return `Orden #${order.id}`;
}
