import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  CreateIngredientSchema,
  UpdateIngredientSchema,
  CreateVariantTypeSchema,
  UpdateVariantTypeSchema
} from '../validation/validation.schemas';

const prisma = new PrismaClient();

// ============================================
// VARIANT TYPE CONTROLLER
// ============================================

export class VariantTypeController {
  /**
   * GET /api/variant-types
   */
  async getAll(req: Request, res: Response) {
    try {
      const variantTypes = await prisma.variantType.findMany({
        include: {
          _count: {
            select: { variants: true }
          }
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      });

      res.json({
        success: true,
        data: variantTypes,
        count: variantTypes.length
      });
    } catch (error) {
      console.error('Error fetching variant types:', error);
      res.status(500).json({
        error: 'Error fetching variant types',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/variant-types/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const variantType = await prisma.variantType.findUnique({
        where: { id },
        include: {
          variants: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (!variantType) {
        return res.status(404).json({ error: 'Variant type not found' });
      }

      res.json({
        success: true,
        data: variantType
      });
    } catch (error) {
      console.error('Error fetching variant type:', error);
      res.status(500).json({
        error: 'Error fetching variant type',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/variant-types
   */
  async create(req: Request, res: Response) {
    try {
      const validation = CreateVariantTypeSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.errors
        });
      }

      const variantType = await prisma.variantType.create({
        data: validation.data
      });

      res.status(201).json({
        success: true,
        data: variantType,
        message: 'Variant type created successfully'
      });
    } catch (error) {
      console.error('Error creating variant type:', error);

      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return res.status(400).json({
          error: 'Variant type with this name already exists'
        });
      }

      res.status(500).json({
        error: 'Error creating variant type',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/variant-types/:id
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = UpdateVariantTypeSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.errors
        });
      }

      const variantType = await prisma.variantType.update({
        where: { id },
        data: validation.data
      });

      res.json({
        success: true,
        data: variantType,
        message: 'Variant type updated successfully'
      });
    } catch (error) {
      console.error('Error updating variant type:', error);
      res.status(500).json({
        error: 'Error updating variant type',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/variant-types/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if variant type is being used
      const usage = await prisma.menuVariant.count({
        where: { variantTypeId: id }
      });

      if (usage > 0) {
        return res.status(400).json({
          error: `Cannot delete variant type. It is being used in ${usage} variant(s).`
        });
      }

      await prisma.variantType.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Variant type deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting variant type:', error);
      res.status(500).json({
        error: 'Error deleting variant type',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const variantTypeController = new VariantTypeController();