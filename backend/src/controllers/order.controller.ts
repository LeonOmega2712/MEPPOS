import { Request, Response } from 'express';
import { orderService, ORDER_ERRORS } from '../services/order.service';
import {
  AddRoundSchema,
  ChargeOrderSchema,
  CreateOrderSchema,
  ListOrdersQuerySchema,
  OrderIdSchema,
  OrderItemIdSchema,
  OrderRoundIdSchema,
  UpdateOrderItemSchema,
} from '../types/order.types';
import { isZodError } from '../lib/error';

const NOT_FOUND_ERRORS: string[] = [
  ORDER_ERRORS.LOCATION_NOT_FOUND,
  ORDER_ERRORS.ORDER_NOT_FOUND,
  ORDER_ERRORS.ROUND_NOT_FOUND,
  ORDER_ERRORS.ITEM_NOT_FOUND,
];

const CONFLICT_ERRORS: string[] = [
  ORDER_ERRORS.LOCATION_INACTIVE,
  ORDER_ERRORS.LOCATION_OCCUPIED,
  ORDER_ERRORS.ORDER_NOT_OPEN,
  ORDER_ERRORS.ORDER_EMPTY,
  ORDER_ERRORS.DISCOUNT_EXCEEDS_SUBTOTAL,
];

function handleDomainError(error: unknown, res: Response, fallbackMessage: string): boolean {
  if (!(error instanceof Error)) return false;

  if (NOT_FOUND_ERRORS.includes(error.message)) {
    res.status(404).json({ success: false, error: error.message });
    return true;
  }
  if (CONFLICT_ERRORS.includes(error.message)) {
    res.status(409).json({ success: false, error: error.message });
    return true;
  }

  console.error(fallbackMessage, error);
  return false;
}

function serializeOrderSummary(order: Parameters<typeof orderService.computeOrderTotal>[0] & Record<string, unknown>) {
  const { subtotal, discountTotal, total } = orderService.computeOrderTotal(order);
  return { ...order, subtotal, discountTotal, total };
}

export class OrderController {
  async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const { mine } = ListOrdersQuerySchema.parse(req.query);
      const orders = await orderService.listOrders({ mine, userId: req.user!.userId });
      const data = orders.map(serializeOrderSummary);
      res.json({ success: true, data, count: data.length });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid query parameters' });
        return;
      }
      console.error('Error listing orders:', error);
      res.status(500).json({ success: false, error: 'Failed to list orders' });
    }
  }

  async getOrderById(req: Request, res: Response): Promise<void> {
    const idResult = OrderIdSchema.safeParse(req.params);
    if (!idResult.success) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    try {
      const order = await orderService.getOrderById(idResult.data.id);
      if (!order) {
        res.status(404).json({ success: false, error: ORDER_ERRORS.ORDER_NOT_FOUND });
        return;
      }
      res.json({ success: true, data: serializeOrderSummary(order) });
    } catch (error) {
      console.error('Error getting order:', error);
      res.status(500).json({ success: false, error: 'Failed to get order' });
    }
  }

  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const data = CreateOrderSchema.parse(req.body);
      const order = await orderService.createOrder(data, req.user!.userId);
      res.status(201).json({ success: true, data: order, message: 'Order created successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (handleDomainError(error, res, 'Error creating order:')) return;
      res.status(500).json({ success: false, error: 'Failed to create order' });
    }
  }

  async addRound(req: Request, res: Response): Promise<void> {
    const idResult = OrderIdSchema.safeParse(req.params);
    if (!idResult.success) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    try {
      const data = AddRoundSchema.parse(req.body);
      const round = await orderService.addRound(idResult.data.id, data, req.user!.userId);
      res.status(201).json({ success: true, data: round, message: 'Round added successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (handleDomainError(error, res, 'Error adding round:')) return;
      res.status(500).json({ success: false, error: 'Failed to add round' });
    }
  }

  async updateItem(req: Request, res: Response): Promise<void> {
    const paramsResult = OrderItemIdSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({ success: false, error: 'Invalid order, round, or item ID' });
      return;
    }
    try {
      const data = UpdateOrderItemSchema.parse(req.body);
      const { id, roundId, itemId } = paramsResult.data;
      const item = await orderService.updateItem(id, roundId, itemId, data);
      res.json({ success: true, data: item, message: 'Item updated successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (handleDomainError(error, res, 'Error updating item:')) return;
      res.status(500).json({ success: false, error: 'Failed to update item' });
    }
  }

  async deleteItem(req: Request, res: Response): Promise<void> {
    const paramsResult = OrderItemIdSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({ success: false, error: 'Invalid order, round, or item ID' });
      return;
    }
    try {
      const { id, roundId, itemId } = paramsResult.data;
      await orderService.deleteItem(id, roundId, itemId);
      res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
      if (handleDomainError(error, res, 'Error deleting item:')) return;
      res.status(500).json({ success: false, error: 'Failed to delete item' });
    }
  }

  async deleteRound(req: Request, res: Response): Promise<void> {
    const paramsResult = OrderRoundIdSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({ success: false, error: 'Invalid order or round ID' });
      return;
    }
    try {
      const { id, roundId } = paramsResult.data;
      await orderService.deleteRound(id, roundId);
      res.json({ success: true, message: 'Round deleted successfully' });
    } catch (error) {
      if (handleDomainError(error, res, 'Error deleting round:')) return;
      res.status(500).json({ success: false, error: 'Failed to delete round' });
    }
  }

  async cancelOrder(req: Request, res: Response): Promise<void> {
    const idResult = OrderIdSchema.safeParse(req.params);
    if (!idResult.success) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    try {
      const order = await orderService.cancelOrder(idResult.data.id);
      res.json({ success: true, data: order, message: 'Order cancelled successfully' });
    } catch (error) {
      if (handleDomainError(error, res, 'Error cancelling order:')) return;
      res.status(500).json({ success: false, error: 'Failed to cancel order' });
    }
  }

  async chargeOrder(req: Request, res: Response): Promise<void> {
    const idResult = OrderIdSchema.safeParse(req.params);
    if (!idResult.success) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    try {
      const data = ChargeOrderSchema.parse(req.body);
      const order = await orderService.chargeOrder(idResult.data.id, data);
      res.json({ success: true, data: serializeOrderSummary(order!), message: 'Order charged successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (handleDomainError(error, res, 'Error charging order:')) return;
      res.status(500).json({ success: false, error: 'Failed to charge order' });
    }
  }
}

export const orderController = new OrderController();
