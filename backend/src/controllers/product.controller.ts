import { Request, Response } from 'express';
import { productService } from '../services/product.service';
import { categoryService } from '../services/category.service';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductIdSchema,
  ProductsByCategorySchema,
  ReorderProductsSchema
} from '../types/product.types';
import { hasPrismaCode, isZodError } from '../lib/error';

export class ProductController {
  async getAllProducts(req: Request, res: Response) {
    try {
      const activeOnly = req.query.active === 'true';

      const [products, categories] = await Promise.all([
        activeOnly
          ? productService.getActiveProducts()
          : productService.getAllProducts(),
        categoryService.getActiveCategories()
      ]);

      res.json({
        success: true,
        data: products,
        categories,
        count: products.length
      });
    } catch (error) {
      console.error('Error getting products:', error);
      res.status(500).json({ success: false, error: 'Failed to get products' });
    }
  }

  async getProductById(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);
      const product = await productService.getProductById(id);

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      res.json({ success: true, data: product });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid product ID' });
        return;
      }
      console.error('Error getting product:', error);
      res.status(500).json({ success: false, error: 'Failed to get product' });
    }
  }

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
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid category ID' });
        return;
      }
      console.error('Error getting products by category:', error);
      res.status(500).json({ success: false, error: 'Failed to get products' });
    }
  }

  async createProduct(req: Request, res: Response) {
    try {
      const data = CreateProductSchema.parse(req.body);
      const product = await productService.createProduct(data);

      res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2003')) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'Product name already exists' });
        return;
      }
      console.error('Error creating product:', error);
      res.status(500).json({ success: false, error: 'Failed to create product' });
    }
  }

  async updateProduct(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);
      const data = UpdateProductSchema.parse(req.body);

      const product = await productService.updateProduct(id, data);

      res.json({
        success: true,
        data: product,
        message: 'Product updated successfully'
      });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      if (hasPrismaCode(error, 'P2003')) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'Product name already exists' });
        return;
      }
      console.error('Error updating product:', error);
      res.status(500).json({ success: false, error: 'Failed to update product' });
    }
  }

  async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);
      const permanent = req.query.permanent === 'true';

      if (permanent) {
        await productService.deleteProduct(id);
        res.json({ success: true, message: 'Product permanently deleted' });
      } else {
        await productService.deactivateProduct(id);
        res.json({ success: true, message: 'Product deactivated' });
      }
    } catch (error: unknown) {
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      console.error('Error deleting product:', error);
      res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
  }

  async getProductPrice(req: Request, res: Response) {
    try {
      const { id } = ProductIdSchema.parse(req.params);
      const price = await productService.getEffectivePrice(id);

      if (price === null) {
        res.status(404).json({ success: false, error: 'Product not found or has no price' });
        return;
      }

      res.json({ success: true, data: { price } });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid product ID' });
        return;
      }
      console.error('Error getting product price:', error);
      res.status(500).json({ success: false, error: 'Failed to get product price' });
    }
  }

  async reorderProducts(req: Request, res: Response) {
    try {
      const { categoryId, productIds } = ReorderProductsSchema.parse(req.body);
      const updatedCount = await productService.reorderProducts(categoryId, productIds);

      res.json({
        success: true,
        message: 'Products reordered successfully',
        data: { updated: updatedCount }
      });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (error instanceof Error && error.message.includes('Invalid product IDs')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      console.error('Error reordering products:', error);
      res.status(500).json({ success: false, error: 'Failed to reorder products' });
    }
  }
}

export const productController = new ProductController();
