import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  CreateIngredientSchema,
  UpdateIngredientSchema,
  CreateVariantTypeSchema,
  UpdateVariantTypeSchema
} from '../validation/validation.schemas';

// ============================================
// INGREDIENT CONTROLLER
// ============================================

export class IngredientController {
  /**
   * GET /api/ingredients
   */
  async getAll(req: Request, res: Response) {
    try {
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const ingredients = await prisma.ingredient.findMany({
        where: isActive !== undefined ? { isActive } : undefined,
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      });

      res.json({
        success: true,
        data: ingredients,
        count: ingredients.length
      });
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      res.status(500).json({
        error: 'Error fetching ingredients',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/ingredients/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const ingredient = await prisma.ingredient.findUnique({
        where: { id },
        include: {
          menuItems: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  category: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!ingredient) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      res.json({
        success: true,
        data: ingredient
      });
    } catch (error) {
      console.error('Error fetching ingredient:', error);
      res.status(500).json({
        error: 'Error fetching ingredient',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/ingredients
   */
  async create(req: Request, res: Response) {
    try {
      const validation = CreateIngredientSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.issues
        });
      }

      const ingredient = await prisma.ingredient.create({
        data: validation.data
      });

      res.status(201).json({
        success: true,
        data: ingredient,
        message: 'Ingredient created successfully'
      });
    } catch (error) {
      console.error('Error creating ingredient:', error);
      res.status(500).json({
        error: 'Error creating ingredient',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/ingredients/:id
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = UpdateIngredientSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.issues
        });
      }

      const ingredient = await prisma.ingredient.update({
        where: { id },
        data: validation.data
      });

      res.json({
        success: true,
        data: ingredient,
        message: 'Ingredient updated successfully'
      });
    } catch (error) {
      console.error('Error updating ingredient:', error);
      res.status(500).json({
        error: 'Error updating ingredient',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/ingredients/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if ingredient is being used
      const usage = await prisma.menuItemIngredient.count({
        where: { ingredientId: id }
      });

      if (usage > 0) {
        return res.status(400).json({
          error: `Cannot delete ingredient. It is being used in ${usage} menu item(s).`
        });
      }

      await prisma.ingredient.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Ingredient deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      res.status(500).json({
        error: 'Error deleting ingredient',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const ingredientController = new IngredientController();