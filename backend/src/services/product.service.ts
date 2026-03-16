import { Prisma } from '@prisma/client';
import { closeDisplayOrderGaps, reorderDisplayOrder } from '../lib/display-order';
import { prisma } from '../lib/prisma';
import { CreateProductDTO, UpdateProductDTO } from '../types/product.types';

interface ProductWithCategory {
  price: Prisma.Decimal | null;
  category: { id: number; name: string; basePrice: Prisma.Decimal | null };
}

function withNumericPrice<T extends ProductWithCategory>(product: T): T & { price: number | null } {
  const price = product.price !== null ? Number(product.price) : null;
  return { ...product, price };
}

const categorySelect = { id: true, name: true, basePrice: true } as const;

export class ProductService {
  /**
   * Get all products
   */
  async getAllProducts() {
    const products = await prisma.product.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { category: { select: categorySelect } }
    });
    return products.map(withNumericPrice);
  }

  /**
   * Get active products only
   */
  async getActiveProducts() {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      include: { category: { select: categorySelect } }
    });
    return products.map(withNumericPrice);
  }

  /**
   * Get product by ID
   */
  async getProductById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true
      }
    });
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(categoryId: number) {
    const products = await prisma.product.findMany({
      where: { categoryId },
      orderBy: { displayOrder: 'asc' },
      include: { category: { select: categorySelect } }
    });
    return products.map(withNumericPrice);
  }

  /**
   * Get active products by category
   */
  async getActiveProductsByCategory(categoryId: number) {
    const products = await prisma.product.findMany({
      where: { categoryId, active: true },
      orderBy: { displayOrder: 'asc' },
      include: { category: { select: categorySelect } }
    });
    return products.map(withNumericPrice);
  }

  /**
   * Create a new product
   */
  async createProduct(data: CreateProductDTO) {
    const maxOrder = await prisma.product.aggregate({
      where: { categoryId: data.categoryId, active: true },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    return prisma.product.create({
      data: {
        ...data,
        displayOrder: data.displayOrder ?? nextOrder,
      },
      include: {
        category: true
      }
    });
  }

  /**
   * Update a product.
   * When reactivating a product (active: true), also reactivates the parent
   * category if it is currently inactive — uses a single interactive
   * transaction to avoid race conditions.
   */
  async updateProduct(id: number, data: UpdateProductDTO) {
    // Branch priority: active changes are handled first, then category moves.
    // If both active and categoryId are sent, only the active branch runs.
    if (data.active === true) {
      const current = await prisma.product.findUnique({
        where: { id },
        select: { active: true, displayOrder: true, categoryId: true },
      });

      if (current && !current.active) {
        return prisma.$transaction(async (tx) => {
          // Shift active products at or after the reactivated position within the same category
          await tx.product.updateMany({
            where: {
              categoryId: current.categoryId,
              active: true,
              displayOrder: { gte: current.displayOrder },
            },
            data: { displayOrder: { increment: 1 } },
          });

          const product = await tx.product.update({
            where: { id },
            data,
            include: { category: true }
          });

          if (!product.category.active) {
            await tx.category.update({
              where: { id: product.categoryId },
              data: { active: true }
            });
            product.category.active = true;
          }

          return product;
        });
      }
    }

    if (data.active === false) {
      const current = await prisma.product.findUnique({
        where: { id },
        select: { active: true, categoryId: true },
      });

      if (current && current.active) {
        return prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id },
            data,
          });

          await closeDisplayOrderGaps(tx, 'product', { categoryId: current.categoryId });

          // Return the updated product with category
          return tx.product.findUnique({
            where: { id },
            include: { category: true },
          });
        });
      }
    }

    // Check if product is moving to a different category
    if (data.categoryId !== undefined) {
      const current = await prisma.product.findUnique({
        where: { id },
        select: { categoryId: true, active: true },
      });

      if (current && current.active && data.categoryId !== current.categoryId) {
        return prisma.$transaction(async (tx) => {
          // Calculate displayOrder at the end of the new category
          const maxOrder = await tx.product.aggregate({
            where: { categoryId: data.categoryId, active: true },
            _max: { displayOrder: true },
          });
          const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

          const product = await tx.product.update({
            where: { id },
            data: { ...data, displayOrder: nextOrder },
            include: { category: true },
          });

          await closeDisplayOrderGaps(tx, 'product', { categoryId: current.categoryId });

          return product;
        });
      }
    }

    return prisma.product.update({
      where: { id },
      data,
      include: { category: true }
    });
  }

  /**
   * Deactivate a product (set active = false)
   */
  async deactivateProduct(id: number) {
    return this.updateProduct(id, { active: false });
  }

  /**
   * Permanently delete a product
   */
  async deleteProduct(id: number) {
    return prisma.product.delete({
      where: { id }
    });
  }

  /**
   * Check if product exists
   */
  async productExists(id: number): Promise<boolean> {
    const count = await prisma.product.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * Get the effective price of a product (product price or category basePrice)
   */
  async getEffectivePrice(id: number): Promise<number | null> {
    const product = await this.getProductById(id);
    if (!product) return null;

    // If product has its own price, use it
    if (product.price !== null) {
      return Number(product.price);
    }

    // Otherwise, inherit from category
    if (product.category.basePrice !== null) {
      return Number(product.category.basePrice);
    }

    return null;
  }

  /**
   * Reorder products within a category atomically
   * @param categoryId - Category containing the products
   * @param productIds - Ordered array of product IDs (index = displayOrder)
   * @returns Number of products updated
   */
  async reorderProducts(categoryId: number, productIds: number[]): Promise<number> {
    return reorderDisplayOrder('product', productIds, { categoryId });
  }
}

export const productService = new ProductService();
