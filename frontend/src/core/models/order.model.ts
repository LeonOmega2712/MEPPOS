import type { Location } from './location.model';
import type { Product } from './product.model';

export type OrderStatus = 'open' | 'charged' | 'cancelled';
export type DiscountType = 'fixed' | 'percentage';

export interface OrderOwner {
  id: number;
  displayName: string;
}

export interface OrderItem {
  id: number;
  roundId: number;
  productId: number | null;
  customName: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes: string | null;
  product?: Product | null;
}

export interface OrderRound {
  id: number;
  orderId: number;
  roundNumber: number;
  userId: number;
  createdAt: string;
  user?: OrderOwner;
  items: OrderItem[];
}

export interface OrderDiscount {
  id: number;
  orderId: number;
  description: string;
  type: DiscountType;
  value: number;
  amount: number;
  createdAt: string;
}

export interface Order {
  id: number;
  locationId: number | null;
  barPosition: number | null;
  takeoutNumber: number | null;
  status: OrderStatus;
  ownerUserId: number;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  location?: Location | null;
  owner?: OrderOwner;
  rounds: OrderRound[];
  discounts: OrderDiscount[];
  subtotal: number;
  discountTotal: number;
  total: number;
}

export interface CreateOrderPayload {
  locationId?: number;
  notes?: string;
}

export interface OrderItemInput {
  productId?: number;
  customName?: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export interface AddRoundPayload {
  items: OrderItemInput[];
}

export interface UpdateOrderItemPayload {
  unitPrice?: number;
  quantity?: number;
  notes?: string | null;
}
