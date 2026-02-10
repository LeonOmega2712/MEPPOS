import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CreateProductDTO, UpdateProductDTO } from '../types/product.types';

interface ProductWithCategory {
  price: Prisma.Decimal | null;
  category: { id: number; name: string; basePrice: Prisma.Decimal | null };
}

function withResolvedPrice<T extends ProductWithCategory>(product: T): T & { price: number | null } {
  const price = product.price !== null
    ? Number(product.price)
    : product.category.basePrice !== null
      ? Number(product.category.basePrice)
      : null;
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
    return products.map(withResolvedPrice);
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
    return products.map(withResolvedPrice);
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
    return products.map(withResolvedPrice);
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
    return products.map(withResolvedPrice);
  }

  /**
   * Create a new product
   */
  async createProduct(data: CreateProductDTO) {
    return prisma.product.create({
      data,
      include: {
        category: true
      }
    });
  }

  /**
   * Update a product
   */
  async updateProduct(id: number, data: UpdateProductDTO) {
    return prisma.product.update({
      where: { id },
      data,
      include: {
        category: true
      }
    });
  }

  /**
   * Delete a product
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
    // Validate all products exist and belong to the category
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        categoryId: categoryId,
        active: true
      },
      select: { id: true }
    });

    // Check if all products were found
    if (products.length !== productIds.length) {
      const foundIds = products.map(p => p.id);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      throw new Error(
        `Invalid product IDs or products don't belong to category ${categoryId}: ${missingIds.join(', ')}`
      );
    }

    // Check for duplicates
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      throw new Error('Duplicate product IDs in reorder request');
    }

    // Build transaction: update each product with its new displayOrder
    const updateOperations = productIds.map((productId, index) =>
      prisma.product.update({
        where: { id: productId },
        data: { displayOrder: index }
      })
    );

    // Execute all updates in a single atomic transaction
    await prisma.$transaction(updateOperations);

    return productIds.length;
  }
}

export const productService = new ProductService();
