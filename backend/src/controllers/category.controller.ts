import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import {
  CreateMenuCategorySchema,
  UpdateMenuCategorySchema,
  MenuCategoryFilterSchema
} from '../validation/validation.schemas';

export class CategoryController {
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * GET /api/categories
   * Get all categories (flat list)
   */
  async getAllCategories(req: Request, res: Response) {
    try {
      const filterValidation = MenuCategoryFilterSchema.safeParse(req.query);

      if (!filterValidation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: filterValidation.error.errors
        });
      }

      const categories = await categoryService.getAllCategories(filterValidation.data);

      res.json({
        success: true,
        data: categories,
        count: categories.length
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        error: 'Error fetching categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/categories/tree
   * Get category tree (hierarchical structure)
   */
  async getCategoryTree(req: Request, res: Response) {
    try {
      const tree = await categoryService.getCategoryTree();

      res.json({
        success: true,
        data: tree
      });
    } catch (error) {
      console.error('Error fetching category tree:', error);
      res.status(500).json({
        error: 'Error fetching category tree',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/categories/root
   * Get root categories only
   */
  async getRootCategories(req: Request, res: Response) {
    try {
      const categories = await categoryService.getRootCategories();

      res.json({
        success: true,
        data: categories,
        count: categories.length
      });
    } catch (error) {
      console.error('Error fetching root categories:', error);
      res.status(500).json({
        error: 'Error fetching root categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/categories/:id
   * Get a single category by ID
   */
  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const category = await categoryService.getCategoryById(id);

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      console.error('Error fetching category:', error);

      if (error instanceof Error && error.message === 'Category not found') {
        return res.status(404).json({
          error: 'Category not found'
        });
      }

      res.status(500).json({
        error: 'Error fetching category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/categories/:id/path
   * Get breadcrumb path for a category
   */
  async getCategoryPath(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const path = await categoryService.getCategoryPath(id);

      res.json({
        success: true,
        data: path
      });
    } catch (error) {
      console.error('Error fetching category path:', error);

      if (error instanceof Error && error.message === 'Category not found') {
        return res.status(404).json({
          error: 'Category not found'
        });
      }

      res.status(500).json({
        error: 'Error fetching category path',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================
  // CREATE OPERATIONS
  // ============================================

  /**
   * POST /api/categories
   * Create a new category
   */
  async createCategory(req: Request, res: Response) {
    try {
      const validation = CreateMenuCategorySchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.errors
        });
      }

      const category = await categoryService.createCategory(validation.data);

      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully'
      });
    } catch (error) {
      console.error('Error creating category:', error);

      if (error instanceof Error && error.message === 'Parent category not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Error creating category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  /**
   * PUT /api/categories/:id
   * Update a category
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = UpdateMenuCategorySchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid data',
          details: validation.error.errors
        });
      }

      const category = await categoryService.updateCategory(id, validation.data);

      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully'
      });
    } catch (error) {
      console.error('Error updating category:', error);

      if (error instanceof Error) {
        if (error.message === 'Category not found' || 
            error.message === 'Parent category not found') {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('circular reference') ||
            error.message.includes('cannot be its own parent')) {
          return res.status(400).json({ error: error.message });
        }
      }

      res.status(500).json({
        error: 'Error updating category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================
  // DELETE OPERATIONS
  // ============================================

  /**
   * DELETE /api/categories/:id
   * Delete a category
   */
  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const hard = req.query.hard === 'true';

      const result = await categoryService.deleteCategory(id, hard);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting category:', error);

      if (error instanceof Error) {
        if (error.message === 'Category not found') {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('Cannot delete category')) {
          return res.status(400).json({ error: error.message });
        }
      }

      res.status(500).json({
        error: 'Error deleting category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const categoryController = new CategoryController();