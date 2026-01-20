import { Request, Response } from 'express';
import { menuService } from '../services/menu.service';
import {
  CreateMenuItemSchema,
  UpdateMenuItemSchema,
  MenuItemFilterSchema,
  CreateMenuVariantSchema,
  UpdateMenuVariantSchema
} from '../validation/validation.schemas';

export class MenuController {
  // ============================================
  // MENU ITEMS - READ
  // ============================================

  /**
   * GET /api/menu-items
   * Get all menu items with optional filters
   */
  async getAllItems(req: Request, res: Response) {
    try {
      const filterValidation = MenuItemFilterSchema.safeParse(req.query);

      if (!filterValidation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: filterValidation.error.issues
        });
      }

      const items = await menuService.getAllItems(filterValidation.data);

      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      console.error('Error fetching menu items:', error);
      res.status(500).json({
        error: 'Error fetching menu items',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/menu-items/:id
   * Get a single menu item by ID
   */
  async getItemById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const item = await menuService.getItemById(id);

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      console.error('Error fetching menu item:', error);

      if (error instanceof Error && error.message === 'Menu item not found') {
        return res.status(404).json({
          error: 'Menu item not found'
        });
      }

      res.status(500).json({
        error: 'Error fetching menu item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/menu-items/category/:categoryId
   * Get menu items by category
   */
  async getItemsByCategory(req: Request, res: Response) {
    try {
      const { categoryId } = req.params;
      const includeSubcategories = req.query.includeSubcategories === 'true';

      const items = await menuService.getItemsByCategory(
        categoryId,
        includeSubcategories
      );

      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      console.error('Error fetching items by category:', error);
      res.status(500).json({
        error: 'Error fetching items',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================
  // MENU ITEMS - CREATE
  // ============================================

  /**
   * POST /api/menu-items
   * Create a new menu item
   */
  async createItem(req: Request, res: Response) {
    try {
      const validation = CreateMenuItemSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.issues
        });
      }

      const item = await menuService.createItem(validation.data);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Menu item created successfully'
      });
    } catch (error) {
      console.error('Error creating menu item:', error);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
      }

      res.status(500).json({
        error: 'Error creating menu item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================
  // MENU ITEMS - UPDATE
  // ============================================

  /**
   * PUT /api/menu-items/:id
   * Update a menu item
   */
  async updateItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = UpdateMenuItemSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.issues
        });
      }

      const item = await menuService.updateItem(id, validation.data);

      res.json({
        success: true,
        data: item,
        message: 'Menu item updated successfully'
      });
    } catch (error) {
      console.error('Error updating menu item:', error);

      if (error instanceof Error && error.message === 'Menu item not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Error updating menu item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================
  // MENU ITEMS - DELETE
  // ============================================

  /**
   * DELETE /api/menu-items/:id
   * Delete (deactivate) a menu item
   */
  async deleteItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const hard = req.query.hard === 'true';

      const result = await menuService.deleteItem(id, hard);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting menu item:', error);

      if (error instanceof Error && error.message === 'Menu item not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Error deleting menu item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================
  // VARIANTS - OPERATIONS
  // ============================================

  /**
   * POST /api/menu-items/:id/variants
   * Add a variant to a menu item
   */
  async addVariant(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = CreateMenuVariantSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.issues
        });
      }

      const variant = await menuService.addVariant(id, validation.data);

      res.status(201).json({
        success: true,
        data: variant,
        message: 'Variant added successfully'
      });
    } catch (error) {
      console.error('Error adding variant:', error);

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('does not support variants')) {
          return res.status(400).json({ error: error.message });
        }
      }

      res.status(500).json({
        error: 'Error adding variant',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/variants/:id
   * Update a variant
   */
  async updateVariant(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = UpdateMenuVariantSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.issues
        });
      }

      const variant = await menuService.updateVariant(id, validation.data);

      res.json({
        success: true,
        data: variant,
        message: 'Variant updated successfully'
      });
    } catch (error) {
      console.error('Error updating variant:', error);
      res.status(500).json({
        error: 'Error updating variant',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/variants/:id
   * Delete a variant
   */
  async deleteVariant(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await menuService.deleteVariant(id);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting variant:', error);
      res.status(500).json({
        error: 'Error deleting variant',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const menuController = new MenuController();