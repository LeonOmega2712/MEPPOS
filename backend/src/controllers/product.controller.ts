import { Request, Response } from 'express';
import { productService } from '../services/product.service';
import { categoryService } from '../services/category.service';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductIdSchema,
  ProductsByCategorySchema
} from '../types/product.types';

export class ProductController {
  /**
   * GET /api/products
   * Get all products
   */
  async getAllProducts(req: Request, res: Response) {
    try {
      const activeOnly = req.query.active === 'true';

      const products = activeOnly
        ? await productService.getActiveProducts()
        : await productService.getAllProducts();

      res.json({
        success: true,
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error getting products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get products'
      });
    }
  }

  /**
   * GET /api/products/:id
   * Get product by ID
   */
  async getProductById(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);

      const product = await productService.getProductById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Error getting product:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get product'
      });
    }
  }

  /**
   * GET /api/categories/:categoryId/products
   * Get products by category
   */
  async getProductsByCategory(req: Request, res: Response) {
    try {
      const { categoryId } = ProductsByCategorySchema.parse(req.params);
      const activeOnly = req.query.active === 'true';

      const products = activeOnly
        ? await productService.getActiveProductsByCategory(categoryId)
        : await productService.getProductsByCategory(categoryId);

      res.json({
        success: true,
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error getting products by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get products'
      });
    }
  }

  /**
   * POST /api/products
   * Create a new product
   */
  async createProduct(req: Request, res: Response) {
    try {
      const data = CreateProductSchema.parse(req.body);

      // Check if category exists
      const categoryExists = await categoryService.categoryExists(data.categoryId);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      const product = await productService.createProduct(data);

      res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to create product',
        details: error instanceof Error ? error.message : undefined
      });
    }
  }

  /**
   * PUT /api/products/:id
   * Update a product
   */
  async updateProduct(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);
      const data = UpdateProductSchema.parse(req.body);

      const exists = await productService.productExists(id);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      // If categoryId is being updated, check if it exists
      if (data.categoryId) {
        const categoryExists = await categoryService.categoryExists(data.categoryId);
        if (!categoryExists) {
          return res.status(404).json({
            success: false,
            error: 'Category not found'
          });
        }
      }

      const product = await productService.updateProduct(id, data);

      res.json({
        success: true,
        data: product,
        message: 'Product updated successfully'
      });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to update product',
        details: error instanceof Error ? error.message : undefined
      });
    }
  }

  /**
   * DELETE /api/products/:id
   * Delete a product
   */
  async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);

      const exists = await productService.productExists(id);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      await productService.deleteProduct(id);

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to delete product',
        details: error instanceof Error ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/products/:id/price
   * Get the effective price of a product
   */
  async getProductPrice(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);

      const price = await productService.getEffectivePrice(id);

      if (price === null) {
        return res.status(404).json({
          success: false,
          error: 'Product not found or has no price'
        });
      }

      res.json({
        success: true,
        data: { price }
      });
    } catch (error) {
      console.error('Error getting product price:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get product price'
      });
    }
  }
}

export const productController = new ProductController();
