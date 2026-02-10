import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryIdSchema,
  ReorderCategoriesSchema
} from '../types/category.types';

export class CategoryController {
  /**
   * GET /api/categories
   * Get all categories
   */
  async getAllCategories(req: Request, res: Response) {
    try {
      const activeOnly = req.query.active === 'true';

      const categories = activeOnly
        ? await categoryService.getActiveCategories()
        : await categoryService.getAllCategories();

      res.json({
        success: true,
        data: categories,
        count: categories.length
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get categories'
      });
    }
  }

  /**
   * GET /api/categories/:id
   * Get category by ID
   */
  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = CategoryIdSchema.parse(req.params);

      const category = await categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      console.error('Error getting category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category'
      });
    }
  }

  /**
   * POST /api/categories
   * Create a new category
   */
  async createCategory(req: Request, res: Response) {
    try {
      const data = CreateCategorySchema.parse(req.body);

      const category = await categoryService.createCategory(data);

      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully'
      });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to create category',
        details: error instanceof Error ? error.message : undefined
      });
    }
  }

  /**
   * PUT /api/categories/:id
   * Update a category
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = CategoryIdSchema.parse(req.params);
      const data = UpdateCategorySchema.parse(req.body);

      const exists = await categoryService.categoryExists(id);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      const category = await categoryService.updateCategory(id, data);

      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully'
      });
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to update category',
        details: error instanceof Error ? error.message : undefined
      });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Soft delete (deactivate) a category, or hard delete with ?permanent=true
   */
  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = CategoryIdSchema.parse(req.params);
      const permanent = req.query.permanent === 'true';

      const exists = await categoryService.categoryExists(id);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      if (permanent) {
        await categoryService.hardDeleteCategory(id);
        res.json({
          success: true,
          message: 'Category permanently deleted'
        });
      } else {
        await categoryService.deleteCategory(id);
        res.json({
          success: true,
          message: 'Category deactivated successfully'
        });
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to delete category',
        details: error instanceof Error ? error.message : undefined
      });
    }
  }

  /**
   * PATCH /api/categories/reorder
   * Batch reorder all categories
   */
  async reorderCategories(req: Request, res: Response) {
    try {
      const { categoryIds } = ReorderCategoriesSchema.parse(req.body);

      const updatedCount = await categoryService.reorderCategories(categoryIds);

      res.json({
        success: true,
        message: 'Categories reordered successfully',
        data: { updated: updatedCount }
      });
    } catch (error) {
      console.error('Error reordering categories:', error);

      if (error instanceof Error && error.message.includes('Invalid category IDs')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to reorder categories',
        details: error instanceof Error ? error.message : undefined
      });
    }
  }
}

export const categoryController = new CategoryController();
