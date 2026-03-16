import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryIdSchema,
  ReorderCategoriesSchema
} from '../types/category.types';
import { hasPrismaCode, isZodError } from '../lib/error';

export class CategoryController {
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

  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = CategoryIdSchema.parse(req.params);

      const category = await categoryService.getCategoryById(id);

      if (!category) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      res.json({ success: true, data: category });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid category ID' });
        return;
      }
      console.error('Error getting category:', error);
      res.status(500).json({ success: false, error: 'Failed to get category' });
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const data = CreateCategorySchema.parse(req.body);
      const category = await categoryService.createCategory(data);

      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully'
      });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'Category name already exists' });
        return;
      }
      console.error('Error creating category:', error);
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = CategoryIdSchema.parse(req.params);
      const data = UpdateCategorySchema.parse(req.body);

      const category = await categoryService.updateCategory(id, data);

      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully'
      });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'Category name already exists' });
        return;
      }
      console.error('Error updating category:', error);
      res.status(500).json({ success: false, error: 'Failed to update category' });
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = CategoryIdSchema.parse(req.params);
      const permanent = req.query.permanent === 'true';

      if (permanent) {
        await categoryService.deleteCategory(id);
        res.json({ success: true, message: 'Category permanently deleted' });
      } else {
        await categoryService.deactivateCategory(id);
        res.json({ success: true, message: 'Category deactivated successfully' });
      }
    } catch (error: unknown) {
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      console.error('Error deleting category:', error);
      res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
  }

  async reorderCategories(req: Request, res: Response) {
    try {
      const { categoryIds } = ReorderCategoriesSchema.parse(req.body);
      const updatedCount = await categoryService.reorderCategories(categoryIds);

      res.json({
        success: true,
        message: 'Categories reordered successfully',
        data: { updated: updatedCount }
      });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (error instanceof Error && (error.message.includes('Invalid category IDs') || error.message.includes('Duplicate category IDs'))) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      console.error('Error reordering categories:', error);
      res.status(500).json({ success: false, error: 'Failed to reorder categories' });
    }
  }
}

export const categoryController = new CategoryController();
